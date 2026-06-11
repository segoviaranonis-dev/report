/**
 * Lista usuarios Nivel Dios (rol_id=1 + categoria=DIOS) y Guido.
 * Uso: node scripts/check-nivel-dios-users.mjs
 */
import pg from "pg";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, "../.env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL no encontrada en .env.local");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

const { rows: dios } = await pool.query(`
  SELECT id_usuario, descp_usuario, categoria, rol_id
  FROM usuario_v2
  WHERE rol_id = 1 AND UPPER(TRIM(categoria)) = 'DIOS'
  ORDER BY descp_usuario
`);

const { rows: guido } = await pool.query(`
  SELECT id_usuario, descp_usuario, categoria, rol_id
  FROM usuario_v2
  WHERE UPPER(descp_usuario) LIKE '%GUIDO%'
  ORDER BY descp_usuario
`);

console.log("=== Nivel Dios (rol_id=1 AND categoria=DIOS) ===");
console.log(JSON.stringify(dios, null, 2));
console.log("\n=== Usuarios Guido (cualquier rol/categoria) ===");
console.log(JSON.stringify(guido, null, 2));
console.log(`\nTotal DIOS autorizados: ${dios.length}`);

await pool.end();
