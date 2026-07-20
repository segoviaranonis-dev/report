/**
 * Smoke integridad KPIs reposición
 * Uso: npx tsx scripts/smoke_integridad_reposicion.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import pg from "pg";
import { getHerramientaReposicion } from "../src/lib/herramienta-reposicion/queries";
import {
  auditarIntegridadReposicion,
  kpisDesdeArticulos,
} from "../src/lib/herramienta-reposicion/totales-reposicion";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) {
  console.error("DATABASE_URL no encontrada");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });

async function main() {
  await client.connect();
  try {
    const { articulos, kpis } = await getHerramientaReposicion(client);
    const sum = kpisDesdeArticulos(articulos);
    assert.deepEqual(kpis, sum, "API kpis !== suma tarjetas");

    const sumAm =
      kpis.peDisponible +
      kpis.cpDisponible +
      kpis.ppAbierto +
      kpis.cpVendido +
      kpis.programado;
    const sumStock = kpis.peDisponible + kpis.cpDisponible + kpis.ppAbierto;
    assert.equal(
      articulos.reduce((s, a) => s + a.totales.peDisponible + a.totales.cpDisponible + a.totales.ppAbierto, 0),
      sumStock,
      "Σ stock molecular !== KPI PE+CP+PP",
    );
    assert.equal(
      articulos.reduce(
        (s, a) =>
          s +
          a.totales.peDisponible +
          a.totales.cpDisponible +
          a.totales.ppAbierto +
          a.totales.cpVendido +
          a.totales.programado,
        0,
      ),
      sumAm,
      "Σ AM molecular !== KPI 5 ejes",
    );

    const issues = auditarIntegridadReposicion(articulos);
    if (issues.length > 0) {
      console.error("integridad FAIL", issues.slice(0, 5));
      process.exit(1);
    }
    console.log("integridad_ok", {
      moleculas: kpis.moleculas,
      pe: kpis.peDisponible,
      cp: kpis.cpDisponible,
      pp: kpis.ppAbierto,
      vend: kpis.cpVendido,
      prog: kpis.programado,
      sum_am: sumAm,
    });
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
