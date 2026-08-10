/**
 * Smoke cascada L→R→M→C · herramienta reposición (siamese Web).
 * Uso: npx tsx scripts/smoke_cascada_lrmc_am.mts
 */
import assert from "assert";
import {
  EMPTY_OPERATIVA_FILTERS,
  buildOperativaOpciones,
  rowMatchesOperativaFilters,
  hayCascadaAcotarFacetas,
  type OperativaFilterState,
} from "../src/lib/depositos/operativa-filters";
import {
  cascadaDimensionesOperativa,
  cascadaEstiloOperativa,
  cascadaLineaOperativa,
  cascadaReferenciaOperativa,
  cascadaMaterialOperativa,
  toggleLineaCascadaOp,
  toggleReferenciaCascadaOp,
} from "../src/lib/depositos/operativa-cascada";
import type { DepositoRow } from "../src/app/api/depositos/[cliente_id]/route";

function row(partial: Partial<DepositoRow> = {}): DepositoRow {
  return {
    cantidad: 12,
    pares_vendidos: 0,
    genero_id: 1,
    marca_id: 10,
    grupo_estilo_id: 100,
    tipo_1_id: 1,
    tipo_v2_id: 1,
    linea_id: 1000,
    referencia_id: 2000,
    material_id: 3000,
    color_id: 4000,
    marca: "MOLECA",
    genero: "DAMAS",
    estilo: "Sandalia",
    tipo_1: "ABIERTO",
    tipo_v2: "Calzado",
    linea_codigo_proveedor: "1122",
    referencia_codigo_proveedor: "828",
    material_code: "7286",
    color_code: "15745",
    descp_material: "Napa Negro",
    descp_color: "Negro",
    familia_material: "Napa",
    familia_color: "Negro",
    tono_etiqueta: "Negro",
    grada: "35",
    ...partial,
  } as DepositoRow;
}

const rows = [
  row({}),
  row({
    linea_id: 1000,
    referencia_id: 2001,
    referencia_codigo_proveedor: "900",
    material_code: "1111",
    color_code: "2222",
    familia_material: "Sintético",
    familia_color: "Beige",
  }),
  row({
    linea_id: 1001,
    linea_codigo_proveedor: "9999",
    referencia_id: 3000,
    referencia_codigo_proveedor: "111",
    marca_id: 20,
    marca: "VIZZANO",
  }),
];

const est = cascadaEstiloOperativa([100]);
assert.deepStrictEqual(est.lineaIds, []);
assert.deepStrictEqual(est.referenciaIds, []);
assert.deepStrictEqual(est.materialFamilias, []);
assert.deepStrictEqual(est.colorFamilias, []);

const lin = cascadaLineaOperativa([1000]);
assert.deepStrictEqual(lin.referenciaIds, []);
assert.deepStrictEqual(lin.materialFamilias, []);

const ref = cascadaReferenciaOperativa([2000]);
assert.deepStrictEqual(ref.materialFamilias, []);
assert.deepStrictEqual(ref.colorFamilias, []);

const mat = cascadaMaterialOperativa(["Napa"]);
assert.deepStrictEqual(mat.colorFamilias, []);

const dim = cascadaDimensionesOperativa({ marcaIds: [10] });
assert.deepStrictEqual(dim.grupoEstiloIds, []);
assert.deepStrictEqual(dim.referenciaIds, []);

const tog = toggleLineaCascadaOp([], 1000);
assert.deepStrictEqual(tog.lineaIds, [1000]);
assert.deepStrictEqual(tog.referenciaIds, []);

const togR = toggleReferenciaCascadaOp([2000], 2001);
assert.ok(togR.referenciaIds!.includes(2000) && togR.referenciaIds!.includes(2001));
assert.deepStrictEqual(togR.materialFamilias, []);
const togOff = toggleReferenciaCascadaOp([2000, 2001], 2000);
assert.deepStrictEqual(togOff.referenciaIds, [2001]);
assert.deepStrictEqual(togOff.colorFamilias, []);

const fL: OperativaFilterState = {
  ...EMPTY_OPERATIVA_FILTERS,
  lineaIds: [1000],
  ramoTipo: "CALZADO",
};
assert.equal(rows.filter((r) => rowMatchesOperativaFilters(r, fL)).length, 2);

const fLR = { ...fL, referenciaIds: [2000] };
assert.equal(rows.filter((r) => rowMatchesOperativaFilters(r, fLR)).length, 1);

const fLRM = { ...fLR, materialFamilias: ["Napa"] };
assert.equal(rows.filter((r) => rowMatchesOperativaFilters(r, fLRM)).length, 1);

const fLRMC = { ...fLRM, colorFamilias: ["Negro"] };
assert.equal(rows.filter((r) => rowMatchesOperativaFilters(r, fLRMC)).length, 1);

const fMiss = { ...fLRM, colorFamilias: ["Beige"] };
assert.equal(rows.filter((r) => rowMatchesOperativaFilters(r, fMiss)).length, 0);

const fQ: OperativaFilterState = {
  ...EMPTY_OPERATIVA_FILTERS,
  q: "1122-828-7286",
  ramoTipo: "CALZADO",
};
assert.equal(rows.filter((r) => rowMatchesOperativaFilters(r, fQ)).length, 1);

const op = buildOperativaOpciones(rows, {
  ...EMPTY_OPERATIVA_FILTERS,
  lineaIds: [1000],
  ramoTipo: "CALZADO",
});
assert.ok(op.referencias.every((r) => [2000, 2001].includes(r.id)));
assert.ok(op.lineas.some((l) => l.id === 1000));
assert.ok(hayCascadaAcotarFacetas({ ...EMPTY_OPERATIVA_FILTERS, lineaIds: [1000] }));

console.log("SMOKE CASCADA L-R-M-C AM OK");
