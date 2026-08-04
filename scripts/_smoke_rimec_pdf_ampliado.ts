/**
 * Pruebas ampliadas PDF Sales Report: motor + filas snapshot + batch + magics.
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { generateRimecGerencialPdf, metaFromSnapshot } from "../src/lib/rimec/pdf-gerencial";
import { generateRimecBatchZip } from "../src/lib/rimec/pdf-batch";
import {
  rowsCarteraCompleta,
  rowsDetalleOperativo,
  rowsEvolucion,
  rowsRankingMarcas,
  rowsRankingVendedores,
} from "../src/lib/rimec/pdf-rows-from-snapshot";
import type { FullSnapshotResponse } from "../src/lib/rimec/full-snapshot-types";
import { ALIAS_CURRENT_VALUE, ALIAS_TARGET_VALUE, ALIAS_VARIATION } from "../src/modules/sales-report/constants";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function isPdf(buf: Uint8Array) {
  return buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46;
}
function isZip(buf: Uint8Array) {
  return buf[0] === 0x50 && buf[1] === 0x4b;
}

const mockSnap: FullSnapshotResponse = {
  configured: true,
  kpis: {
    monto_periodo: 1_000_000,
    monto_objetivo: 900_000,
    variacion_pct: 11.1,
    clientes_activos: 3,
    monto_periodo_anterior: 800_000,
  },
  evolucion_mensual: [
    { mes: "Enero", real_2026: 100, objetivo: 90, real_2025: 80, desvio_pct: 11.1 },
    { mes: "Febrero", real_2026: 110, objetivo: 95, real_2025: 85, desvio_pct: 15.8 },
  ],
  participacion: {
    y2025: {
      calzado: { monto: 1, pct: 50 },
      confeccion: { monto: 1, pct: 50 },
    },
    y2026: {
      calzado: { monto: 1, pct: 50 },
      confeccion: { monto: 1, pct: 50 },
    },
  },
  clientes_crecimiento: [
    {
      id_cliente: 1,
      codigo: "1",
      nombre: "Cliente A",
      cadena: "Cadena X",
      monto_2026: 120000,
      monto_2025: 100000,
      objetivo: 110000,
      variacion_pct: 20,
      marca_principal: "VIZZANO",
    },
  ],
  clientes_riesgo: [
    {
      id_cliente: 2,
      codigo: "2",
      nombre: "Cliente B",
      cadena: "Cadena Y",
      monto_2026: 50000,
      monto_2025: 80000,
      objetivo: 90000,
      variacion_pct: -37.5,
      marca_principal: "MOLECA",
    },
  ],
  clientes_sin_compra: [
    {
      id_cliente: 3,
      codigo: "3",
      nombre: "Cliente C",
      cadena: "Cadena Z",
      ultimo_monto: 10000,
      objetivo: 12000,
      ultimo_mes: "Diciembre",
    },
  ],
  ranking_marcas: [
    {
      marca: "VIZZANO",
      monto_2026: 200000,
      monto_2025: 150000,
      objetivo: 180000,
      variacion_pct: 11.1,
      cumplimiento_pct: 111.1,
    },
    {
      marca: "MOLECA",
      monto_2026: 90000,
      monto_2025: 100000,
      objetivo: 100000,
      variacion_pct: -10,
      cumplimiento_pct: 90,
    },
  ],
  ranking_vendedores: [
    {
      vendedor: "ATI",
      monto_2026: 150000,
      monto_2025: 120000,
      objetivo: 140000,
      variacion_pct: 7.1,
      cumplimiento_pct: 107.1,
      clientes_activos: 2,
    },
    {
      vendedor: "PATRICIA",
      monto_2026: 80000,
      monto_2025: 90000,
      objetivo: 95000,
      variacion_pct: -15.8,
      cumplimiento_pct: 84.2,
      clientes_activos: 1,
    },
  ],
  detalle_operativo: [
    {
      marca: "VIZZANO",
      cadena: "Cadena X",
      cliente: "Cliente A",
      vendedor: "ATI",
      mes: "Enero",
      mes_idx: 1,
      [ALIAS_CURRENT_VALUE]: 100000,
      [ALIAS_TARGET_VALUE]: 90000,
      [ALIAS_VARIATION]: 11.1,
    },
    {
      marca: "VIZZANO",
      cadena: "Cadena X",
      cliente: "Cliente A",
      vendedor: "ATI",
      mes: "Febrero",
      mes_idx: 2,
      [ALIAS_CURRENT_VALUE]: 100000,
      [ALIAS_TARGET_VALUE]: 90000,
      [ALIAS_VARIATION]: 11.1,
    },
    {
      marca: "MOLECA",
      cadena: "Cadena Y",
      cliente: "Cliente B",
      vendedor: "PATRICIA",
      mes: "Enero",
      mes_idx: 1,
      [ALIAS_CURRENT_VALUE]: 50000,
      [ALIAS_TARGET_VALUE]: 60000,
      [ALIAS_VARIATION]: -16.7,
    },
  ],
  jerarquia_clientes: [
    {
      id_cadena: 1,
      descp_cadena: "Cadena X",
      id_cliente: 1,
      descp_cliente: "Cliente A",
      id_marca: 10,
      descp_marca: "VIZZANO",
      mes_idx: 1,
      monto_2025: 90000,
      monto_2026: 100000,
      monto_objetivo: 90000,
      variacion_vs_objetivo_pct: 11.1,
    },
    {
      id_cadena: 1,
      descp_cadena: "Cadena X",
      id_cliente: 1,
      descp_cliente: "Cliente A",
      id_marca: 11,
      descp_marca: "MOLECA",
      mes_idx: 1,
      monto_2025: 10000,
      monto_2026: 20000,
      monto_objetivo: 20000,
      variacion_vs_objetivo_pct: 0,
    },
    {
      id_cadena: 2,
      descp_cadena: "Cadena Y",
      id_cliente: 2,
      descp_cliente: "Cliente B",
      id_marca: 11,
      descp_marca: "MOLECA",
      mes_idx: 1,
      monto_2025: 80000,
      monto_2026: 50000,
      monto_objetivo: 60000,
      variacion_vs_objetivo_pct: -16.7,
    },
  ],
  meta: {
    periodo: "Enero-Febrero 2026",
    objetivo_pct: 20,
    departamento: "CALZADOS",
    generado_at: new Date().toISOString(),
  },
  cascada: {
    departamentos: ["CALZADOS"],
    categorias: [],
    meses_nombres: ["Enero", "Febrero"],
    marcas: ["VIZZANO", "MOLECA"],
    cadenas: [],
    vendedores: [],
  },
};

async function main() {
  const outDir = join(process.cwd(), "tmp", "smoke-pdf-rimec");
  mkdirSync(outDir, { recursive: true });
  const meta = metaFromSnapshot(mockSnap.meta);
  const results: { name: string; bytes: number; ok: boolean }[] = [];

  // 1 Evolucion — Semestre · Mes · Monto Obj · Monto 26 · Variación %
  {
    const rows = rowsEvolucion(mockSnap);
    assert(rows.length === 2, "evol rows");
    assert(
      Object.keys(rows[0]).join("|") ===
        `Semestre|Mes|${ALIAS_TARGET_VALUE}|${ALIAS_CURRENT_VALUE}|${ALIAS_VARIATION}`,
      `evol cols=${Object.keys(rows[0]).join("|")}`,
    );
    const pdf = await generateRimecGerencialPdf({
      title: "Evolucion Mensual",
      rows,
      groupCols: ["Semestre"],
      meta,
      showTotal: true,
    });
    assert(isPdf(pdf), "evol %PDF");
    writeFileSync(join(outDir, "01_evolucion.pdf"), pdf);
    results.push({ name: "evolucion", bytes: pdf.byteLength, ok: true });
  }

  // 2 Cartera — Cadena→Cliente→Marca→Mes
  {
    const rows = rowsCarteraCompleta(mockSnap);
    assert(rows.length >= 3, `cartera rows=${rows.length}`);
    assert("Mes" in rows[0] && !("Estado" in rows[0]), "cartera cols con Mes sin Estado");
    const pdf = await generateRimecGerencialPdf({
      title: "Cartera Completa",
      rows,
      groupCols: ["Cadena", "Cliente", "Marca", "Mes"],
      meta,
    });
    assert(isPdf(pdf), "cartera %PDF");
    writeFileSync(join(outDir, "02_cartera.pdf"), pdf);
    results.push({ name: "cartera", bytes: pdf.byteLength, ok: true });
  }

  // 3 Ranking marcas — Streamlit: Marca · Monto Obj · Monto 26 · Variación %
  {
    const rows = rowsRankingMarcas(mockSnap);
    assert(
      Object.keys(rows[0]).join("|") ===
        `Marca|${ALIAS_TARGET_VALUE}|${ALIAS_CURRENT_VALUE}|${ALIAS_VARIATION}`,
      `ranking marcas cols=${Object.keys(rows[0]).join("|")}`,
    );
    const pdf = await generateRimecGerencialPdf({ title: "Ranking de Marcas", rows, meta });
    assert(isPdf(pdf), "marcas ranking %PDF");
    writeFileSync(join(outDir, "03_ranking_marcas.pdf"), pdf);
    results.push({ name: "ranking_marcas", bytes: pdf.byteLength, ok: true });
  }

  // 4 Batch marcas
  {
    const rows = rowsDetalleOperativo(mockSnap);
    assert(rows.length === 3, "detalle rows");
    const { zip, count } = await generateRimecBatchZip({
      titlePrefix: "Matriz de Marca",
      rows,
      batchCol: "Marca",
      groupCols: ["Marca", "Cadena", "Cliente", "Vendedor"],
      meta,
    });
    assert(count === 2, `batch marcas count=${count}`);
    assert(isZip(zip), "batch marcas ZIP");
    writeFileSync(join(outDir, "04_batch_marcas.zip"), zip);
    results.push({ name: "batch_marcas", bytes: zip.byteLength, ok: true });
  }

  // 5 Ranking vendedores — Streamlit: Vendedor · Monto Obj · Monto 26 · Variación %
  {
    const rows = rowsRankingVendedores(mockSnap);
    assert(
      Object.keys(rows[0]).join("|") ===
        `Vendedor|${ALIAS_TARGET_VALUE}|${ALIAS_CURRENT_VALUE}|${ALIAS_VARIATION}`,
      `ranking vend cols=${Object.keys(rows[0]).join("|")}`,
    );
    const pdf = await generateRimecGerencialPdf({ title: "Ranking de Vendedores", rows, meta });
    assert(isPdf(pdf), "vend ranking %PDF");
    writeFileSync(join(outDir, "05_ranking_vendedores.pdf"), pdf);
    results.push({ name: "ranking_vendedores", bytes: pdf.byteLength, ok: true });
  }

  // 6 Batch vendedores
  {
    const rows = rowsDetalleOperativo(mockSnap);
    const { zip, count } = await generateRimecBatchZip({
      titlePrefix: "Gestion Detallada",
      rows,
      batchCol: "Vendedor",
      groupCols: ["Vendedor", "Cadena", "Cliente", "Marca", "Mes"],
      meta,
    });
    assert(count === 2, `batch vend count=${count}`);
    assert(isZip(zip), "batch vend ZIP");
    writeFileSync(join(outDir, "06_batch_vendedores.zip"), zip);
    results.push({ name: "batch_vendedores", bytes: zip.byteLength, ok: true });
  }

  // 7 Empty should fail
  let emptyFailed = false;
  try {
    await generateRimecGerencialPdf({ title: "x", rows: [] });
  } catch {
    emptyFailed = true;
  }
  assert(emptyFailed, "empty rows must throw");

  // 8 Unicode accents in data must not crash WinAnsi
  {
    const pdf = await generateRimecGerencialPdf({
      title: "Prueba Acentos",
      rows: [{ Cliente: "José Núñez", Cadena: "Compañía", [ALIAS_CURRENT_VALUE]: 1, [ALIAS_TARGET_VALUE]: 1 }],
      meta,
    });
    assert(isPdf(pdf), "acentos %PDF");
    results.push({ name: "acentos", bytes: pdf.byteLength, ok: true });
  }

  console.log("OK smoke ampliado PDF Sales Report");
  console.log(JSON.stringify({ outDir, results }, null, 2));
}

main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
