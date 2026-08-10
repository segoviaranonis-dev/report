/**
 * Ratificación MIG-206 · paridad Web↔BD confirmar PE LPC
 * Exit 0 = PASS · Exit 1 = FAIL
 */
import fs from "fs";
import pg from "pg";

const env = fs.readFileSync(".env.local", "utf8");
const url = env
  .match(/^DATABASE_URL=(.+)$/m)[1]
  .trim()
  .replace(/^["']|["']$/g, "");
const pool = new pg.Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

let fails = 0;
function assert(name, cond, detail = "") {
  if (cond) console.log("PASS", name, detail);
  else {
    fails++;
    console.log("FAIL", name, detail);
  }
}

const centena = (n) => Math.round(Number(n) / 100) * 100;

// 1) Definición fn
const def = await pool.query(
  `SELECT pg_get_functiondef(oid) AS d FROM pg_proc WHERE proname='fn_precio_tier_vista' LIMIT 1`
);
const body = def.rows[0]?.d || "";
assert("fn_tiene_ley_112", body.includes("p_lpn * 1.12"));
assert("fn_tiene_ley_120", body.includes("p_lpn * 1.20"));
assert("fn_respeta_lpc_distinto", body.includes("IS DISTINCT FROM"));

// 2) Casos unitarios (paridad resolverLpcTier)
const cases = [
  {
    name: "PE_null_lpc03_lista3",
    args: [3, 63800, null, null, null, "PE · sdrm3901"],
    expect: centena(63800 * 1.12),
  },
  {
    name: "PE_null_lpc04_lista4",
    args: [4, 63800, null, null, null, "PE · sdrm3901"],
    expect: centena(63800 * 1.2),
  },
  {
    name: "lista1_lpn",
    args: [1, 63800, null, null, null, "X"],
    expect: 63800,
  },
  {
    name: "promo_lista3_usa_lpn",
    args: [3, 63800, null, 99999, null, "PROMOCIONAL"],
    expect: 63800,
  },
  {
    name: "lpc03_real_distinto_lpn",
    args: [3, 63800, null, 72000, null, "REGULAR"],
    expect: 72000,
  },
  {
    name: "lpc03_pegado_lpn_aplica_factor",
    args: [3, 63800, null, 63800, null, "REGULAR"],
    expect: centena(63800 * 1.12),
  },
  {
    name: "patricia_177089",
    args: [3, 63800, null, null, null, "PE · sdrm3901"],
    expect: 71500,
  },
];

for (const c of cases) {
  const r = await pool.query(
    `SELECT public.fn_precio_tier_vista($1,$2,$3,$4,$5,$6) AS p`,
    c.args
  );
  const got = Number(r.rows[0].p);
  assert(c.name, got === c.expect, `got=${got} expect=${c.expect}`);
}

// 3) Universo PE: drift vs ley Web
const pe = await pool.query(`
  SELECT
    count(*)::int AS n,
    count(*) FILTER (WHERE COALESCE(lpc03,0)=0 AND COALESCE(lpn,0)>0)::int AS null_lpc03,
    count(*) FILTER (
      WHERE COALESCE(lpn,0)>0
        AND UPPER(TRIM(COALESCE(descp_caso,''))) IS DISTINCT FROM 'PROMOCIONAL'
        AND public.fn_precio_tier_vista(3, lpn, lpc02, lpc03, lpc04, descp_caso)
          IS DISTINCT FROM public.redondear_centena_gs(
            CASE
              WHEN COALESCE(lpc03,0)>0
                AND public.redondear_centena_gs(lpc03)
                  IS DISTINCT FROM public.redondear_centena_gs(lpn)
              THEN lpc03
              ELSE lpn * 1.12
            END
          )
    )::int AS drift3,
    count(*) FILTER (
      WHERE COALESCE(lpn,0)>0
        AND UPPER(TRIM(COALESCE(descp_caso,''))) IS DISTINCT FROM 'PROMOCIONAL'
        AND public.fn_precio_tier_vista(4, lpn, lpc02, lpc03, lpc04, descp_caso)
          IS DISTINCT FROM public.redondear_centena_gs(
            CASE
              WHEN COALESCE(lpc04,0)>0
                AND public.redondear_centena_gs(lpc04)
                  IS DISTINCT FROM public.redondear_centena_gs(lpn)
              THEN lpc04
              ELSE lpn * 1.20
            END
          )
    )::int AS drift4
  FROM v_stock_pe_rimec
`);
console.log("pe_universo", pe.rows[0]);
assert("pe_drift_lista3_0", pe.rows[0].drift3 === 0, String(pe.rows[0].drift3));
assert("pe_drift_lista4_0", pe.rows[0].drift4 === 0, String(pe.rows[0].drift4));

// 4) Simular gate confirmar PE (COALESCE fn, lpn) — no debe caer a LPN si hay ley
const gate = await pool.query(`
  SELECT count(*)::int AS cae_a_lpn
  FROM v_stock_pe_rimec vs
  WHERE COALESCE(vs.lpn,0) > 0
    AND UPPER(TRIM(COALESCE(vs.descp_caso,''))) IS DISTINCT FROM 'PROMOCIONAL'
    AND COALESCE(
      NULLIF(public.fn_precio_tier_vista(3, vs.lpn, vs.lpc02, vs.lpc03, vs.lpc04, vs.descp_caso), 0),
      vs.lpn
    ) = vs.lpn
    AND public.redondear_centena_gs(vs.lpn * 1.12) IS DISTINCT FROM vs.lpn
`);
assert(
  "confirmar_no_cae_lpn_si_debe_factor",
  gate.rows[0].cae_a_lpn === 0,
  String(gate.rows[0].cae_a_lpn)
);

// 5) Carrito Patricia
const pat = await pool.query(`
  SELECT ci.det_id, vs.lpn,
    public.fn_precio_tier_vista(3, vs.lpn, vs.lpc02, vs.lpc03, vs.lpc04, vs.descp_caso) AS tier3,
    public.redondear_centena_gs(vs.lpn * 1.12) AS web,
    ci.precio_snapshot,
    ci.cantidad_cajas
  FROM carrito_item ci
  JOIN v_stock_pe_rimec vs ON vs.det_id = ci.det_id
  WHERE ci.id_usuario = 41
`);
let pok = 0;
for (const r of pat.rows) {
  const ok = Number(r.tier3) === Number(r.web);
  if (ok) pok++;
  else console.log("PAT_DIFF", r);
}
assert("patricia_carrito_paridad", pok === pat.rows.length, `${pok}/${pat.rows.length}`);

// 6) Sample CP: si lpc03 distinto, fn lo respeta (no romper CP)
const cp = await pool.query(`
  SELECT det_id, lpn, lpc03,
    public.fn_precio_tier_vista(3, lpn, lpc02, lpc03, lpc04, descp_caso) AS tier3
  FROM v_stock_rimec
  WHERE COALESCE(lpc03,0) > 0
    AND public.redondear_centena_gs(lpc03) IS DISTINCT FROM public.redondear_centena_gs(lpn)
    AND COALESCE(lpn,0) > 0
  LIMIT 20
`);
let cpOk = 0;
for (const r of cp.rows) {
  if (Number(r.tier3) === centena(r.lpc03)) cpOk++;
  else console.log("CP_DIFF", r);
}
assert("cp_respeta_lpc03_almacenado", cp.rows.length === 0 || cpOk === cp.rows.length, `${cpOk}/${cp.rows.length}`);

console.log("\n=== RESULTADO ===", fails === 0 ? "PASS" : `FAIL x${fails}`);
await pool.end();
process.exit(fails === 0 ? 0 : 1);
