import type { Pool } from "pg";

/** Categoría compra previa (≠ programado 3). Paridad rimec-web/lib/controlStock/types.ts */
export const CATEGORIA_COMPRA_PREVIA_ID = 2;
export const CATEGORIA_PROGRAMADO_ID = 3;

/**
 * SQL canónico CP · tránsito · molécula 5 pilares · pares_vendidos (no venta_transito).
 * Réplica obligatoria de rimec-web fetchControl + normalizarFilasMolecula + calcularKpis.
 */
export const SQL_PP_TRANSITO_CP = `
  SELECT id, numero_registro, numero_proforma, fecha_arribo_estimada, quincena_arribo_id
  FROM pedido_proveedor
  WHERE estado_transito = 'EN_TRANSITO'
    AND (categoria_id IS NULL OR categoria_id = ${CATEGORIA_COMPRA_PREVIA_ID})
    AND categoria_id IS DISTINCT FROM ${CATEGORIA_PROGRAMADO_ID}
`;

export const SQL_MOL_CP_BASE = `
  WITH pp_transito AS (${SQL_PP_TRANSITO_CP}),
  mol AS (
    SELECT
      ppd.pedido_proveedor_id AS pp_id,
      pt.numero_registro,
      pt.numero_proforma,
      pt.fecha_arribo_estimada,
      pt.quincena_arribo_id,
      COALESCE(ppd.linea::text, '') AS linea,
      COALESCE(ppd.referencia::text, '') AS referencia,
      COALESCE(ppd.material_code::text, '') AS material_code,
      COALESCE(ppd.color_code::text, '') AS color_code,
      COALESCE(ppd.grada::text, '') AS grada,
      SUM(COALESCE(ppd.cantidad_pares, 0))::float AS inicial,
      SUM(COALESCE(ppd.pares_vendidos, 0))::float AS vendido
    FROM pedido_proveedor_detalle ppd
    INNER JOIN pp_transito pt ON pt.id = ppd.pedido_proveedor_id
    WHERE ppd.referencia IS NOT NULL
    GROUP BY
      ppd.pedido_proveedor_id,
      pt.numero_registro,
      pt.numero_proforma,
      pt.fecha_arribo_estimada,
      pt.quincena_arribo_id,
      COALESCE(ppd.linea::text, ''),
      COALESCE(ppd.referencia::text, ''),
      COALESCE(ppd.material_code::text, ''),
      COALESCE(ppd.color_code::text, ''),
      COALESCE(ppd.grada::text, '')
  ),
  pp_con_stock AS (
    SELECT pp_id FROM mol GROUP BY pp_id HAVING SUM(inicial) > 0
  ),
  mol_activa AS (
    SELECT m.* FROM mol m
    INNER JOIN pp_con_stock ps ON ps.pp_id = m.pp_id
  )
`;

export type CompraPreviaKpiCanon = {
  pedidos_abiertos: number;
  moleculas: number;
  pares_inicial: number;
  pares_vendidos: number;
  pares_saldo: number;
  pct_ejecucion: number | null;
};

export type CompraPreviaPorPp = {
  pp_id: number;
  numero_registro: string;
  numero_proforma: string | null;
  fecha_arribo_estimada: string | null;
  moleculas: number;
  pares_inicial: number;
  pares_vendidos: number;
  pares_saldo: number;
  pct_ejecucion: number | null;
};

export type CompraPreviaPorMarca = {
  marca: string;
  moleculas: number;
  pares_inicial: number;
  pares_vendidos: number;
  pares_saldo: number;
  pct_ejecucion: number | null;
};

export type CompraPreviaEstadisticasDetalle = {
  version: "cp-v1";
  generado: string;
  kpi: CompraPreviaKpiCanon;
  por_pp: CompraPreviaPorPp[];
  por_marca: CompraPreviaPorMarca[];
};

function pct(inicial: number, vendido: number): number | null {
  return inicial > 0 ? (vendido / inicial) * 100 : null;
}

