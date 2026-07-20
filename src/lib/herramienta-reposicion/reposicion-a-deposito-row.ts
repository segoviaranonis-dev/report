import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import type { ReposicionArticulo } from "@/lib/herramienta-reposicion/merge-reposicion";

/** Adaptador → filtros / chip sin imagen (mismo contrato cabecera AM). */
export function reposicionArticuloToDepositoRow(a: ReposicionArticulo): DepositoRow {
  const total =
    a.totales.peDisponible +
    a.totales.cpDisponible +
    a.totales.ppAbierto +
    a.totales.cpVendido +
    a.totales.programado;
  return {
    linea_codigo_proveedor: a.linea,
    referencia_codigo_proveedor: a.referencia,
    material_code: a.material,
    color_code: a.color,
    marca: a.marca,
    genero: a.genero,
    estilo: a.estilo,
    tipo_v2: a.tipo_v2,
    descp_material: a.descp_material,
    descp_color: a.descp_color,
    grada: "—",
    cantidad: total,
    imagen_nombre: a.imagen_nombre,
    imagen_color_excel: a.imagen_color_excel,
    linea_id: a.linea_id,
    referencia_id: a.referencia_id,
    material_id: a.material_id,
    color_id: a.color_id,
    marca_id: a.marca_id,
    genero_id: a.genero_id,
    grupo_estilo_id: a.grupo_estilo_id,
    tipo_1_id: a.tipo_1_id,
    tipo_v2_id: a.tipo_v2_id,
    tono_etiqueta: a.tono_etiqueta,
    tipo_1: a.tipo_1,
    precio_unitario: a.lpn,
    pares_vendidos: a.totales.cpVendido,
    caso_precio: a.caso_precio,
    caso_id: a.caso_id,
    cadena_comercial: a.cadena_comercial,
    es_liquidacion: a.es_liquidacion,
  };
}
