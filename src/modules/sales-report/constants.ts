/**
 * Piedra Rosetta del port Sales Report (Streamlit → Report).
 * Debe mantenerse alineado con core/constants.py y core/queries.py del monolito.
 */
export const ALIAS_CURRENT_VALUE = "Monto 26";
export const ALIAS_TARGET_VALUE = "Monto Obj";
export const ALIAS_VARIATION = "Variación %";

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

export const MESES_LISTA = Object.keys(MES_MAP);

export const MES_NOMBRES: Record<number, string> = Object.fromEntries(
  Object.entries(MES_MAP).map(([k, v]) => [v, k])
) as Record<number, string>;

/** Tablas/vista que el Sales Report de Streamlit toca (contrato de emulación). */
export const SALES_REPORT_DB_CONTRACT = [
  "v_ventas_pivot",
  "registro_ventas_general_v2",
  "tipo_v2",
  "marca_v2",
  "cliente_v2",
  "vendedor_v2",
  "categoria_v2",
  "cliente_cadena_v2",
  "cadena_v2",
] as const;
