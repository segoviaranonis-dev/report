/**
 * Smoke Paso 0 — mismo parser que excel-proveedor.ts + ley género
 * Uso: node scripts/verify_excel_paso0.mjs "C:\path\file.xlsx"
 */
import fs from "fs";
import * as XLSX from "xlsx";

const file = process.argv[2];
if (!file) {
  console.error("Uso: node scripts/verify_excel_paso0.mjs <archivo.xlsx>");
  process.exit(1);
}

const LEY = [
  ["MOLEKINHA", "NIÑAS"],
  ["MOLEKINHO", "NIÑOS"],
  ["ACTVITTA", "DAMAS"],
  ["VIZZANO", "DAMAS"],
  ["BEIRA RIO", "DAMAS"],
  ["MODARE", "DAMAS"],
  ["MOLECA", "DAMAS"],
  ["BR SPORT", "CABALLEROS"],
];

const SKIP = new Set(["STYLE", "REF", "REFERENCIA", "MATERIAL", "MAT", "FOB", "LINEA", "LÍNEA"]);

function parseFob(val) {
  if (val == null || val === "") return null;
  const s = String(val).trim().replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function extraer(rows, marca) {
  if (!rows.length || (rows[0]?.length ?? 0) < 5) return [];
  const out = [];
  for (const row of rows) {
    const linea = String(row[0] ?? "").trim();
    const ref = String(row[1] ?? "").trim();
    const fob = parseFob(row[4]);
    if (fob == null || !linea || !ref) continue;
    if (SKIP.has(ref.toUpperCase()) || SKIP.has(linea.toUpperCase())) continue;
    out.push({ marca, linea, referencia: ref, fob });
  }
  return out;
}

function genero(marca) {
  const m = String(marca).toUpperCase().replace(/\s+/g, " ").trim();
  for (const [p, g] of LEY) if (m.includes(p)) return g;
  return null;
}

const buf = fs.readFileSync(file);
const wb = XLSX.read(buf, { type: "buffer", raw: true });
const frames = [];
const razones = [];

console.log("Archivo:", file, "| bytes:", buf.length);
console.log("Hojas:", wb.SheetNames.join(", "));

for (const hoja of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[hoja], { header: 1, defval: "" });
  const parsed = extraer(rows, hoja);
  if (parsed.length) {
    frames.push(...parsed);
    console.log(`  ✓ ${hoja}: ${parsed.length} SKUs`);
    if (parsed.length <= 3) console.log("    muestra:", parsed[0]);
  } else {
    razones.push(hoja);
    const preview = rows.slice(0, 4).map((r) => r.slice(0, 6));
    console.log(`  ✗ ${hoja}: 0 SKUs — preview filas:`, JSON.stringify(preview));
  }
}

if (!frames.length) {
  console.error("\nFALLO: sin datos layout Bacera A–E");
  process.exit(2);
}

const marcas = [...new Set(frames.map((s) => s.marca))];
const rechazadas = marcas.filter((m) => !genero(m));
const asig = Object.fromEntries(marcas.filter((m) => genero(m)).map((m) => [m, genero(m)]));

console.log("\nMarcas:", marcas.length, marcas.join(" | "));
console.log("Total SKUs:", frames.length);
console.log("Ley género:", asig);
if (rechazadas.length) {
  console.error("FALLO ley género — rechazadas:", rechazadas.join(", "));
  process.exit(3);
}
console.log("\nOK — compatible Paso 0 Report (crear precio_evento)");
