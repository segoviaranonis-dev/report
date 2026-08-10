/**
 * Auditoría ejecución real Sit Fin + cruce cliente_cadena_v2.
 * Uso: node scripts/situacion-financiera/_audit_ejecucion_sf_cadena.mjs
 */
import fs from "fs";
import path from "path";
import pg from "pg";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORT = path.resolve(__dirname, "../..");
const SF = path.join(REPORT, "src/lib/situacion-financiera");

function loadJson(name) {
  return JSON.parse(fs.readFileSync(path.join(SF, name), "utf8"));
}

function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
}

const env = fs.readFileSync(path.join(REPORT, ".env.local"), "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
assert(url, "DATABASE_URL en .env.local");

const mol = loadJson("molecular-al-0308.json");
const comp = loadJson("comparacion-ago-vs-jul.json");
const mapa = loadJson("mapa-canon-al-0308.json");
const jul = loadJson("referencia-admin-jul-0107.json");
const ago = loadJson("referencia-admin-ago-0108.json");

const report = {
  ok: true,
  checks: [],
  cadena: null,
  luisito: null,
  comparacion: null,
  errores: [],
};

function check(name, cond, detail) {
  report.checks.push({ name, ok: !!cond, detail });
  if (!cond) {
    report.ok = false;
    report.errores.push(`${name}: ${detail}`);
  }
}

// --- Parámetros JSON ---
check("jul_base", jul.mes_base === "2026-07" && jul.tasaUsd === 6085, `mes=${jul.mes_base} tasa=${jul.tasaUsd}`);
check("ago_ref", ago.mes_base === "2026-08" && Math.abs((ago.tasaUsd || 0) - 5970.96) < 0.01, `tasa=${ago.tasaUsd}`);
check("comp_base_mes", comp.base?.mes === "2026-07", JSON.stringify(comp.base));
check("comp_actual_mes", comp.actual?.mes === "2026-08", JSON.stringify(comp.actual));
check("luisito_mol", !!mol["luisito:cuadro"]?.gs, `gs=${mol["luisito:cuadro"]?.gs}`);

const luisitoTree = mol["luisito:cuadro"];
/** Tras integrar cadena: Cadena → Cliente → Factura */
const cliNodes = (luisitoTree?.children || []).flatMap((cad) => cad.children || []);
const codsLuisito = cliNodes
  .map((c) => {
    const m = String(c.label || "").match(/\((\d+)\)\s*$/);
    return m ? Number(m[1]) : null;
  })
  .filter(Boolean);

report.luisito = {
  gs: luisitoTree?.gs,
  n_cadenas: (luisitoTree?.children || []).length,
  n_clientes: cliNodes.length,
  n_facturas: cliNodes.reduce((a, c) => a + (c.children?.length || 0), 0),
  codigos: codsLuisito,
  fuente: luisitoTree?.fuente,
};

check(
  "luisito_suma_cadenas",
  Math.abs(
    (luisitoTree?.gs || 0) -
      (luisitoTree?.children || []).reduce((a, c) => a + (c.gs || 0), 0)
  ) < 1,
  "Σ cadenas = total"
);
check(
  "luisito_suma_clientes",
  Math.abs(
    (luisitoTree?.gs || 0) - cliNodes.reduce((a, c) => a + (c.gs || 0), 0)
  ) < 1,
  "Σ clientes = total"
);

const filasComp = comp.filas || [];
report.comparacion = {
  n: filasComp.length,
  con_pct: filasComp.filter((f) => f.pct_nexus_vs_jul != null).length,
  fidelidad_pct: comp.resumen?.fidelidad_pct,
  luisito_pct: filasComp.find((f) => f.concepto === "luisito")?.pct_nexus_vs_jul,
  cheques_pct: filasComp.find((f) => f.concepto === "cheques")?.pct_nexus_vs_jul,
};
check("comp_n_filas", filasComp.length >= 15, `n=${filasComp.length}`);
check("mapa_porFila", Object.keys(mapa.porFila || {}).length > 10, `n=${Object.keys(mapa.porFila || {}).length}`);

// --- Supabase: cliente_cadena_v2 ---
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

const cols = await client.query(`
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_schema='public'
    AND table_name IN ('cliente_cadena_v2','cadena_v2','cliente_v2')
  ORDER BY 1,2
`);
check("schema_cc", cols.rows.some((r) => r.table_name === "cliente_cadena_v2"), `cols=${cols.rows.length}`);

const nCc = await client.query(`SELECT COUNT(*)::int AS n FROM cliente_cadena_v2`);
const nCad = await client.query(`SELECT COUNT(*)::int AS n FROM cadena_v2`);

// TXT Cod_Cliente ≈ cliente_v2.id_cliente en RIMEC
const qLuisito = await client.query(
  `
  SELECT
    c.id_cliente,
    c.descp_cliente,
    cc.id_cadena,
    cad.descp_cadena
  FROM cliente_v2 c
  LEFT JOIN cliente_cadena_v2 cc ON cc.id_cliente = c.id_cliente
  LEFT JOIN cadena_v2 cad ON cad.id_cadena = cc.id_cadena
  WHERE c.id_cliente = ANY($1::int[])
  ORDER BY c.id_cliente, cc.id_cadena NULLS LAST
`,
  [codsLuisito]
);

const porCli = new Map();
for (const row of qLuisito.rows) {
  const id = String(row.id_cliente);
  if (!porCli.has(id)) porCli.set(id, []);
  porCli.get(id).push(row);
}

let conCadena = 0;
let sinCadena = 0;
const cadenas = {};
for (const cod of codsLuisito) {
  const rows = porCli.get(String(cod)) || [];
  const con = rows.filter((r) => r.id_cadena != null);
  if (con.length) {
    conCadena++;
    const nombre = String(con[0].descp_cadena || "SIN").trim();
    cadenas[nombre] = (cadenas[nombre] || 0) + 1;
  } else sinCadena++;
}

report.cadena = {
  n_cliente_cadena_v2: nCc.rows[0].n,
  n_cadena_v2: nCad.rows[0].n,
  luisito_codigos_consulta: codsLuisito.length,
  luisito_con_cadena: conCadena,
  luisito_sin_cadena: sinCadena,
  por_cadena: cadenas,
  detalle: qLuisito.rows,
};

check(
  "luisito_en_bd",
  qLuisito.rows.length >= codsLuisito.length,
  `rows=${qLuisito.rows.length} cods=${codsLuisito.length}`
);
check(
  "cobertura_cadena_luisito",
  conCadena + sinCadena === codsLuisito.length && conCadena > 0,
  `con=${conCadena} sin=${sinCadena}`
);

// Molecular ya enriquecido con nivel Cadena
const cadNodes = luisitoTree?.children || [];
const molCadenaOk =
  cadNodes.length > 0 &&
  String(cadNodes[0]?.label || "").startsWith("Cadena");
check(
  "mol_nivel_cadena",
  molCadenaOk,
  `hijos=${cadNodes.length} label0=${cadNodes[0]?.label}`
);
report.luisito.cadena_mol = (cadNodes || []).map((n) => ({
  label: n.label,
  gs: n.gs,
  n_clientes: (n.children || []).length,
}));

await client.end();

const outPath = path.join(SF, "audit-ejecucion-sf-cadena.json");
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify({ ok: report.ok, checks: report.checks, luisito: report.luisito, cadena: {
  n_cc: report.cadena.n_cliente_cadena_v2,
  n_cad: report.cadena.n_cadena_v2,
  luisito_con: report.cadena.luisito_con_cadena,
  luisito_sin: report.cadena.luisito_sin_cadena,
  por_cadena: report.cadena.por_cadena,
}, comparacion: report.comparacion, errores: report.errores }, null, 2));
console.log("OUT", outPath);
process.exit(report.ok ? 0 : 1);
