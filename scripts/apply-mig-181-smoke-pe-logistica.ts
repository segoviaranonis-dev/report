/**
 * Apply MIG-181 + backfill PE pp_id + smoke integridad puente Logística.
 * npx tsx scripts/apply-mig-181-smoke-pe-logistica.ts
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

async function main() {
  loadEnv();

  const { getRimecPool, isRimecDatabaseConfigured } = await import("../src/lib/rimec/pool");
  const {
    esNroFacturaPe,
    rigorFiPeLogistica,
    FECHA_ENTREGA_REAL_LABEL,
  } = await import("../src/lib/logistica-ok/pe-pp-contrato");

  assert(esNroFacturaPe("PE-217-001"), "nro PE");
  assert(!rigorFiPeLogistica({ nro_factura: "PE-1", pp_id: null }).ok, "sin pp_id");
  assert(
    !rigorFiPeLogistica({
      nro_factura: "PE-1",
      pp_id: 57,
      fecha_arribo_real: null,
    }).ok,
    "sin fecha",
  );
  assert(
    rigorFiPeLogistica({
      nro_factura: "PE-1",
      pp_id: 57,
      fecha_arribo_real: "2026-07-25",
    }).ok,
    "rigor ok",
  );
  console.log("PASS_CONTRATO", FECHA_ENTREGA_REAL_LABEL);

  if (!isRimecDatabaseConfigured()) {
    console.log("SKIP_BD: DATABASE_URL no configurada");
    return;
  }

  const pool = getRimecPool();
  const migPath = path.join(__dirname, "../migrations/181_sync_logistica_pp_if_bandera.sql");
  await pool.query(fs.readFileSync(migPath, "utf8"));
  console.log("APPLIED_MIG_181");

  const backfillExists = await pool.query(
    `SELECT 1 FROM pg_proc WHERE proname = 'fi_pe_backfill_pp_id' LIMIT 1`,
  );
  if (backfillExists.rowCount) {
    const { rows } = await pool.query(`SELECT * FROM public.fi_pe_backfill_pp_id()`);
    console.log("BACKFILL", rows[0]);
  } else {
    console.log("SKIP_BACKFILL: fi_pe_backfill_pp_id ausente (MIG-173)");
  }

  const orphans = await pool.query<{ n: string }>(
    `
    SELECT COUNT(*)::text AS n
    FROM factura_interna fi
    WHERE TRIM(COALESCE(fi.nro_factura, '')) LIKE 'PE-%'
      AND fi.estado IN ('CONFIRMADA', 'RESERVADA')
      AND (fi.pp_id IS NULL OR fi.pp_id <= 0)
    `,
  );
  console.log("PE_ORPHANS_PP_NULL", Number(orphans.rows[0]?.n ?? 0));

  const fn = await pool.query(
    `SELECT 1 FROM pg_proc WHERE proname = 'sync_logistica_pp_if_bandera' LIMIT 1`,
  );
  assert(Boolean(fn.rowCount), "sync_logistica_pp_if_bandera debe existir");

  const pePp = await pool.query<{ id: number }>(
    `
    SELECT pp.id
    FROM pedido_proveedor pp
    JOIN quincena_arribo qa ON qa.id = pp.quincena_arribo_id
    WHERE pp.entidad_comercial = 'STOCK'
      AND lower(trim(qa.descripcion)) = lower('Pronta entrega')
      AND pp.deposito_codigo IS NOT NULL
    ORDER BY pp.logistica_bandera_activa DESC NULLS LAST, pp.id DESC
    LIMIT 1
    `,
  );
  if (pePp.rows[0]) {
    const ppId = Number(pePp.rows[0].id);
    const { rows: syncRows } = await pool.query(
      `SELECT public.sync_logistica_pp_if_bandera($1::int) AS r`,
      [ppId],
    );
    console.log("SMOKE_SYNC_PP", ppId, syncRows[0]);
    const pend = await pool.query(
      `
      SELECT COUNT(*)::int AS n,
             COUNT(*) FILTER (WHERE fecha_orden IS NOT NULL)::int AS con_fecha
      FROM logistica_pendiente_confirmacion
      WHERE pedido_proveedor_id = $1 AND entidad_am = 'PE'
      `,
      [ppId],
    );
    console.log("LOGISTICA_PE_FILAS", pend.rows[0]);
  } else {
    console.log("SKIP_SMOKE_PP: sin PP PE en BD");
  }

  console.log("PASS_PE_LOGISTICA_FECHA_BD");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
