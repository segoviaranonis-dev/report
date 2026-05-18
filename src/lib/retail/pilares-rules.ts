/**
 * Reglas del Excel retail → pilares RIMEC (holding).
 *
 * El Excel trae las 5 columnas de identidad (amarillo en plantilla):
 * Linea, Referencia, Material, Color, Grada.
 * Marca / género / estilo / tipo_1 NO van en el Excel: se obtienen por FK desde pilares.
 */

/** Cabeceras Excel (sinónimos resueltos en Streamlit `map_header_to_canon`). */
export const EXCEL_COLUMNAS_PILAR = [
  { excel: "Linea", canon: "linea_code", tabla: "linea", rol: "Código proveedor → linea.id + linea.codigo_proveedor" },
  { excel: "Referencia", canon: "referencia_code", tabla: "referencia", rol: "Código proveedor → referencia.id (con linea_id)" },
  { excel: "Material", canon: "material_id", tabla: "material", rol: "Código proveedor en Excel → material.id (FK en staging)" },
  { excel: "Color", canon: "color_id", tabla: "color", rol: "Código proveedor en Excel → color.id (FK en staging)" },
  { excel: "Grada", canon: "grada", tabla: null, rol: "Texto en fila (talla 34/38 o caja 34(1 2…)39); no es FK maestro" },
] as const;

/** Dimensiones derivadas al importar (migración 033 + `fk_resolve.resolve_retail_fks`). */
export const DIMENSIONES_DESDE_PILARES = [
  { columna: "marca_id", origen: "linea.marca_id → marca_v2", texto: "marca" },
  { columna: "genero_id", origen: "linea.genero_id → genero", texto: "genero" },
  { columna: "grupo_estilo_id", origen: "linea_referencia.grupo_estilo_id → grupo_estilo_v2", texto: "estilo" },
  { columna: "tipo_1_id", origen: "linea_referencia.tipo_1_id → tipo_1", texto: "tipo_1" },
] as const;

/** Clave artículo en staging (sin talla/grada). */
export function skuKeyFromPilares(
  linea: string,
  ref: string,
  materialId: number,
  colorId: number,
): string {
  const lc = String(linea ?? "").trim();
  const rc = String(ref ?? "").trim();
  return `${lc}|${rc}|${materialId}|${colorId}`;
}

/** Política de importación (paridad Streamlit / Políticas Blindadas). */
export const POLITICA_IMPORT_PILARES = {
  altaSiFalta: "Si línea+ref numéricos y no existen, el import puede crear par en pilares (bloque de mil líneas).",
  noActualizarMaestro: "Si el pilar ya existe, el Excel no sobrescribe marca/género/estilo del maestro.",
  materialColor: "Excel = codigo_proveedor; staging guarda material.id y color.id (FK).",
  gradaEnFila: "Grada queda en la fila de movimiento; tiendas usan talla simple, importadora usa curva con paréntesis.",
} as const;
