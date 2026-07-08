import type { Pool } from "pg";

/**
 * Réplica SQL de rimec-web/lib/controlStock/fetchControl.ts + buildTree.ts (calcularKpis).
 * COMPRA PREVIA Panel de Control = KPIs Estadísticas RIMEC Web sin filtros opcionales.
 *
 * Filtros canónicos:
 * - pedido_proveedor.estado_transito = 'EN_TRANSITO'
 * - pedido_proveedor_detalle.referencia IS NOT NULL
 * - inicial = SUM(cantidad_pares); vendido = SUM(pares_vendidos); saldo = inicial - vendido
 * - moléculas = GROUP BY pp + 5 pilares (linea, referencia, material_code, color_code, grada)
 */
export type CompraPreviaEstadisticasWeb = {
  pedidos_abiertos: number;
  moleculas: number;
  pares_inicial: number;
  pares_vendidos: number;
  pares_saldo: number;
};

export async function getCompraPreviaEstadisticasWeb(
  pool: Pool,
): Promise<CompraPreviaEstadisticasWeb> {
  const { rows } = await pool.query<{
    pedidos: string;
    moleculas: string;
    inicial: string;
    vendido: string;
  }>(
    `
    WITH pp_transito AS (
      SELECT id
      FROM pedido_proveedor
      WHERE estado_transito = 'EN_TRANSITO'
    ),
    mol AS (
      SELECT
        ppd.pedido_proveedor_id AS pp_id,
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
        COALESCE(ppd.linea::text, ''),
        COALESCE(ppd.referencia::text, ''),
        COALESCE(ppd.material_code::text, ''),
        COALESCE(ppd.color_code::text, ''),
        COALESCE(ppd.grada::text, '')
    )
    SELECT
      COUNT(DISTINCT pp_id)::text AS pedidos,
      COUNT(*)::text AS moleculas,
      COALESCE(SUM(inicial), 0)::text AS inicial,
      COALESCE(SUM(vendido), 0)::text AS vendido
    FROM mol
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
  };
}
