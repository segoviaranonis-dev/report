import type { Pool } from "pg";
import { getCompraPreviaEstadisticasWeb } from "@/lib/panel-control/compra-previa-estadisticas-web";
import { getStockProntaEntregaResumen, type PeResumenRamo } from "@/lib/stock-pronta-entrega/queries-resumen";

export type EntidadActivoResumen = {
  entidad: "STOCK" | "COMPRA_PREVIA" | "PROGRAMADO";
  label: string;
  pedidos_abiertos: number;
  moleculas: number;
  pares_inicial: number;
  pares_vendidos: number;
  pares_saldo: number;
  monto_gs: number | null;
  rimec_web: boolean;
  enlace_report: string;
  /** PE · segregación obligatoria calzado vs confecciones */
  ramos?: { calzado: PeResumenRamo; confecciones: PeResumenRamo };
};

export type PanelControlResumen = {
  version: "v1";
  generado: string;
  entidades: EntidadActivoResumen[];
  nota: string;
};

async function aggPpPorCategoria(
  pool: Pool,
  categoriaId: number,
): Promise<Omit<EntidadActivoResumen, "entidad" | "label" | "rimec_web" | "enlace_report">> {
  const { rows } = await pool.query<{
    pedidos: string;
    moleculas: string;
    inicial: string;
    vendido: string;
    saldo: string;
  }>(
    `
    WITH pp_cat AS (
      SELECT
        pp.id AS pp_id,
        COALESCE(
          pp.categoria_id,
          (SELECT ic.categoria_id
           FROM intencion_compra_pedido icp
           JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
           WHERE icp.pedido_proveedor_id = pp.id
           ORDER BY icp.id
           LIMIT 1)
        ) AS categoria_id
      FROM pedido_proveedor pp
    ),
    det AS (
      SELECT
        ppd.id,
        pc.pp_id,
        COALESCE(ppd.cantidad_pares, 0)::float AS inicial,
        GREATEST(
          COALESCE(ppd.pares_vendidos, 0),
          COALESCE((
            SELECT SUM(vt.cantidad_vendida)
            FROM venta_transito vt
            WHERE vt.pedido_proveedor_detalle_id = ppd.id
          ), 0)
        )::float AS vendido
      FROM pedido_proveedor_detalle ppd
      JOIN pp_cat pc ON pc.pp_id = ppd.pedido_proveedor_id
      WHERE ppd.linea IS NOT NULL
        AND pc.categoria_id = $1
    )
    SELECT
      COUNT(DISTINCT pp_id)::text AS pedidos,
      COUNT(*)::text AS moleculas,
      COALESCE(SUM(inicial), 0)::text AS inicial,
      COALESCE(SUM(vendido), 0)::text AS vendido,
      COALESCE(SUM(GREATEST(inicial - vendido, 0)), 0)::text AS saldo
    FROM det
    `,
    [categoriaId],
  );

  const r = rows[0];
  return {
    pedidos_abiertos: Number(r?.pedidos ?? 0),
    moleculas: Number(r?.moleculas ?? 0),
    pares_inicial: Number(r?.inicial ?? 0),
    pares_vendidos: Number(r?.vendido ?? 0),
    pares_saldo: Number(r?.saldo ?? 0),
    monto_gs: null,
  };
}

export async function getPanelControlResumen(pool: Pool): Promise<PanelControlResumen> {
  const [pe, cp, prog] = await Promise.all([
    getStockProntaEntregaResumen(pool),
    getCompraPreviaEstadisticasWeb(pool),
    aggPpPorCategoria(pool, 3),
  ]);

  const entidades: EntidadActivoResumen[] = [
    {
      entidad: "STOCK",
      label: "Stock · Pronta entrega",
      pedidos_abiertos: 0,
      moleculas: pe.skus,
      pares_inicial: pe.uds_inicial,
      pares_vendidos: pe.uds_vendidas,
      pares_saldo: pe.uds_total,
      monto_gs: pe.monto_gs,
      rimec_web: true,
      enlace_report: "/stock-pronta-entrega",
      ramos: { calzado: pe.calzado, confecciones: pe.confecciones },
    },
    {
      entidad: "COMPRA_PREVIA",
      label: "Compra previa · Tránsito",
      ...cp,
      monto_gs: null,
      rimec_web: true,
      enlace_report: "/stock-transito",
    },
    {
      entidad: "PROGRAMADO",
      label: "Programado",
      ...prog,
      rimec_web: false,
      enlace_report: "/stock-programado",
    },
  ];

  return {
    version: "v1",
    generado: new Date().toISOString(),
    entidades,
    nota: "Alejandro Magno · tres entidades · Sales Report blindado orbita montos",
  };
}
