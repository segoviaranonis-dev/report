/**
 * Smoke: PE = SDRM venta hoy (stock qty>0) · sin gemelos 654 en 638.
 * npx tsx scripts/_smoke_lr_filtro_pe_deposito.ts
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import pg from "pg";
import { loadLineaReferencia, loadLineaReferenciaCascada } from "../src/lib/pilares/queries";

const envPath = resolve(__dirname, "../.env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    process.env[t.slice(0, eq).trim()] ??= t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
}

const FALSOS_654 = new Set(["8564", "8568", "8571", "8585", "8620"]);

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL!,
    ssl: { rejectUnauthorized: false },
  });

  const todos = await loadLineaReferencia(pool, 2, { limit: 1, offset: 0 });
  const pe = await loadLineaReferencia(pool, 2, {
    limit: 50,
    offset: 0,
    origenTipo: "PRONTA_ENTREGA",
  });
  const d3 = await loadLineaReferencia(pool, 2, {
    limit: 200,
    offset: 0,
    depositoCodigo: "D3",
  });
  const cascada = await loadLineaReferenciaCascada(pool, 2, {
    origenTipo: "PRONTA_ENTREGA",
  });

  const leak = d3.rows.filter((r) => FALSOS_654.has(String(r.linea_codigo)));
  const topEstilos = cascada.estilos.slice(0, 5).map((e) => `${e.label}:${e.count}`);

  console.log({
    todos: todos.total,
    pe: pe.total,
    d3: d3.total,
    sampleD3: d3.rows.slice(0, 3).map((r) => `${r.linea_codigo}.${r.referencia_codigo}`),
    leakFalsos654: leak.map((r) => r.linea_codigo),
    topEstilos,
  });

  const ok =
    pe.total > 0 &&
    d3.total > 0 &&
    d3.total <= todos.total &&
    pe.total <= todos.total &&
    leak.length === 0 &&
    cascada.estilos.length > 0 &&
    cascada.estilos[0].count >= (cascada.estilos[1]?.count ?? 0);

  console.log(ok ? "PASS_LR_PE_DEPOSITO" : "FAIL_LR_PE_DEPOSITO");
  await pool.end();
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
