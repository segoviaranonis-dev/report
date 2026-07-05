import fs from "fs";
import path from "path";
import pg from "pg";
import XLSX from "xlsx";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");
const env = fs.readFileSync(envPath, "utf8");
const m = env.match(/^DATABASE_URL=(.+)$/m);
if (!m) {
  console.error("NO DATABASE_URL");
  process.exit(1);
}
const url = m[1].trim().replace(/^"|"$/g, "");
const xlsxPath = process.argv[2] || path.join(__dirname, "..", "..", "color.xlsx");
const proveedorId = Number(process.argv[3] || 654);

const wb = XLSX.readFile(xlsxPath);
const sheet = wb.Sheets[wb.SheetNames[0]];
const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
const rows = [];
const seen = new Set();
for (let i = 1; i < matrix.length; i++) {
  const r = matrix[i];
  if (!r || r[0] == null) continue;
  const codigo = String(r[0]).trim().replace(/\.0+$/, "");
  const nombre = r[1] == null ? "" : String(r[1]).trim();
  if (!nombre || seen.has(codigo)) continue;
  seen.add(codigo);
  rows.push({ codigo, nombre });
}

const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
});

let updated = 0;
let skipped_has_nombre = 0;
let not_in_db = 0;
const errors = [];

for (const row of rows) {
  try {
    const res = await pool.query(
      `UPDATE color SET nombre = $3
       WHERE proveedor_id = $1 AND codigo_proveedor = $2::bigint AND activo = true
         AND (nombre IS NULL OR btrim(nombre) = '')`,
      [proveedorId, row.codigo, row.nombre],
    );
    if (res.rowCount > 0) {
      updated++;
      continue;
    }
    const ex = await pool.query(
      `SELECT 1 FROM color WHERE proveedor_id = $1 AND codigo_proveedor = $2::bigint AND activo = true`,
      [proveedorId, row.codigo],
    );
    if (!ex.rowCount) not_in_db++;
    else skipped_has_nombre++;
  } catch (e) {
    errors.push(`${row.codigo}: ${e.message}`);
  }
}

const after = await pool.query(
  `SELECT COUNT(*) FILTER (WHERE nombre IS NULL OR btrim(nombre)='')::int AS sin_nombre
   FROM color WHERE proveedor_id = $1 AND activo = true`,
  [proveedorId],
);

console.log(
  JSON.stringify(
    {
      xlsx: xlsxPath,
      proveedor_id: proveedorId,
      parsed: rows.length,
      updated,
      skipped_has_nombre,
      not_in_db,
      errors: errors.slice(0, 5),
      sin_nombre_restante: after.rows[0].sin_nombre,
    },
    null,
    2,
  ),
);

await pool.end();
