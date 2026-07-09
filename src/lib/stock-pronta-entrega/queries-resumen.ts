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
  const { params, where } = buildPeFilters(opts);
  const { params: paramsAll, where: whereAll } = buildPeFilters(opts, false);

  const vendidoQ = await pool.query<{ inicial: string; saldo: string; vendido: string }>(
    `
    SELECT
      COALESCE(SUM(COALESCE(ppd.cantidad_pares, 0)), 0)::text AS inicial,
      COALESCE(SUM(${PE_SALDO_EXPR}), 0)::text AS saldo,
      COALESCE(SUM(COALESCE(ppd.pares_vendidos, 0)), 0)::text AS vendido
    ${PE_PPD_FROM}
    ${whereAll}
    `,
    paramsAll,
  );

  const agg = await pool.query<{
    batch_label: string;
    filas: string;
    skus: string;
    uds: string;
    monto: string;
    max_created: string | null;
  }>(
    `
    SELECT
      COALESCE(MAX(pp.numero_proforma), '—') AS batch_label,
      COUNT(*)::text AS filas,
      COUNT(DISTINCT ${PE_CODIGO_BARRAS_EXPR})::text AS skus,
      COALESCE(SUM(${PE_SALDO_EXPR}), 0)::text AS uds,
      COALESCE(SUM(${PE_MONTO_GS_EXPR}), 0)::text AS monto,
      MAX(ppd.created_at)::text AS max_created
    ${PE_PPD_FROM}
    ${where}
    `,
    params,
  );

  const row = agg.rows[0];
  const v = vendidoQ.rows[0];
  const udsInicial = Number(v?.inicial ?? row?.uds ?? 0);
  const udsSaldo = Number(row?.uds ?? 0);
  const udsVendidas = Number(v?.vendido ?? Math.max(udsInicial - udsSaldo, 0));

  const calzadoQ = await pool.query<{
    uds: string;
    filas: string;
    monto: string;
    inicial: string;
    vendido: string;
    saldo: string;
    skus: string;
  }>(
    `
    SELECT
      COALESCE(SUM(${PE_SALDO_EXPR}),0)::text AS uds,
      COUNT(*)::text AS filas,
      COALESCE(SUM(${PE_MONTO_GS_EXPR}),0)::text AS monto,
      COALESCE(SUM(COALESCE(ppd.cantidad_pares, 0)), 0)::text AS inicial,
      COALESCE(SUM(COALESCE(ppd.pares_vendidos, 0)), 0)::text AS vendido,
      COALESCE(SUM(${PE_SALDO_EXPR}), 0)::text AS saldo,
      COUNT(DISTINCT ${PE_CODIGO_BARRAS_EXPR})::text AS skus
    ${PE_PPD_FROM}
    ${whereAll} AND ${PE_TIPO_V2_EXPR} = 1
    `,
    paramsAll,
  );
  const confQ = await pool.query<{
    uds: string;
    filas: string;
    monto: string;
    inicial: string;
    vendido: string;
    saldo: string;
    skus: string;
  }>(
    `
    SELECT
      COALESCE(SUM(${PE_SALDO_EXPR}),0)::text AS uds,
      COUNT(*)::text AS filas,
      COALESCE(SUM(${PE_MONTO_GS_EXPR}),0)::text AS monto,
      COALESCE(SUM(COALESCE(ppd.cantidad_pares, 0)), 0)::text AS inicial,
      COALESCE(SUM(COALESCE(ppd.pares_vendidos, 0)), 0)::text AS vendido,
      COALESCE(SUM(${PE_SALDO_EXPR}), 0)::text AS saldo,
      COUNT(DISTINCT ${PE_CODIGO_BARRAS_EXPR})::text AS skus
    ${PE_PPD_FROM}
    ${whereAll} AND ${PE_TIPO_V2_EXPR} = 2
    `,
    paramsAll,
  );

  const depQ = await pool.query<{
    deposito_codigo: string;
    columna_stock_legal: string;
    uds: string;
    filas: string;
  }>(
    `
    SELECT
      pp.deposito_codigo,
      ${PE_DEPOSITO_COL_EXPR} AS columna_stock_legal,
      COALESCE(SUM(${PE_SALDO_EXPR}), 0)::text AS uds,
      COUNT(*)::text AS filas
    ${PE_PPD_FROM}
    ${where}
    GROUP BY pp.deposito_codigo
    ORDER BY pp.deposito_codigo
    `,
    params,
  );

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
      uds: Number(calzadoQ.rows[0]?.saldo ?? calzadoQ.rows[0]?.uds ?? 0),
      filas: Number(calzadoQ.rows[0]?.filas ?? 0),
      monto_gs: Number(calzadoQ.rows[0]?.monto ?? 0),
      pares_inicial: Number(calzadoQ.rows[0]?.inicial ?? 0),
      pares_vendidos: Number(calzadoQ.rows[0]?.vendido ?? 0),
      pares_saldo: Number(calzadoQ.rows[0]?.saldo ?? 0),
      skus: Number(calzadoQ.rows[0]?.skus ?? 0),
    },
    confecciones: {
      tipo_v2_id: 2,
      label: "CONFECCIONES",
      uds: Number(confQ.rows[0]?.saldo ?? confQ.rows[0]?.uds ?? 0),
      filas: Number(confQ.rows[0]?.filas ?? 0),
      monto_gs: Number(confQ.rows[0]?.monto ?? 0),
      pares_inicial: Number(confQ.rows[0]?.inicial ?? 0),
      pares_vendidos: Number(confQ.rows[0]?.vendido ?? 0),
      pares_saldo: Number(confQ.rows[0]?.saldo ?? 0),
      skus: Number(confQ.rows[0]?.skus ?? 0),
    },
    por_deposito: depQ.rows.map((d) => ({
      deposito_codigo: d.deposito_codigo,
      columna_stock_legal: d.columna_stock_legal,
      uds: Number(d.uds),
      filas: Number(d.filas),
    })),
    violacion: "HIEDRA_VENENOSA_PE",
    origen: "pedido_proveedor_detalle",
  };
}
