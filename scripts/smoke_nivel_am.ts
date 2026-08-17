/**
 * Smoke nivel AM — política 2.3.1.23
 * Uso: npx tsx scripts/smoke_nivel_am.ts
 */
import assert from "node:assert/strict";
import type { ReposicionArticulo } from "../src/lib/herramienta-reposicion/merge-reposicion";
import { ejesPresentes, nivelAm } from "../src/lib/herramienta-reposicion/nivel-am";

function art(partial: Partial<ReposicionArticulo>): ReposicionArticulo {
  return {
    key: "k",
    marca: "X",
    linea: "1",
    referencia: "1",
    material: "1",
    color: "1",
    descp_material: null,
    descp_color: null,
    imagen_nombre: null,
    imagen_color_excel: null,
    lpn: null,
    genero: "",
    estilo: "",
    tipo_v2: "",
    tipo_1: null,
    tono_etiqueta: null,
    linea_id: null,
    referencia_id: null,
    material_id: 1,
    color_id: 1,
    marca_id: null,
    genero_id: null,
    grupo_estilo_id: null,
    tipo_1_id: null,
    tipo_v2_id: null,
    stock: [],
    ventasCp: [],
    ventasProgramado: [],
    programadoSaldo: [],
    totales: { peDisponible: 0, cpDisponible: 0, cpVendido: 0, programado: 0, ppAbierto: 0 },
    ...partial,
  };
}

// VIZZANO N1 — captura Director
const vizzano = art({
  stock: [
    { label: "1ra Q. de Agosto", pares: 48 },
    { label: "1ra Q. de Octubre", pares: 60 },
    { label: "Pronta entrega", pares: 72 },
  ],
  ventasCp: [{ label: "1ra Q. de Agosto", pares: 12 }],
  ventasProgramado: [
    { label: "1ra Q. de Septiembre", pares: 8 },
    { label: "2da Q. de Septiembre", pares: 12 },
  ],
});
assert.equal(nivelAm(vizzano), 1);
assert.deepEqual(ejesPresentes(vizzano), [true, true, true, true]);

// Solo PE → N3
const soloPe = art({ stock: [{ label: "Pronta entrega", pares: 10 }] });
assert.equal(nivelAm(soloPe), 3);

// CP stock + PE, sin ventas → N2
const n2 = art({
  stock: [
    { label: "1ra Q. de Agosto", pares: 5 },
    { label: "Pronta entrega", pares: 3 },
  ],
});
assert.equal(nivelAm(n2), 2);

console.log("smoke_nivel_am_ok");
