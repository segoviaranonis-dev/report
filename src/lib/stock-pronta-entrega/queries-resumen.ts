import type { Pool } from "pg";
import { resolveDepositoCodigo } from "@/lib/deposito-rimec/rimec-csv-sdrm";
import {
  PE_CODIGO_BARRAS_EXPR,
  PE_DEPOSITO_COL_EXPR,
  PE_MONTO_GS_EXPR,
  PE_PPD_FROM,
  PE_SALDO_EXPR,
  PE_TIPO_V2_EXPR,
} from "@/lib/stock-pronta-entrega/pe-ppd-sql";

export type PeResumenRamo = {
  tipo_v2_id: number;
  label: string;
  uds: number;
  filas: number;
  monto_gs: number;
  pares_inicial: number;
  pares_vendidos: number;
  pares_saldo: number;
  skus: number;
};
export type PeResumenDeposito = {
  deposito_codigo: string;
  columna_stock_legal: string;
  uds: number;
  filas: number;
};

export type StockProntaEntregaResumen = {
  batch_label: string;
  fecha_importacion: string | null;
  filas: number;
  skus: number;
  uds_total: number;
  uds_inicial: number;
  uds_vendidas: number;
  monto_gs: number;
  calzado: PeResumenRamo;
  confecciones: PeResumenRamo;
  por_deposito: PeResumenDeposito[];
  violacion: "HIEDRA_VENENOSA_PE";
  origen: "pedido_proveedor_detalle";
};

const EMPTY_PE_RAMO = (tipo_v2_id: number, label: string): PeResumenRamo => ({
  tipo_v2_id,
  label,
  uds: 0,
  filas: 0,
  monto_gs: 0,
  pares_inicial: 0,
  pares_vendidos: 0,
  pares_saldo: 0,
  skus: 0,
});

/** Fallback SSR cuando DATABASE_URL no está configurada (build + demo local). */
export const EMPTY_STOCK_PE_RESUMEN: StockProntaEntregaResumen = {
  batch_label: "—",
  fecha_importacion: null,
  filas: 0,
  skus: 0,
  uds_total: 0,
  uds_inicial: 0,
  uds_vendidas: 0,
  monto_gs: 0,
  calzado: EMPTY_PE_RAMO(1, "CALZADO"),
  confecciones: EMPTY_PE_RAMO(2, "CONFECCIONES"),
  por_deposito: [],
  violacion: "HIEDRA_VENENOSA_PE",
  origen: "pedido_proveedor_detalle",
};

function buildPeFilters(
  opts?: { deposito?: string; batch?: string; tipo_v2?: number },
  saldoPositivo = true,
) {
  const params: unknown[] = [];
  const filters: string[] = [
    `pp.entidad_comercial = 'STOCK'`,
    `pp.deposito_codigo IS NOT NULL`,
    `pp.estado_transito = 'EN_DEPOSITO'`,
    `pp.categoria_id = 1`,
    `lower(trim(qa.descripcion)) = lower('Pronta entrega')`,
  ];
  if (saldoPositivo) {
    filters.push(`GREATEST(0, COALESCE(ppd.cantidad_pares, 0) - COALESCE(ppd.pares_vendidos, 0)) > 0`);
  }

  if (opts?.deposito) {
    const dep = resolveDepositoCodigo(opts.deposito);
    if (dep) {
      params.push(dep);
      filters.push(`pp.deposito_codigo = $${params.length}`);
    }
  }
  if (opts?.batch) {
    params.push(opts.batch);
    filters.push(`pp.numero_proforma = $${params.length}`);
  }
  if (opts?.tipo_v2 === 1 || opts?.tipo_v2 === 2) {
    params.push(opts.tipo_v2);
    filters.push(`${PE_TIPO_V2_EXPR} = $${params.length}`);
  }

  return { params, where: `WHERE ${filters.join(" AND ")}` };
}

