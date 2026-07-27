import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  for (const envPath of [path.join(__dirname, "../.env.local"), path.join(__dirname, "../../rimec-web/.env.local")]) {
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const k = line.slice(0, eq).trim();
      if (!process.env[k]) process.env[k] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
}

async function main() {
  loadEnv();
  const { getRimecPool } = await import("../src/lib/rimec/pool");
  const pool = getRimecPool();
  const r = await pool.query(`
    SELECT l.id, l.nro_factura, l.estado AS log_estado, fi.estado AS fi_estado, fi.id AS fi_id
    FROM logistica_pendiente_confirmacion l
    JOIN factura_interna fi ON fi.id = l.factura_interna_id
    WHERE fi.estado = 'RESERVADA'
  `);
  console.log("BEFORE", r.rows);
  const del = await pool.query(`
    DELETE FROM logistica_pendiente_confirmacion l
    USING factura_interna fi
    WHERE fi.id = l.factura_interna_id AND fi.estado = 'RESERVADA'
    RETURNING l.id, l.nro_factura
  `);
  console.log("DELETED", del.rows);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
