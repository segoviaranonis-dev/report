/**
 * Mapeo sdfm3316.csv · columna GRUPO → marcas / tipo_v2 (calzado vs confecciones)
 * Uso: node scripts/map_sdfm_grupo.mjs
 */
import fs from "fs";
import path from "path";
import pg from "pg";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.resolve(__dirname, "../..", "sdfm3316.csv");

function parseCsvSemicolon(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = lines[0].split(";").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(";");
    const row = {};
    headers.forEach((h, i) => {
      row[h] = (cols[i] ?? "").trim();
    });
    return row;
  });
}

function parseLr(raw) {
  const s = String(raw ?? "").trim();
  const i = s.indexOf("-");
  if (i < 0) return { linea: s, ref: "" };
  return { linea: s.slice(0, i).trim(), ref: s.slice(i + 1).trim() };
}

function loadDbUrl() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return null;
  const env = fs.readFileSync(envPath, "utf8");
  const m = env.match(/^DATABASE_URL=(.+)$/m);
  if (!m) return null;
  return m[1].trim().replace(/^"|"$/g, "");
}

const csvText = fs.readFileSync(CSV_PATH, "latin1");
const rows = parseCsvSemicolon(csvText);
console.log(`CSV: ${rows.length} filas · headers: ${Object.keys(rows[0] ?? {}).join(", ")}`);

const byGrupo = new Map();
for (const row of rows) {
  const g = row.GRUPO || "?";
  const { linea, ref } = parseLr(row["COD.ART.PROVEEDOR"]);
  if (!byGrupo.has(g)) {
    byGrupo.set(g, { rows: 0, lineas: new Set(), refs: new Set(), gradas: new Set() });
  }
  const b = byGrupo.get(g);
  b.rows += 1;
  b.lineas.add(linea);
  b.refs.add(ref);
  b.gradas.add(row["DESCRIPCION GRADA"]);
}

const allLineas = [...new Set(rows.map((r) => parseLr(r["COD.ART.PROVEEDOR"]).linea))];
console.log(`\nLineas únicas (${allLineas.length}): ${allLineas.join(", ")}`);

const dbUrl = loadDbUrl();
let lineaDb = new Map();
let marcaTipo = [];

if (dbUrl) {
  const pool = new pg.Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  try {
    const { rows: lr } = await pool.query(
      `
      SELECT DISTINCT
        l.codigo_proveedor::text AS linea,
        l.proveedor_id,
        CASE
          WHEN l.proveedor_id = 654 THEN 1
          WHEN l.proveedor_id = 638 THEN 2
          ELSE NULL
        END AS tipo_v2_id,
        CASE
          WHEN l.proveedor_id = 654 THEN 'CALZADOS'
          WHEN l.proveedor_id = 638 THEN 'CONFECCIONES'
          ELSE 'OTRO'
        END AS tipo_v2_label,
        l.marca_id,
        TRIM(m.descp_marca) AS marca,
        mt.id_tipo AS marca_tipo_v2_id,
        tv2.descp_tipo AS marca_tipo_label
      FROM linea l
      LEFT JOIN marca_v2 m ON m.id_marca = l.marca_id
      LEFT JOIN marca_tipo_v2 mt ON mt.id_marca = l.marca_id
      LEFT JOIN tipo_v2 tv2 ON tv2.id_tipo = mt.id_tipo
      WHERE l.codigo_proveedor::text = ANY($1::text[])
      ORDER BY l.codigo_proveedor::text, mt.id_tipo
      `,
      [allLineas],
    );
    for (const r of lr) {
      const key = r.linea;
      if (!lineaDb.has(key)) lineaDb.set(key, []);
      lineaDb.get(key).push(r);
    }

    const { rows: mtAll } = await pool.query(`
      SELECT mt.id_tipo, tv.descp_tipo, m.id_marca, TRIM(m.descp_marca) AS marca
      FROM marca_tipo_v2 mt
      JOIN marca_v2 m ON m.id_marca = mt.id_marca
      JOIN tipo_v2 tv ON tv.id_tipo = mt.id_tipo
      ORDER BY mt.id_tipo, m.descp_marca
    `);
    marcaTipo = mtAll;
  } finally {
    await pool.end();
  }
} else {
  console.log("\n(sin DATABASE_URL — solo heurística local)");
}

console.log("\n=== GRUPO → líneas → BD ===");
for (const g of [...byGrupo.keys()].sort()) {
  const b = byGrupo.get(g);
  const lineas = [...b.lineas].sort();
  console.log(`\nGRUPO ${g} · ${b.rows} filas · lineas: ${lineas.join(", ")}`);
  for (const ln of lineas) {
    const hits = lineaDb.get(ln) ?? [];
    if (!hits.length) {
      const refs = [...b.refs].slice(0, 3);
      const isK = refs.some((r) => r.toUpperCase() === "K");
      const grada = [...b.gradas].slice(0, 3).join(" | ");
      console.log(`  ${ln}: (sin linea en BD) ref~${refs.join("/")} grada~${grada} ${isK ? "→ confecciones?" : "→ calzado?"}`);
      continue;
    }
    for (const h of hits) {
      console.log(
        `  ${ln}: proveedor=${h.proveedor_id} tipo_v2=${h.tipo_v2_id} (${h.tipo_v2_label}) marca=${h.marca ?? "NULL"} id=${h.marca_id} · marca_tipo_v2=${h.marca_tipo_v2_id} (${h.marca_tipo_label})`,
      );
    }
  }
}

if (marcaTipo.length) {
  console.log("\n=== marca_tipo_v2 (catálogo) ===");
  const byTipo = new Map();
  for (const r of marcaTipo) {
    if (!byTipo.has(r.id_tipo)) byTipo.set(r.id_tipo, []);
    byTipo.get(r.id_tipo).push(`${r.id_marca}:${r.marca}`);
  }
  for (const [tipo, marcas] of [...byTipo.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`tipo ${tipo}: ${marcas.join(" · ")}`);
  }
}

console.log("\n=== Resumen tipo por GRUPO (desde BD o heurística) ===");
for (const g of [...byGrupo.keys()].sort()) {
  const lineas = [...byGrupo.get(g).lineas];
  const tipos = new Set();
  for (const ln of lineas) {
    const hits = lineaDb.get(ln) ?? [];
    if (hits.length) {
      hits.forEach((h) => tipos.add(`${h.tipo_v2_id}:${h.tipo_v2_label ?? "?"}`));
    } else {
      const refs = [...byGrupo.get(g).refs];
      const conf = refs.every((r) => r.toUpperCase() === "K") || !/^\d+$/.test(ln);
      tipos.add(conf ? "2:CONFECCIONES?" : "1:CALZADOS?");
    }
  }
  console.log(`GRUPO ${g} → ${[...tipos].join(" | ")}`);
}
