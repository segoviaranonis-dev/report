/**
 * Exporta snapshot cliente_cadena_v2 → JSON para Sit Fin (offline gen molecular).
 * node scripts/situacion-financiera/_export_cliente_cadena_snapshot.mjs
 */
import fs from "fs";
import path from "path";
import pg from "pg";
import { fileURLToPath } from "url";

const REPORT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = path.join(REPORT, "scripts/situacion-financiera/intake/tablas");
const outJson = path.join(outDir, "cliente_cadena_snapshot.json");
const outSf = path.join(REPORT, "src/lib/situacion-financiera/cliente-cadena-snapshot.json");

const env = fs.readFileSync(path.join(REPORT, ".env.local"), "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) throw new Error("NO DATABASE_URL");

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();

const r = await c.query(`
  SELECT
    c.id_cliente::text AS id_cliente,
    c.descp_cliente,
    c.tipo AS tipo_cliente,
    cc.id_cadena,
    cad.descp_cadena
  FROM cliente_v2 c
  LEFT JOIN cliente_cadena_v2 cc ON cc.id_cliente = c.id_cliente
  LEFT JOIN cadena_v2 cad ON cad.id_cadena = cc.id_cadena
  ORDER BY c.id_cliente::int, cc.id_cadena NULLS LAST
`);

/** id_cliente → { cadenas: [{id, nombre}], primaria } */
const byId = {};
for (const row of r.rows) {
  const id = String(row.id_cliente).trim();
  if (!byId[id]) {
    byId[id] = {
      id_cliente: id,
      descp_cliente: row.descp_cliente,
      tipo_cliente: row.tipo_cliente,
      cadenas: [],
    };
  }
  if (row.id_cadena != null) {
    byId[id].cadenas.push({
      id_cadena: Number(row.id_cadena),
      descp_cadena: String(row.descp_cadena || "").trim(),
    });
  }
}

let con = 0;
let sin = 0;
for (const v of Object.values(byId)) {
  if (v.cadenas.length) con++;
  else sin++;
  v.primaria = v.cadenas[0] || null;
}

const payload = {
  generado: new Date().toISOString(),
  fuente: "cliente_v2 × cliente_cadena_v2 × cadena_v2",
  n_clientes: Object.keys(byId).length,
  n_con_cadena: con,
  n_sin_cadena: sin,
  por_id: byId,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outJson, JSON.stringify(payload), "utf8");
fs.writeFileSync(outSf, JSON.stringify(payload), "utf8");
console.log(
  JSON.stringify(
    {
      ok: true,
      n: payload.n_clientes,
      con,
      sin,
      out: outSf,
    },
    null,
    2
  )
);
await c.end();
