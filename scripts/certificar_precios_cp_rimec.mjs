/**
 * Certificación integridad precios CP → RIMEC Web (6 gates).
 * Exit 0 = CERTIFICADO OK · Exit 1 = FAIL
 *
 * Uso:
 *   node scripts/certificar_precios_cp_rimec.mjs
 *   node scripts/certificar_precios_cp_rimec.mjs 7
 *   node scripts/certificar_precios_cp_rimec.mjs --sync   # sync G3 + recalc FI G4 + carrito G5
 *   node scripts/certificar_precios_cp_rimec.mjs --json
 */
import fs from "fs";
import pg from "pg";
import { spawnSync } from "child_process";

const jsonOut = process.argv.includes("--json");
const doSync = process.argv.includes("--sync");
const ppArg = process.argv.slice(2).map(Number).find(Number.isFinite);

const url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(2);
}

const pool = new pg.Pool({ connectionString: url });

async function runCert(ppId) {
  const { rows } = await pool.query(
    `SELECT certificar_precios_cp_rimec($1) AS c`,
    [ppId ?? null],
  );
  return rows[0].c;
}

async function syncPp(id) {
  const { rows } = await pool.query(`SELECT sincronizar_precios_vinculados_cp($1) AS r`, [id]);
  return rows[0].r;
}

async function fixCarrito(ppIds) {
  const fix = await pool.query(
    `
    UPDATE carrito_item ci
    SET precio_snapshot = v.lpn, actualizado_en = NOW()
    FROM v_stock_rimec v
    WHERE v.det_id = ci.det_id AND v.pp_id = ANY($1::int[])
      AND COALESCE(v.lpn, 0) > 0
      AND ci.precio_snapshot IS DISTINCT FROM v.lpn
    RETURNING ci.det_id
    `,
    [ppIds],
  );
  return fix.rowCount;
}

function recalcFi(ppIds) {
  if (!ppIds.length) return;
  const r = spawnSync("npx", ["tsx", "scripts/_recalc_fi_pp.mjs", ...ppIds.map(String)], {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: true,
  });
  if (r.status !== 0) console.warn("recalc FI exit", r.status);
}

let cert = await runCert(ppArg);

if (doSync && !cert.ok) {
  const ids = ppArg ? [ppArg] : cert.pp_ids ?? [];

  if (cert.gates.G3_ppd_vs_listado_canon > 0) {
    for (const id of ids) {
      const r = await syncPp(id);
      if (r.success) console.log(`sync PP ${id}: ${r.filas_actualizadas} filas`);
    }
  }

  cert = await runCert(ppArg);

  if (cert.gates.G4_fi_vs_ppd > 0) {
    console.log(`recalc FI (${cert.gates.G4_fi_vs_ppd} líneas desalineadas)...`);
    recalcFi(ids.filter((id) => id > 0));
    cert = await runCert(ppArg);
  }

  if (cert.gates.G5_carrito_vs_web > 0) {
    const n = await fixCarrito(ids);
    console.log(`carrito snapshots alineados: ${n}`);
    cert = await runCert(ppArg);
  }
}

await pool.end();

const stamp = new Date().toISOString().slice(0, 19).replace("T", " ");
const label = cert.ok ? "✅ CERTIFICADO OK" : "❌ CERTIFICADO FAIL";

if (jsonOut) {
  console.log(JSON.stringify({ stamp, ...cert }, null, 2));
} else {
  console.log(`\n=== ${label} — CP RIMEC Web ===`);
  console.log(`Timestamp: ${cert.ts ?? stamp}`);
  console.log(`PPs auditados: ${(cert.pp_ids ?? []).length}`);
  if (cert.listado_drift > 0) {
    console.log(`⚠ Listado Motor drift (re-vincular): ${cert.listado_drift} filas`);
  }
  console.log("\nGates (integridad venta):");
  const g = cert.gates;
  console.log(`  G1 PPD sin LPN (catálogo):     ${g.G1_ppd_sin_lpn}`);
  console.log(`  G2 Web v_stock ≠ PPD:          ${g.G2_web_vs_ppd}`);
  console.log(`  G3 PPD ≠ listado (aviso):      ${g.G3_ppd_vs_listado_canon}`);
  console.log(`  G4 FI tier ≠ PPD vinculado:    ${g.G4_fi_vs_ppd}`);
  console.log(`  G5 Carrito ≠ Web LPN:          ${g.G5_carrito_vs_web}`);
  console.log(`  G6 Vista solo PPD (MIG-176):   ${g.G6_vista_solo_ppd ? "PASS" : "FAIL"}`);
}

process.exit(cert.ok ? 0 : 1);
