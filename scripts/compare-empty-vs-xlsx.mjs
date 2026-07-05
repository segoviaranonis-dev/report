import fs from "fs";
import path from "path";
import pg from "pg";
import XLSX from "xlsx";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].trim().replace(/^"|"$/g, "");
const xlsxPath = path.join(__dirname, "..", "..", "color.xlsx");

const wb = XLSX.readFile(xlsxPath);
const matrix = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
const xlsxCodes = new Set();
for (let i = 1; i < matrix.length; i++) {
  const c = matrix[i]?.[0];
  if (c != null) xlsxCodes.add(String(c).trim().replace(/\.0+$/, ""));
}

const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
});

const empty = await pool.query(`
  SELECT codigo_proveedor::text AS cod FROM color
  WHERE proveedor_id = 654 AND activo = true AND (nombre IS NULL OR btrim(nombre) = '')
  ORDER BY codigo_proveedor LIMIT 500
`);
let inXlsx = 0;
let notInXlsx = 0;
for (const r of empty.rows) {
  if (xlsxCodes.has(r.cod)) inXlsx++;
  else notInXlsx++;
}
console.log("EMPTY_TOTAL", empty.rowCount ?? empty.rows.length);
console.log("EMPTY_IN_XLSX", inXlsx);
console.log("EMPTY_NOT_IN_XLSX", notInXlsx);
console.log("SAMPLE_NOT_IN_XLSX", empty.rows.filter((r) => !xlsxCodes.has(r.cod)).slice(0, 15).map((r) => r.cod));
await pool.end();
