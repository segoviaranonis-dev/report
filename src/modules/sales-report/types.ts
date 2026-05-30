/**
 * Estado de filtros equivalente a FilterManager (draft/commit) en Streamlit.
 */
export type SalesReportFilters = {
  objetivo_pct: number;
  departamento: string;
  categoria_ids: number[];
  meses: string[];
  cadenas: string[];
  clientes: string[];
  vendedores: string[];
  marcas: string[];
  id_cliente_exacto: string | null;
};

export const defaultSalesReportFilters = (): SalesReportFilters => ({
  objetivo_pct: 20,
  departamento: "CALZADOS",
  categoria_ids: [3],
  meses: ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio"],
  cadenas: [],
  clientes: [],
  vendedores: [],
  marcas: [],
  id_cliente_exacto: null,
});

/**
 * Categorías alineadas a usuario_v2.categoria (extensible).
 * ADMIN = sin restricciones. SU = sin nada hasta que ADMIN asigne módulos.
 */
export type UsuarioCategoria = "ADMIN" | "SU" | string;

export type ReportModuleKey =
  | "sales_report"
  | "sales_report_importadora"
  | "ventas_fotos"
  | "retail_multitienda"
  | "informes";

/** Una fila de política: qué módulo puede ver el usuario (post-asignación ADMIN). */
export type UsuarioReporteModulo = {
  id_usuario: number;
  module_key: ReportModuleKey;
  allowed: boolean;
  /** Ej. restringir "importadora" dentro de sales report */
  scope?: string | null;
};

export type ReportEntitlement = {
  module: ReportModuleKey;
  allowed: boolean;
  scope?: string | null;
};
