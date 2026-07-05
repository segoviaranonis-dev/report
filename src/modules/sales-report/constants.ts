/**
 * Piedra Rosetta del port Sales Report (Streamlit → Report).
 * Debe mantenerse alineado con core/constants.py y core/queries.py del monolito.
 *
 * Arquitectura de dominio:
 * - Velocidad: un snapshot por sincronización, consultas acotadas, cascada en paralelo (`fetchCascadeDomains`).
 * - Clientes: RIMEC Web y Sales Report comparten el mismo universo (`cliente_v2` vía `v_ventas_pivot`).
 * - Importadora (próximo): vincular de forma explícita `cliente_cadena_v2` + `cadena_v2` en APIs de catálogo
 *   y filtros donde hoy la cadena sale del pivot; el modelo de datos ya los incluye en el contrato de tablas.
 */
export const ALIAS_CURRENT_VALUE = "Monto 26";
export const ALIAS_TARGET_VALUE = "Monto Obj";
export const ALIAS_VARIATION = "Variación %";

/** Versión sellada del Sales Report web (snapshot + mundos inmersivos). */
export const SALES_REPORT_WEB_VERSION = "1.0.0";

export const MES_MAP: Record<string, number> = {
  Enero: 1,
  Febrero: 2,
  Marzo: 3,
  Abril: 4,
  Mayo: 5,
  Junio: 6,
  Julio: 7,
  Agosto: 8,
  Septiembre: 9,
  Octubre: 10,
  Noviembre: 11,
  Diciembre: 12,
};

/** Venta general calzados — STOCK · PREVENTA · PROXIMAMENTE (categoria_v2). Alejandro Magno / init Sales Report. */
export const CATEGORIA_VENTA_CALZADOS_IDS = [1, 2, 3] as const;

const CALZADOS_CAT_ALIASES = ["STOCK", "PREVENTA", "PRE VENTA", "PROXIMAMENTE", "PROGRAMADO"] as const;

/** Tres categorías calzados visibles en cascada — fallback si ids 1-2-3 no coinciden con BD. */
export function defaultCalzadosCategoriaIds(
  categorias: { id_categoria: number; nombre: string }[],
): number[] {
  if (!categorias.length) return [...CATEGORIA_VENTA_CALZADOS_IDS];
  const byId = new Set(categorias.map((c) => c.id_categoria));
  const fromConstants = CATEGORIA_VENTA_CALZADOS_IDS.filter((id) => byId.has(id));
  if (fromConstants.length >= 3) return [...fromConstants];
  if (fromConstants.length >= 2) return [...fromConstants];
  const matched = categorias.filter((c) => {
    const n = c.nombre.trim().toUpperCase();
    return CALZADOS_CAT_ALIASES.some((a) => n === a || n.includes(a.replace(" ", "")));
  });
  if (matched.length >= 2) return [...new Set(matched.map((c) => c.id_categoria))];
  return categorias.map((c) => c.id_categoria);
}

export const MESES_LISTA = Object.keys(MES_MAP);

export const MES_NOMBRES: Record<number, string> = Object.fromEntries(
  Object.entries(MES_MAP).map(([k, v]) => [v, k])
) as Record<number, string>;

/** Tablas/vista que el Sales Report de Streamlit toca (contrato de emulación).
 *  Dimensión marca: listados y cascada leen `marca_v2`; `v_ventas_pivot.marca` es proyección de `descp_marca`.
 */
export const SALES_REPORT_DB_CONTRACT = [
  "v_ventas_pivot",
  "registro_ventas_general_v2",
  "tipo_v2",
  "marca_v2",
  "cliente_v2",
  "vendedor_v2_deprecated",
  "categoria_v2",
  "cliente_cadena_v2",
  "cadena_v2",
] as const;

/** Las 8 tablas físicas que alimentan la vista (sin contar la vista). */
export const RIMEC_INFORME_VENTAS_OCHO_TABLAS = [
  "registro_ventas_general_v2",
  "tipo_v2",
  "marca_v2",
  "cliente_v2",
  "vendedor_v2_deprecated",
  "categoria_v2",
  "cliente_cadena_v2",
  "cadena_v2",
] as const;

export const RIMEC_VISTA_PIVOT = "v_ventas_pivot";
