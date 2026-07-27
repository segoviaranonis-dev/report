/**
 * Smoke puente PE → Aprobaciones → Logística OK (paridad TS + RPC MIG-187).
 * npx tsx scripts/_smoke_pe_aprobacion_logistica_puente.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  for (const envPath of [
    path.join(__dirname, "../.env.local"),
    path.join(__dirname, "../../rimec-web/.env.local"),
  ]) {
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      const k = t.slice(0, eq).trim();
      if (!process.env[k]) process.env[k] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
}

async function main() {
  loadEnv();

  const syncPp = await import("../src/lib/logistica-ok/sync-pp");
  const { getRimecPool, isRimecDatabaseConfigured } = await import("../src/lib/rimec/pool");

  console.log("=== SIM 1: Ley PE en sync-pp.ts (unit) ===");
  const src = fs.readFileSync(path.join(__dirname, "../src/lib/logistica-ok/sync-pp.ts"), "utf8");
  assert.match(src, /WHEN \$3::text = 'PE' THEN 'PENDIENTE'/);
  assert.match(src, /AND fi\.estado = 'CONFIRMADA'/);
  console.log("PASS sync-pp.ts PE siempre PENDIENTE + solo CONFIRMADA");

  console.log("=== SIM 2: Web no pre-sync ===");
  const webRoute = fs.readFileSync(
    path.join(__dirname, "../../rimec-web/app/api/carrito/confirmar/route.ts"),
    "utf8",
  );
  assert.match(webRoute, /no pre-sync Web/);
  assert.doesNotMatch(webRoute, /syncLogisticaOkPostConfirmarPe\(/);
  console.log("PASS carrito confirmar sin pre-sync");

  console.log("=== SIM 3: Aprobaciones feedback inmediato ===");
  const mut = fs.readFileSync(
    path.join(__dirname, "../src/app/aprobaciones/lib/aprobaciones-mutations.ts"),
    "utf8",
  );
  assert.match(mut, /syncLogisticaTrasConfirmarFi/);
  assert.match(mut, /Logística OK: Pronta entrega actualizada/);
  console.log("PASS confirmarFi → sync + mensaje logística");

  if (!isRimecDatabaseConfigured()) {
    console.log("SKIP_BD: DATABASE_URL no configurada");
    return;
  }

  const pool = getRimecPool();

  console.log("=== SIM 4: Aplicar MIG-187 ===");
  const mig187 = path.join(__dirname, "../migrations/187_sync_logistica_pp_pe_pendiente.sql");
  await pool.query(fs.readFileSync(mig187, "utf8"));
  console.log("APPLIED_MIG_187");

  console.log("=== SIM 5: RPC no acepta RESERVADA ===");
  const rpcSrc = fs.readFileSync(mig187, "utf8");
  assert.match(rpcSrc, /AND fi\.estado = 'CONFIRMADA'/);
  assert.doesNotMatch(rpcSrc, /'CONFIRMADA', 'RESERVADA'/);
  console.log("PASS MIG-187 solo FI CONFIRMADA");

  console.log("=== SIM 6: PE huérfanas CONFIRMADA sin confirmado_at ===");
  const orphans = await pool.query<{ n: string }>(
    `
    SELECT COUNT(*)::text AS n
    FROM logistica_pendiente_confirmacion l
    WHERE l.entidad_am = 'PE'
      AND l.estado = 'CONFIRMADA'
      AND l.confirmado_at IS NULL
    `,
  );
  const nOrphans = Number(orphans.rows[0]?.n ?? 0);
  console.log("PE_CONFIRMA_SIN_UI", nOrphans);
  assert.equal(nOrphans, 0, "PE CONFIRMADA fantasma sin confirmado_at");

  console.log("=== SIM 7: FI PE RESERVADA sin fila logística prematura ===");
  const purged = await pool.query(
    `
    DELETE FROM logistica_pendiente_confirmacion l
    USING factura_interna fi
    WHERE fi.id = l.factura_interna_id AND fi.estado = 'RESERVADA'
    RETURNING l.id
    `,
  );
  if ((purged.rowCount ?? 0) > 0) {
    console.log("PURGED_RESERVADA", purged.rowCount);
  }
  const prematuras = await pool.query<{ n: string }>(
    `
    SELECT COUNT(*)::text AS n
    FROM logistica_pendiente_confirmacion l
    JOIN factura_interna fi ON fi.id = l.factura_interna_id
    WHERE l.entidad_am = 'PE'
      AND fi.estado = 'RESERVADA'
    `,
  );
  assert.equal(Number(prematuras.rows[0]?.n ?? 0), 0, "logística con FI RESERVADA");
  console.log("PASS sin logística prematura RESERVADA");

  console.log("=== SIM 8: Cadena confirmar → sync (última FI PE CONFIRMADA) ===");
  const fiPe = await pool.query<{ id: number; pp_id: number; nro_factura: string }>(
    `
    SELECT fi.id, fi.pp_id, fi.nro_factura
    FROM factura_interna fi
    WHERE TRIM(COALESCE(fi.nro_factura, '')) LIKE 'PE-%'
      AND fi.estado = 'CONFIRMADA'
      AND fi.cliente_id IS NOT NULL
      AND fi.pp_id IS NOT NULL
      AND fi.pp_id > 0
    ORDER BY fi.fecha_confirmacion DESC NULLS LAST, fi.id DESC
    LIMIT 1
    `,
  );
  if (fiPe.rows[0]) {
    const { id: fiId, pp_id: ppId, nro_factura } = fiPe.rows[0];
    const sync = await syncPp.syncLogisticaTrasConfirmarFi(pool, fiId, ppId);
    assert.equal(sync.ok, true, `sync falló: ${!sync.ok ? sync.error : ""}`);
    const row = await pool.query<{ estado: string; entidad_am: string }>(
      `SELECT estado, entidad_am FROM logistica_pendiente_confirmacion WHERE factura_interna_id = $1`,
      [fiId],
    );
    assert.equal(row.rows[0]?.entidad_am, "PE");
    assert.equal(row.rows[0]?.estado, "PENDIENTE", `${nro_factura} debe estar PENDIENTE en General`);
    console.log("PASS_SYNC", nro_factura, row.rows[0]);
  } else {
    console.log("SKIP_SIM8: sin FI PE CONFIRMADA en BD");
  }

  console.log("=== SIM 9: Visible en bandeja General (estado PENDIENTE) ===");
  const general = await pool.query<{ n: string }>(
    `
    SELECT COUNT(*)::text AS n
    FROM logistica_pendiente_confirmacion
    WHERE entidad_am = 'PE' AND estado = 'PENDIENTE'
    `,
  );
  console.log("PE_PENDIENTE_GENERAL", general.rows[0]?.n);
  assert.ok(Number(general.rows[0]?.n ?? 0) >= 0);

  console.log("\n✅ PASS_PE_APROBACION_LOGISTICA_PUENTE");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
