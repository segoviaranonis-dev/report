import pg from "pg";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
}

if (!process.env.DATABASE_URL) {
  console.error("FAIL: DATABASE_URL no encontrada en report/.env.local");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const sql = readFileSync(resolve(root, "migrations/146_ic_programado_8604_lpc04.sql"), "utf8");
await pool.query(sql);

const r = await pool.query(`
  SELECT numero_registro, listado_precio_id, categoria_id
  FROM intencion_compra
  WHERE numero_registro IN (
    'IC-2026-0060','IC-2026-0061','IC-2026-0062','IC-2026-0063','IC-2026-0064',
    'IC-2026-0065','IC-2026-0066','IC-2026-0067','IC-2026-0068','IC-2026-0069'
  )
  ORDER BY numero_registro
`);
console.log("OK MIG-146 — ICs 8604:");
console.table(r.rows);

const fi = await pool.query(`
  SELECT count(*)::int AS n
  FROM factura_interna fi
  JOIN intencion_compra ic ON ic.id_cliente = fi.cliente_id
  JOIN intencion_compra_pedido icp ON icp.intencion_compra_id = ic.id AND icp.pedido_proveedor_id = fi.pp_id
  WHERE ic.listado_precio_id = 4 AND fi.lista_precio_id = 4
    AND ic.numero_registro LIKE 'IC-2026-006%'
`);
console.log("FI alineadas LPC04:", fi.rows[0]?.n ?? 0);

await pool.end();