export async function getStockProntaEntregaResumen(
  pool: Pool,
  opts?: { deposito?: string; batch?: string; tipo_v2?: number },
): Promise<StockProntaEntregaResumen> {
  const { params } = buildPeFilters(opts);
  const { params: paramsAll, where: whereAll } = buildPeFilters(opts, false);
  const baseFilters = whereAll.replace(/^WHERE\s+/i, "");
  const batchParam = paramsAll.length ? paramsAll : params;

  const { rows } = await pool.query<{
    batch_label: string;
    max_created: string | null;
    filas: string;
    skus: string;
    uds_saldo: string;
    monto: string;
    uds_inicial: string;
    uds_vendidas: string;
    calz_uds: string;
    calz_filas: string;
    calz_monto: string;
    calz_inicial: string;
    calz_vendido: string;
    calz_saldo: string;
    calz_skus: string;
    conf_uds: string;
    conf_filas: string;
    conf_monto: string;
    conf_inicial: string;
    conf_vendido: string;
    conf_saldo: string;
    conf_skus: string;
    por_deposito: Array<{
      deposito_codigo: string;
      columna_stock_legal: string;
      uds: number;
      filas: number;
    }> | null;
  }>(
    `
    WITH pe AS (
      SELECT
        pp.numero_proforma,
        ppd.created_at,
        COALESCE(ppd.cantidad_pares, 0)::numeric AS cantidad_pares,
        COALESCE(ppd.pares_vendidos, 0)::numeric AS pares_vendidos,
        ${PE_SALDO_EXPR}::numeric AS saldo,
        ${PE_MONTO_GS_EXPR}::bigint AS monto,
        ${PE_CODIGO_BARRAS_EXPR} AS codigo_barras,
        ${PE_TIPO_V2_EXPR}::int AS tipo_v2_id,
        pp.deposito_codigo,
        ${PE_DEPOSITO_COL_EXPR} AS columna_stock_legal
      ${PE_PPD_FROM}
      WHERE ${baseFilters}
    ),
    dep AS (
      SELECT
        deposito_codigo,
        columna_stock_legal,
        COALESCE(SUM(saldo), 0)::bigint AS uds,
        COUNT(*)::int AS filas
      FROM pe
      WHERE saldo > 0
      GROUP BY deposito_codigo, columna_stock_legal
      ORDER BY deposito_codigo
    )
    SELECT
      COALESCE(MAX(numero_proforma) FILTER (WHERE saldo > 0), '—') AS batch_label,
      MAX(created_at) FILTER (WHERE saldo > 0)::text AS max_created,
      COUNT(*) FILTER (WHERE saldo > 0)::text AS filas,
      COUNT(DISTINCT codigo_barras) FILTER (WHERE saldo > 0)::text AS skus,
      COALESCE(SUM(saldo) FILTER (WHERE saldo > 0), 0)::text AS uds_saldo,
      COALESCE(SUM(monto) FILTER (WHERE saldo > 0), 0)::text AS monto,
      COALESCE(SUM(cantidad_pares), 0)::text AS uds_inicial,
      COALESCE(SUM(pares_vendidos), 0)::text AS uds_vendidas,
      COALESCE(SUM(saldo) FILTER (WHERE tipo_v2_id = 1 AND saldo > 0), 0)::text AS calz_uds,
      COUNT(*) FILTER (WHERE tipo_v2_id = 1 AND saldo > 0)::text AS calz_filas,
      COALESCE(SUM(monto) FILTER (WHERE tipo_v2_id = 1 AND saldo > 0), 0)::text AS calz_monto,
      COALESCE(SUM(cantidad_pares) FILTER (WHERE tipo_v2_id = 1), 0)::text AS calz_inicial,
      COALESCE(SUM(pares_vendidos) FILTER (WHERE tipo_v2_id = 1), 0)::text AS calz_vendido,
      COALESCE(SUM(saldo) FILTER (WHERE tipo_v2_id = 1), 0)::text AS calz_saldo,
      COUNT(DISTINCT codigo_barras) FILTER (WHERE tipo_v2_id = 1)::text AS calz_skus,
      COALESCE(SUM(saldo) FILTER (WHERE tipo_v2_id = 2 AND saldo > 0), 0)::text AS conf_uds,
      COUNT(*) FILTER (WHERE tipo_v2_id = 2 AND saldo > 0)::text AS conf_filas,
      COALESCE(SUM(monto) FILTER (WHERE tipo_v2_id = 2 AND saldo > 0), 0)::text AS conf_monto,
      COALESCE(SUM(cantidad_pares) FILTER (WHERE tipo_v2_id = 2), 0)::text AS conf_inicial,
      COALESCE(SUM(pares_vendidos) FILTER (WHERE tipo_v2_id = 2), 0)::text AS conf_vendido,
      COALESCE(SUM(saldo) FILTER (WHERE tipo_v2_id = 2), 0)::text AS conf_saldo,
      COUNT(DISTINCT codigo_barras) FILTER (WHERE tipo_v2_id = 2)::text AS conf_skus,
      (SELECT COALESCE(json_agg(json_build_object(
        'deposito_codigo', deposito_codigo,
        'columna_stock_legal', columna_stock_legal,
        'uds', uds,
        'filas', filas
      ) ORDER BY deposito_codigo), '[]'::json) FROM dep) AS por_deposito
    FROM pe
    `,
    batchParam,
  );

  const row = rows[0];
  const udsSaldo = Number(row?.uds_saldo ?? 0);
  const udsInicial = Number(row?.uds_inicial ?? 0);
  const udsVendidas = Number(row?.uds_vendidas ?? 0);
  const porDeposito = Array.isArray(row?.por_deposito) ? row.por_deposito : [];

  return {
    batch_label: row?.batch_label ?? "—",
    fecha_importacion: row?.max_created ?? null,
    filas: Number(row?.filas ?? 0),
    skus: Number(row?.skus ?? 0),
    uds_total: udsSaldo,
    uds_inicial: udsInicial,
    uds_vendidas: udsVendidas,
    monto_gs: Number(row?.monto ?? 0),
    calzado: {
      tipo_v2_id: 1,
      label: "CALZADO",
      uds: Number(row?.calz_saldo ?? row?.calz_uds ?? 0),
      filas: Number(row?.calz_filas ?? 0),
      monto_gs: Number(row?.calz_monto ?? 0),
      pares_inicial: Number(row?.calz_inicial ?? 0),
      pares_vendidos: Number(row?.calz_vendido ?? 0),
      pares_saldo: Number(row?.calz_saldo ?? 0),
      skus: Number(row?.calz_skus ?? 0),
    },
    confecciones: {
      tipo_v2_id: 2,
      label: "CONFECCIONES",
      uds: Number(row?.conf_saldo ?? row?.conf_uds ?? 0),
      filas: Number(row?.conf_filas ?? 0),
      monto_gs: Number(row?.conf_monto ?? 0),
      pares_inicial: Number(row?.conf_inicial ?? 0),
      pares_vendidos: Number(row?.conf_vendido ?? 0),
      pares_saldo: Number(row?.conf_saldo ?? 0),
      skus: Number(row?.conf_skus ?? 0),
    },
    por_deposito: porDeposito.map((d) => ({
      deposito_codigo: d.deposito_codigo,
      columna_stock_legal: d.columna_stock_legal,
      uds: Number(d.uds),
      filas: Number(d.filas),
    })),
    violacion: "HIEDRA_VENENOSA_PE",
    origen: "pedido_proveedor_detalle",
  };
}