export async function getCompraPreviaKpiCanon(pool: Pool): Promise<CompraPreviaKpiCanon> {
  const { rows } = await pool.query<{
    pedidos: string;
    moleculas: string;
    inicial: string;
    vendido: string;
  }>(
    `
    ${SQL_MOL_CP_BASE}
    SELECT
      COUNT(DISTINCT pp_id)::text AS pedidos,
      COUNT(*)::text AS moleculas,
      COALESCE(SUM(inicial), 0)::text AS inicial,
      COALESCE(SUM(vendido), 0)::text AS vendido
    FROM mol_activa
    `,
  );

  const r = rows[0];
  const pares_inicial = Number(r?.inicial ?? 0);
  const pares_vendidos = Number(r?.vendido ?? 0);

  return {
    pedidos_abiertos: Number(r?.pedidos ?? 0),
    moleculas: Number(r?.moleculas ?? 0),
    pares_inicial,
    pares_vendidos,
    pares_saldo: pares_inicial - pares_vendidos,
    pct_ejecucion: pct(pares_inicial, pares_vendidos),
  };
}

export async function getCompraPreviaEstadisticasDetalle(
  pool: Pool,
): Promise<CompraPreviaEstadisticasDetalle> {
  const [kpi, porPpQ, porMarcaQ] = await Promise.all([
    getCompraPreviaKpiCanon(pool),
    pool.query<{
      pp_id: string;
      numero_registro: string;
      numero_proforma: string | null;
      fecha_arribo: string | null;
      moleculas: string;
      inicial: string;
      vendido: string;
    }>(
      `
      ${SQL_MOL_CP_BASE}
      SELECT
        pp_id::text,
        MAX(numero_registro) AS numero_registro,
        MAX(numero_proforma) AS numero_proforma,
        MAX(fecha_arribo_estimada)::text AS fecha_arribo,
        COUNT(*)::text AS moleculas,
        COALESCE(SUM(inicial), 0)::text AS inicial,
        COALESCE(SUM(vendido), 0)::text AS vendido
      FROM mol_activa
      GROUP BY pp_id
      ORDER BY MAX(fecha_arribo_estimada) NULLS LAST, MAX(numero_proforma), pp_id
      `,
    ),
    pool.query<{
      marca: string;
      moleculas: string;
      inicial: string;
      vendido: string;
    }>(
      `
      ${SQL_MOL_CP_BASE},
      mol_marca AS (
        SELECT
          m.pp_id,
          m.linea,
          m.referencia,
          m.material_code,
          m.color_code,
          m.grada,
          m.inicial,
          m.vendido,
          COALESCE(mv.descp_marca, 'Sin marca') AS marca
        FROM mol_activa m
        LEFT JOIN linea l ON l.codigo_proveedor::text = NULLIF(m.linea, '')
        LEFT JOIN marca_v2 mv ON mv.id_marca = l.marca_id
      )
      SELECT
        marca,
        COUNT(*)::text AS moleculas,
        COALESCE(SUM(inicial), 0)::text AS inicial,
        COALESCE(SUM(vendido), 0)::text AS vendido
      FROM mol_marca
      GROUP BY marca
      ORDER BY SUM(inicial) DESC
      `,
    ),
  ]);

  return {
    version: "cp-v1",
    generado: new Date().toISOString(),
    kpi,
    por_pp: porPpQ.rows.map((r) => {
      const pares_inicial = Number(r.inicial);
      const pares_vendidos = Number(r.vendido);
      return {
        pp_id: Number(r.pp_id),
        numero_registro: r.numero_registro,
        numero_proforma: r.numero_proforma,
        fecha_arribo_estimada: r.fecha_arribo,
        moleculas: Number(r.moleculas),
        pares_inicial,
        pares_vendidos,
        pares_saldo: pares_inicial - pares_vendidos,
        pct_ejecucion: pct(pares_inicial, pares_vendidos),
      };
    }),
    por_marca: porMarcaQ.rows.map((r) => {
      const pares_inicial = Number(r.inicial);
      const pares_vendidos = Number(r.vendido);
      return {
        marca: r.marca,
        moleculas: Number(r.moleculas),
        pares_inicial,
        pares_vendidos,
        pares_saldo: pares_inicial - pares_vendidos,
        pct_ejecucion: pct(pares_inicial, pares_vendidos),
      };
    }),
  };
}
