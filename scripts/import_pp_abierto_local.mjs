/**
 * Importa proforma PP abierto desde ruta local (Director).
 * Uso: node scripts/import_pp_abierto_local.mjs "C:\ruta\archivo.xlsx"
 */
import fs from "fs";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const xlsxPath =
  process.argv[2] ||
  String.raw`C:\Users\hecto\Downloads\Copia de faturaProforma_0004_2026.xlsx actual 20-07.xlsx`;

if (!fs.existsSync(xlsxPath)) {
  console.error("archivo_no_encontrado", xlsxPath);
  process.exit(1);
}

const env = fs.readFileSync(path.resolve(__dirname, "../.env.local"), "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) {
  console.error("DATABASE_URL no encontrada");
  process.exit(1);
}

// Cargar parser TS vía tsx
const { parseProforma } = await import("../src/lib/pedido-proveedor/parse-proforma.ts");

const buffer = fs.readFileSync(xlsxPath);
const parsed = parseProforma(buffer);
if (parsed.error) {
  console.error("parse_fail", parsed.error);
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

function extraerFacturaMeta(raw) {
  const r0 = raw[0] ?? [];
  const cell = String(r0[0] ?? "").trim();
  const m = cell.match(/(\d{4}\/\d{4}|\d+\/\d+)/);
  const nro = m?.[1] ?? (cell || "S/N");
  const fechaCell = String(r0[5] ?? r0[4] ?? "").trim();
  const fm = fechaCell.match(/(\d{2}\/\d{2}\/\d{4})/);
  const iso =
    fm?.[1]?.replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, (_, d, mo, y) => `${y}-${mo}-${d}`) ?? null;
  return { nro, fecha: iso };
}

const XLSX = require("xlsx");
const wb = XLSX.read(buffer, { type: "buffer", cellDates: false, raw: true });
const ws = wb.Sheets[wb.SheetNames[0]];
const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
const meta = extraerFacturaMeta(raw);

const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(`UPDATE pp_abierto_import SET activo = false WHERE activo = true`);
  const ins = await client.query(
    `INSERT INTO pp_abierto_import (factura_nro, factura_fecha, archivo_nombre, total_filas, total_pares, activo)
     VALUES ($1, $2::date, $3, $4, $5, true) RETURNING id`,
    [meta.nro, meta.fecha, path.basename(xlsxPath), parsed.rows.length, parsed.totalPares],
  );
  const importId = Number(ins.rows[0].id);
  for (const row of parsed.rows) {
    await client.query(
      `INSERT INTO pp_abierto_import_fila (
         import_id, item_nro, linea_codigo, referencia_codigo, material_code, color_code,
         descp_material, descp_color, marca, style_code, boxes, pares, unit_fob
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (import_id, linea_codigo, referencia_codigo, material_code, color_code)
       DO UPDATE SET pares = pp_abierto_import_fila.pares + EXCLUDED.pares`,
      [
        importId,
        Number.parseInt(row.item, 10) || null,
        row.linea_codigo_proveedor,
        row.referencia_codigo_proveedor,
        row.material_code,
        row.color_code,
        row.material || null,
        row.color || null,
        row.brand || null,
        row.style_code || null,
        row.boxes,
        row.pairs,
        row.unit_fob > 0 ? row.unit_fob : null,
      ],
    );
  }
  await client.query("COMMIT");
  console.log(
    JSON.stringify({
      ok: true,
      importId,
      facturaNro: meta.nro,
      filas: parsed.rows.length,
      totalPares: parsed.totalPares,
      archivo: path.basename(xlsxPath),
    }),
  );
} catch (e) {
  await client.query("ROLLBACK");
  console.error("import_fail", e instanceof Error ? e.message : e);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
