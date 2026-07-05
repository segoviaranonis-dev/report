import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");
const env = fs.readFileSync(envPath, "utf8");
const m = env.match(/^DATABASE_URL=(.+)$/m);
if (!m) {
  console.log("NO DATABASE_URL");
  process.exit(1);
}
const url = m[1].trim().replace(/^"|"$/g, "");
const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
});

function classifyLang(s) {
  const t = String(s ?? "").toLowerCase();
  if (!t.trim()) return "vacio";
  const pt =
    /\b(preto|branco|cinza|vermelho|marrom|azul|verde|amarelo|bege|dourado|laranja|rosa|roxo|marinho|couro|avela|nude|grafite|prata|ouro|bronze|bordo|burdeo)\b/i;
  const en =
    /\b(black|white|grey|gray|red|brown|blue|green|yellow|beige|gold|silver|orange|pink|navy|tan|nude|leather|cream|ivory|bronze|wine|coral|mustard|olive|coffee|chocolate|natural|camel|taupe|mocha|offwhite|off-white)\b/i;
  const es =
    /\b(negro|blanco|gris|rojo|marron|marr[oó]n|azul|verde|amarillo|beige|dorado|plata|naranja|rosado|rosa|marino|vino|celeste|bronce|natural|crema|marfil|caf[eé]|chocolate|camel|taupe|moka|couro|cuero|grafito|plateado|oro|mostaza|oliva|guinda|burdeo|bord[oó])\b/i;
  if (pt.test(t)) return "pt";
  if (en.test(t)) return "en";
  if (es.test(t)) return "es";
  return "otro";
}

const total = await pool.query(
  `SELECT COUNT(*)::int AS n FROM color WHERE proveedor_id = 654 AND activo = true`,
);
const q = await pool.query(`
  SELECT codigo_proveedor::text AS cod, nombre, tono_canon->>'etiqueta' AS tono
  FROM color
  WHERE proveedor_id = 654 AND activo = true
  ORDER BY nombre NULLS LAST
`);
const rows = q.rows;
const counts = { pt: 0, en: 0, es: 0, otro: 0, vacio: 0 };
for (const r of rows) {
  counts[classifyLang(r.nombre)]++;
}
console.log("TOTAL_654", total.rows[0].n);
console.log("SIN_NOMBRE", rows.filter((r) => !r.nombre || !String(r.nombre).trim()).length);
console.log("CON_NOMBRE", rows.filter((r) => r.nombre && String(r.nombre).trim()).length);
console.log("IDIOMA_HEURISTICA", JSON.stringify(counts));
console.log("SIN_TONO", rows.filter((r) => !r.tono).length);
console.log("--- MUESTRA EN ---");
for (const r of rows.filter((r) => classifyLang(r.nombre) === "en").slice(0, 12)) {
  console.log(`${r.cod} | ${r.nombre} | tono: ${r.tono ?? "-"}`);
}
console.log("--- MUESTRA PT ---");
for (const r of rows.filter((r) => classifyLang(r.nombre) === "pt").slice(0, 12)) {
  console.log(`${r.cod} | ${r.nombre} | tono: ${r.tono ?? "-"}`);
}
console.log("--- MUESTRA OTRO ---");
for (const r of rows.filter((r) => classifyLang(r.nombre) === "otro").slice(0, 15)) {
  console.log(`${r.cod} | ${r.nombre} | tono: ${r.tono ?? "-"}`);
}
const top = await pool.query(`
  SELECT
    btrim(split_part(btrim(regexp_replace(COALESCE(nombre,''), '[/,\\-–|]+', ' ', 'g')), ' ', 1)) AS pred,
    COUNT(*)::int AS n
  FROM color
  WHERE proveedor_id = 654 AND activo = true AND nombre IS NOT NULL AND btrim(nombre) <> ''
  GROUP BY 1
  ORDER BY n DESC
  LIMIT 35
`);
console.log("--- TOP PREDOMINANTES ---");
for (const r of top.rows) {
  console.log(String(r.n).padStart(5), r.pred);
}

await pool.end();
