/**
 * Diagnóstico: ¿Cod_Cliente TXT = id_cliente? ¿Hay código negocio aparte?
 */
import fs from "fs";
import path from "path";
import pg from "pg";
import { fileURLToPath } from "url";

const REPORT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const mol = JSON.parse(
  fs.readFileSync(path.join(REPORT, "src/lib/situacion-financiera/molecular-al-0308.json"), "utf8")
);
const env = fs.readFileSync(path.join(REPORT, ".env.local"), "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const cods = (mol["luisito:cuadro"].children || []).map((c) => {
  const m = String(c.label).match(/\((\d+)\)\s*$/);
  return Number(m[1]);
});

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();

const colsCli = await c.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema='public' AND table_name='cliente_v2' ORDER BY ordinal_position
`);
console.log("cliente_v2 cols:", colsCli.rows.map((r) => r.column_name).join(", "));

const sample = await c.query(
  `SELECT * FROM cliente_v2 WHERE id_cliente = ANY($1::int[]) LIMIT 5`,
  [cods]
);
console.log("sample luisito ids:", JSON.stringify(sample.rows, null, 2).slice(0, 1500));

// ¿existe codigo_cliente / codigo_negocio?
const like = await c.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema='public' AND table_name LIKE '%cliente%'
    AND column_name ILIKE '%cod%'
  ORDER BY 1
`);
console.log("cols *cod* en tablas cliente*:", like.rows.map((r) => r.column_name).join(", "));

// Top cadenas
const top = await c.query(`
  SELECT cad.id_cadena, cad.descp_cadena, COUNT(*)::int n
  FROM cliente_cadena_v2 cc
  JOIN cadena_v2 cad ON cad.id_cadena = cc.id_cadena
  GROUP BY 1,2 ORDER BY 3 DESC LIMIT 15
`);
console.log("top cadenas:");
for (const r of top.rows) console.log(r.id_cadena, r.n, r.descp_cadena);

// Buscar por nombre parcial Luisito / Diaz
const byName = await c.query(`
  SELECT c.id_cliente, c.descp_cliente, cc.id_cadena, cad.descp_cadena
  FROM cliente_v2 c
  LEFT JOIN cliente_cadena_v2 cc ON cc.id_cliente = c.id_cliente
  LEFT JOIN cadena_v2 cad ON cad.id_cadena = cc.id_cadena
  WHERE c.descp_cliente ILIKE '%LUISITO%'
     OR c.descp_cliente ILIKE '%DIAZ E HIJOS%'
     OR c.id_cliente = ANY($1::int[])
  ORDER BY c.id_cliente
  LIMIT 40
`, [cods]);
console.log("match nombre/id:");
for (const r of byName.rows) {
  console.log(r.id_cliente, "|", r.descp_cliente, "|", r.id_cadena, r.descp_cadena);
}

await c.end();
