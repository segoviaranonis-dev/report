import type { Pool } from "pg";
import { CATEGORIA_PROGRAMADO_ID } from "@/lib/intencion-compra/categoria-ic";
import { SQL_PP_CATEGORIA_CTE } from "@/lib/stock-programado/pp-categoria-sql";
import type { StockTransitoResumen, TransitoResumenQuincena } from "@/lib/stock-transito/queries-resumen";

export type ProgramadoResumenProforma = {
  pp_id: number;
  pp_nro: string;
  proforma: string;
  label: string;
  pares_inicial: number;
  pares_vendidos: number;
  pares_saldo: number;
  /** FI RESERVADA+CONFIRMADA — lote Chusa completo. */
  n_fi: number;
};

export type StockProgramadoResumen = StockTransitoResumen & {
  por_proforma: ProgramadoResumenProforma[];
};

export async function getStockProgramadoResumen(pool: Pool): Promise<StockProgramadoResumen> {
  const [kpiQ, quincenasQ, proformasQ] = await Promise.all([
    pool.query<{
      pedidos: string;
      moleculas: string;
      inicial: string;
      vendido: string;
    }>(
      `
      WITH ${SQL_PP_CATEGORIA_CTE},
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
        COALESCE(SUM(vendido), 0)::text AS vendido
      FROM det
      `,
      [CATEGORIA_PROGRAMADO_ID],
    ),
    pool.query<{
      quincena_id: string;
      label: string;
      pp_count: string;
      inicial: string;
      vendido: string;
      saldo: string;
    }>(
      `
      WITH ${SQL_PP_CATEGORIA_CTE},
      mol AS (
        SELECT
          pp.quincena_arribo_id,
          ppd.pedido_proveedor_id AS pp_id,
          SUM(COALESCE(ppd.cantidad_pares, 0))::float AS inicial,
          SUM(COALESCE(ppd.pares_vendidos, 0))::float AS vendido
        FROM pedido_proveedor_detalle ppd
        JOIN pp_cat pc ON pc.pp_id = ppd.pedido_proveedor_id AND pc.categoria_id = $1
        JOIN pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
        WHERE ppd.referencia IS NOT NULL
        GROUP BY pp.quincena_arribo_id, ppd.pedido_proveedor_id,
          COALESCE(ppd.linea::text, ''), COALESCE(ppd.referencia::text, ''),
          COALESCE(ppd.material_code::text, ''), COALESCE(ppd.color_code::text, ''),
          COALESCE(ppd.grada::text, '')
      )
      SELECT
        COALESCE(m.quincena_arribo_id, 0)::text AS quincena_id,
        COALESCE(qa.descripcion, 'Sin quincena') AS label,
        COUNT(DISTINCT m.pp_id)::text AS pp_count,
        COALESCE(SUM(m.inicial), 0)::text AS inicial,
        COALESCE(SUM(m.vendido), 0)::text AS vendido,
        COALESCE(SUM(m.inicial - m.vendido), 0)::text AS saldo
      FROM mol m
      LEFT JOIN quincena_arribo qa ON qa.id = m.quincena_arribo_id
      GROUP BY m.quincena_arribo_id, qa.descripcion
      ORDER BY m.quincena_arribo_id NULLS LAST
      `,
      [CATEGORIA_PROGRAMADO_ID],
    ),
    pool.query<{
      pp_id: string;
      pp_nro: string;
      proforma: string;
      n_fi: string;
      inicial: string;
      vendido: string;
      saldo: string;
    }>(
      `
      WITH ${SQL_PP_CATEGORIA_CTE},
      mol AS (
        SELECT
          ppd.pedido_proveedor_id AS pp_id,
          SUM(COALESCE(ppd.cantidad_pares, 0))::float AS inicial,
          SUM(COALESCE(ppd.pares_vendidos, 0))::float AS vendido
        FROM pedido_proveedor_detalle ppd
        JOIN pp_cat pc ON pc.pp_id = ppd.pedido_proveedor_id AND pc.categoria_id = $1
        WHERE ppd.referencia IS NOT NULL
        GROUP BY ppd.pedido_proveedor_id,
          COALESCE(ppd.linea::text, ''), COALESCE(ppd.referencia::text, ''),
          COALESCE(ppd.material_code::text, ''), COALESCE(ppd.color_code::text, ''),
          COALESCE(ppd.grada::text, '')
      )
      SELECT
        m.pp_id::text,
        COALESCE(pp.numero_registro, '—') AS pp_nro,
        COALESCE(NULLIF(TRIM(pp.numero_proforma), ''), 'Sin proforma') AS proforma,
        (SELECT COUNT(*)::int FROM factura_interna fi
         WHERE fi.pp_id = m.pp_id AND fi.estado IN ('RESERVADA', 'CONFIRMADA')) AS n_fi,
        COALESCE(SUM(m.inicial), 0)::text AS inicial,
        COALESCE(SUM(m.vendido), 0)::text AS vendido,
        COALESCE(SUM(m.inicial - m.vendido), 0)::text AS saldo
      FROM mol m
      JOIN pedido_proveedor pp ON pp.id = m.pp_id
      GROUP BY m.pp_id, pp.numero_registro, pp.numero_proforma
      ORDER BY pp.numero_registro DESC NULLS LAST
      `,
      [CATEGORIA_PROGRAMADO_ID],
    ),
  ]);

  const kpi = kpiQ.rows[0];
  const pares_inicial = Number(kpi?.inicial ?? 0);
  const pares_vendidos = Number(kpi?.vendido ?? 0);

  return {
    pedidos_pp: Number(kpi?.pedidos ?? 0),
    moleculas: Number(kpi?.moleculas ?? 0),
    pares_inicial,
    pares_vendidos,
    pares_saldo: pares_inicial - pares_vendidos,
    por_quincena: quincenasQ.rows.map(
      (r): TransitoResumenQuincena => ({
        quincena_arribo_id: Number(r.quincena_id),
        label: r.label,
        pp_count: Number(r.pp_count),
        pares_inicial: Number(r.inicial),
        pares_vendidos: Number(r.vendido),
        pares_saldo: Number(r.saldo),
      }),
    ),
    por_proforma: proformasQ.rows
      .map((r) => ({
        pp_id: Number(r.pp_id),
        pp_nro: r.pp_nro,
        proforma: r.proforma,
        label: `${r.proforma} · ${r.pp_nro}`,
        pares_inicial: Number(r.inicial),
        pares_vendidos: Number(r.vendido),
        pares_saldo: Number(r.saldo),
        n_fi: Number(r.n_fi),
      }))
      .sort((a, b) => b.n_fi - a.n_fi || b.pares_vendidos - a.pares_vendidos),
  };
}
