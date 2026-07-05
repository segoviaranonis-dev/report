import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].trim().replace(/^["']|["']$/g, "");

const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
});

const queries = [
  ["linea 638", "SELECT id, proveedor_id, codigo_proveedor FROM linea WHERE proveedor_id=638 ORDER BY id LIMIT 8"],
  ["linea 206276", "SELECT id, proveedor_id, codigo_proveedor FROM linea WHERE codigo_proveedor=206276"],
  ["ref 638 K=11", "SELECT id, linea_id, proveedor_id, codigo_proveedor FROM referencia WHERE proveedor_id=638 AND codigo_proveedor=11 LIMIT 5"],
  ["mat K206276", "SELECT id, proveedor_id, codigo_proveedor FROM material WHERE proveedor_id=638 AND codigo_proveedor::text LIKE '%206276%' LIMIT 5"],
  ["color K0020", "SELECT id, proveedor_id, codigo_proveedor FROM color WHERE proveedor_id=638 LIMIT 8"],
  ["color 9010 6826", "SELECT id, codigo_proveedor FROM color WHERE proveedor_id=638 AND codigo_proveedor IN (9010,6826,20,8532)"],
  ["ref linea 206276", "SELECT r.id, r.linea_id, r.codigo_proveedor FROM referencia r JOIN linea l ON l.id=r.linea_id WHERE l.codigo_proveedor=206276 AND l.proveedor_id=638"],
  ["color hash vs strip", "SELECT id, codigo_proveedor FROM color WHERE proveedor_id=638 AND (codigo_proveedor IN (9010,638001277005,638001289005,638001444006) OR id IN (2218,2220))"],
];

for (const [label, q] of queries) {
  try {
    const r = await pool.query(q);
    console.log("\n===", label, "===", r.rows.length, "rows");
    console.log(JSON.stringify(r.rows, null, 2));
  } catch (e) {
    console.log("\n===", label, "ERR", e.message);
  }
}
await pool.end();
