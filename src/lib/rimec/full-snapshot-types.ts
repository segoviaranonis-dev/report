/**
 * OT-INFORME-003 — contrato JSON del snapshot inmersivo (Fase 1).
 * Los nombres siguen la OT; el front solo consume este objeto.
 */

export type FullSnapshotKpis = {
  monto_periodo: number;
  monto_objetivo: number;
  variacion_pct: number | null;
  clientes_activos: number;
  monto_periodo_anterior: number;
};

export type FullSnapshotEvolucionMes = {
  mes: string;
  real_2026: number;
  objetivo: number;
  real_2025: number;
  desvio_pct: number;
};

export type FullSnapshotParticipacionBucket = { monto: number; pct: number };

/** Participación calzado vs confección por año fiscal de la columna (2025 = monto_25, 2026 = real período). */
export type FullSnapshotParticipacionYear = {
  calzado: FullSnapshotParticipacionBucket;
  confeccion: FullSnapshotParticipacionBucket;
};

export type FullSnapshotParticipacion = {
  y2025: FullSnapshotParticipacionYear;
  y2026: FullSnapshotParticipacionYear;
};

export type FullSnapshotClienteTabla = {
  /** `cliente_v2.id_cliente` (coincide con `codigo_cliente` del pivot cuando es numérico). */
  id_cliente: number;
  codigo: string;
  nombre: string;
  cadena: string;
  monto_2026: number;
  monto_2025: number;
  variacion_pct: number | null;
  marca_principal: string;
};

/** Una fila agregada en BD por (id_cadena, id_cliente, id_marca); descripciones solo para UI. */
export type FullSnapshotJerarquiaLeaf = {
  id_cadena: number;
  descp_cadena: string;
  id_cliente: number;
  descp_cliente: string;
  id_marca: number;
  descp_marca: string;
  mes_idx: number;
  monto_2025: number;
  monto_2026: number;
  monto_objetivo: number;
  variacion_vs_objetivo_pct: number | null;
};

export type FullSnapshotClienteSinCompra = {
  id_cliente: number;
  codigo: string;
  nombre: string;
  cadena: string;
  ultimo_monto: number;
  ultimo_mes: string;
};

export type FullSnapshotRankingMarca = {
  marca: string;
  monto_2026: number;
  monto_2025: number;
  objetivo: number;
  variacion_pct: number | null;
  cumplimiento_pct: number;
};

export type FullSnapshotRankingVendedor = {
  vendedor: string;
  monto_2026: number;
  monto_2025: number;
  objetivo: number;
  variacion_pct: number | null;
  cumplimiento_pct: number;
  clientes_activos: number;
};

export type FullSnapshotMeta = {
  periodo: string;
  objetivo_pct: number;
  departamento: string;
  generado_at: string;
};

/**
 * Dominios para selectores en cascada (misma base que Streamlit: opciones acotadas
 * por consulta DISTINCT omitiendo la dimensión correspondiente).
 */
export type FullSnapshotCascada = {
  departamentos: string[];
  categorias: { id_categoria: number; nombre: string }[];
  meses_nombres: string[];
  marcas: string[];
  cadenas: string[];
  vendedores: string[];
};

/** Fila de detalle = columnas del pivot enriquecido (objeto libre). */
export type FullSnapshotDetalleRow = Record<string, unknown>;

export type FullSnapshotBody = {
  objetivo_pct?: number;
  departamento?: string;
  /** Índices 1–12 o nombres de mes en español (compat con `SalesReportFilters`). */
  meses?: number[] | string[];
  /** Nombres de categoría (se resuelven a `id_categoria` vía `categoria_v2`). */
  categorias?: string[];
  categoria_ids?: number[];
  cliente_codigo?: string | null;
  marcas?: string[];
  cadenas?: string[];
  vendedores?: string[];
  clientes?: string[];
};

export type FullSnapshotResponse = {
  configured: true;
  kpis: FullSnapshotKpis;
  evolucion_mensual: FullSnapshotEvolucionMes[];
  participacion: FullSnapshotParticipacion;
  clientes_crecimiento: FullSnapshotClienteTabla[];
  clientes_riesgo: FullSnapshotClienteTabla[];
  clientes_sin_compra: FullSnapshotClienteSinCompra[];
  ranking_marcas: FullSnapshotRankingMarca[];
  ranking_vendedores: FullSnapshotRankingVendedor[];
  detalle_operativo: FullSnapshotDetalleRow[];
  /** Hojas Cadena×Cliente×Marca ya sumadas en Postgres (ids + descripciones FK). */
  jerarquia_clientes: FullSnapshotJerarquiaLeaf[];
  meta: FullSnapshotMeta;
  cascada: FullSnapshotCascada;
};
