/**
 * Smoke — pool max=1 · sin deadlock import/logística PP
 * Uso: node scripts/_smoke_pool_deadlock_pp.mjs [ppId]
 */
import fs from "fs";
import pg from "pg";

const ppId = Number(process.argv[2] ?? 32);
const url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) {
  console.error("FAIL: DATABASE_URL ausente en .env.local");
  process.exit(1);
}
process.env.DATABASE_URL = url;
process.env.RIMEC_PG_POOL_MAX = "1";
process.env.VERCEL = "1";

const POOL_OPTS = {
  connectionString: url,
  max: 1,
  connectionTimeoutMillis: 8_000,
  ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
};

async function testPatronViejoDeadlock() {
  const pool = new pg.Pool(POOL_OPTS);
  const t0 = Date.now();
  let errMsg = "";
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const race = await Promise.race([
      pool.query("SELECT 1 AS ok").then((r) => ({ ok: true, row: r.rows[0] })),
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error("timeout exceeded when trying to connect (simulado)")), 9_000),
      ),
    ]);
    await client.query("ROLLBACK");
    await pool.end();
    return { name: "patron_viejo", deadlock: false, ms: Date.now() - t0, race };
  } catch (e) {
    errMsg = e instanceof Error ? e.message : String(e);
    await client.query("ROLLBACK").catch(() => undefined);
    client.release();
    await pool.end();
    return { name: "patron_viejo", deadlock: true, ms: Date.now() - t0, error: errMsg };
  }
}

async function testPatronNuevoSecuencial() {
  const pool = new pg.Pool(POOL_OPTS);
  const t0 = Date.now();
  const pre = await pool.query(
    "SELECT id, numero_registro, logistica_bandera_activa FROM pedido_proveedor WHERE id = $1",
    [ppId],
  );
  if (!pre.rows[0]) {
    await pool.end();
    return { name: "patron_nuevo", skip: true, reason: `PP ${ppId} no existe` };
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT 1");
    await client.query("COMMIT");
  } finally {
    client.release();
  }
  const post = await pool.query(
    "SELECT COUNT(*)::int AS n FROM pedido_proveedor_detalle WHERE pedido_proveedor_id = $1",
    [ppId],
  );
  await pool.end();
  return {
    name: "patron_nuevo",
    ok: true,
    ms: Date.now() - t0,
    pp: pre.rows[0],
    ppd: post.rows[0]?.n ?? 0,
  };
}

async function testLogisticaPublicar() {
  const { getRimecPool } = await import("../src/lib/rimec/pool.ts");
  const { activarLogisticaPp } = await import("../src/lib/logistica-ok/sync-pp.ts");
  const pool = getRimecPool();
  const t0 = Date.now();
  const fecha = new Date().toISOString().slice(0, 10);
  const r = await activarLogisticaPp(pool, ppId, fecha, null);
  return { name: "activar_logistica_pp", ms: Date.now() - t0, result: r };
}

async function testImportEngineCasoCtx() {
  const { getRimecPool } = await import("../src/lib/rimec/pool.ts");
  const { loadPpCasoContext } = await import("../src/lib/pedido-proveedor/pp-caso-context.ts");
  const pool = getRimecPool();
  const t0 = Date.now();
  const casoCtx = await loadPpCasoContext(pool, ppId);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT COUNT(*) FROM pedido_proveedor_detalle WHERE pedido_proveedor_id = $1", [ppId]);
    await client.query("COMMIT");
  } finally {
    client.release();
  }
  return {
    name: "import_caso_antes_tx",
    ok: true,
    ms: Date.now() - t0,
    fuente: casoCtx.fuente,
    casos: casoCtx.casosEvento.size,
  };
}

const results = [];
results.push(await testPatronViejoDeadlock());
results.push(await testPatronNuevoSecuencial());

try {
  results.push(await testImportEngineCasoCtx());
} catch (e) {
  results.push({
    name: "import_caso_antes_tx",
    ok: false,
    error: e instanceof Error ? e.message : String(e),
  });
}

try {
  results.push(await testLogisticaPublicar());
} catch (e) {
  results.push({
    name: "activar_logistica_pp",
    ok: false,
    error: e instanceof Error ? e.message : String(e),
  });
}

const failDeadlockNotRepro = !results[0]?.deadlock;
const failTimeout = results.some(
  (r) =>
    r.name !== "patron_viejo" &&
    r.error &&
    /timeout exceeded when trying to connect/i.test(String(r.error)),
);
const logisticaOk =
  results.find((r) => r.name === "activar_logistica_pp")?.result?.ok === true ||
  (results.find((r) => r.name === "activar_logistica_pp")?.result?.error &&
    !/timeout exceeded/i.test(String(results.find((r) => r.name === "activar_logistica_pp")?.result?.error)));

console.log(JSON.stringify({ ppId, results }, null, 2));

if (!results[0]?.deadlock) {
  console.error("\nWARN: patron_viejo no reprodujo deadlock en este entorno (pool local puede variar)");
} else {
  console.error("\nOK: patron_viejo reproduce el bug (2ª conexión con max=1 → timeout ~8s)");
}

if (failTimeout) {
  console.error("\nFAIL: timeout exceeded detectado en prueba");
  process.exit(1);
}

const importOk = results.find((r) => r.name === "import_caso_antes_tx")?.ok;
if (!importOk) {
  console.error("\nFAIL: import_caso_antes_tx");
  process.exit(1);
}

const logRes = results.find((r) => r.name === "activar_logistica_pp");
if (logRes?.error && /timeout exceeded/i.test(logRes.error)) {
  console.error("\nFAIL: logística timeout");
  process.exit(1);
}

console.log("\nPASS: sin timeout pool · import secuencial OK · logística respondió sin colgar");
process.exit(0);
