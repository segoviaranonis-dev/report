/**
 * Smoke: programado saldo ≠ STOCK's / ≠ cpDisponible (4.01.07.009)
 * Uso: npx tsx scripts/smoke_am_programado_no_stock.ts
 */
import assert from "node:assert/strict";
import { mergeReposicionArticulos } from "../src/lib/herramienta-reposicion/merge-reposicion";
import type { DepositoRow } from "../src/app/api/depositos/[cliente_id]/route";

function row(partial: Partial<DepositoRow> & Pick<DepositoRow, "cantidad">): DepositoRow {
  return {
    linea_codigo_proveedor: "7230",
    referencia_codigo_proveedor: "100",
    material_code: "29516",
    color_code: "83517",
    descp_material: null,
    descp_color: null,
    imagen_nombre: null,
    imagen_color_excel: null,
    precio_unitario: null,
    marca: "MODARE",
    genero: "",
    estilo: "",
    tipo_v2: "Calzado",
    tipo_1: null,
    tono_etiqueta: null,
    linea_id: 1,
    referencia_id: 1,
    material_id: 1,
    color_id: 1,
    marca_id: 1,
    genero_id: null,
    grupo_estilo_id: null,
    tipo_1_id: null,
    tipo_v2_id: 1,
    caso_precio: null,
    caso_id: null,
    cadena_comercial: null,
    es_liquidacion: null,
    numero_preventa: "4117",
    quincena_desc: "1ra Q. de Septiembre",
    pares_vendidos: 0,
    ...partial,
  } as DepositoRow;
}

const arts = mergeReposicionArticulos({
  pe: [],
  compraPrevia: [],
  programado: [row({ cantidad: 8, pares_vendidos: 0 })],
  ppAbierto: [],
});

assert.equal(arts.length, 1, "molécula con solo programado saldo debe existir");
const a = arts[0]!;
assert.equal(a.stock.length, 0, "STOCK's vacío — programado no es manzana");
assert.equal(a.totales.cpDisponible, 0, "cpDisponible no incluye programado");
assert.equal(a.totales.peDisponible, 0);
assert.equal(a.programadoSaldo.length, 1);
assert.equal(a.programadoSaldo[0]!.pares, 8);
assert.equal(a.totales.programado, 8, "KPI programado = saldo");

const mix = mergeReposicionArticulos({
  pe: [],
  compraPrevia: [
    row({
      cantidad: 12,
      pares_vendidos: 4,
      numero_preventa: "4099",
      quincena_desc: "1ra Q. de Octubre",
    }),
  ],
  programado: [row({ cantidad: 8, pares_vendidos: 2 })],
  ppAbierto: [],
});
const m = mix[0]!;
assert.equal(m.totales.cpDisponible, 12);
assert.equal(m.totales.cpVendido, 4);
assert.equal(m.totales.programado, 10, "2 vendido + 8 saldo");
assert.ok(m.stock.every((b) => !/4117|Programado/i.test(b.label) || b.label.includes("4099") || b.label.includes("Octubre")));
assert.equal(m.programadoSaldo.reduce((s, b) => s + b.pares, 0), 8);
assert.equal(m.ventasProgramado.reduce((s, b) => s + b.pares, 0), 2);

console.log("smoke_am_programado_no_stock_ok");
