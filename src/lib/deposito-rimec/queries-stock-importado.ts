import type { Pool } from "pg";
import type { RimecDepositoCodigo } from "./rimec-csv-sdrm";
import {
  PE_CODIGO_BARRAS_EXPR,
  PE_MONTO_GS_EXPR,
  PE_PPD_FROM,
  PE_SALDO_EXPR,
} from "@/lib/stock-pronta-entrega/pe-ppd-sql";

export type StockImportadoRow = {
  id: number;
  deposito_codigo: RimecDepositoCodigo;
  codigo_barras: string;
  lr: string;
  material: string;
  color: string;
  grada: string;
  cantidad: number;
  precio_unitario_gs: number;
  monto_gs: number;
  batch_label: string;
};

export type StockImportadoSummary = {
  filas: number;
  skus: number;
  cantidad_total: number;
  monto_gs: number;
  batches: string[];
  por_deposito: { deposito_codigo: string; filas: number; cantidad: number; monto_gs: number }[];
};

function peFilters(opts?: { deposito?: string; batch?: string }) {
  const params: unknown[] = [];
  const filters: string[] = [
    `pp.entidad_comercial = 'STOCK'`,
    `pp.deposito_codigo IS NOT NULL`,
    `pp.estado_transito = 'EN_DEPOSITO'`,
    `pp.categoria_id = 1`,
    `lower(trim(qa.descripcion)) = lower('Pronta entrega')`,
    `${PE_SALDO_EXPR} > 0`,
  ];
  if (opts?.deposito) {
    params.push(opts.deposito);
    filters.push(`pp.deposito_codigo = $${params.length}`);
  }
  if (opts?.batch) {
    params.push(opts.batch);
    filters.push(`pp.numero_proforma = $${params.length}`);
  }
  return { params, where: `WHERE ${filters.join(" AND ")}` };
}

export async function getStockImportado(
  pool: Pool,
  opts?: { deposito?: string; batch?: string },
): Promise<{ rows: StockImportadoRow[]; summary: StockImportadoSummary }> {
  const { params, where } = peFilters(opts);

  const { rows } = await pool.query<{
    id: string;
    deposito_codigo: RimecDepositoCodigo;
    codigo_barras: string;
    lr: string;
    material: string;
    color: string;
    grada: string;
    cantidad: string;
    precio_unitario_gs: string;
    monto_gs: string;
    batch_label: string;
  }>(
    `
    SELECT
      ppd.id,
      pp.deposito_codigo,
      ${PE_CODIGO_BARRAS_EXPR} AS codigo_barras,
      COALESCE(
        NULLIF(TRIM(CONCAT(ppd.linea, '.', ppd.referencia)), '.'),
        ppd.nombre,
        '—'
      ) AS lr,
      COALESCE(ppd.descp_material, '—') AS material,
      COALESCE(ppd.descp_color, '—') AS color,
      COALESCE(NULLIF(TRIM(ppd.grada), ''), '—') AS grada,
      ${PE_SALDO_EXPR}::text AS cantidad,
      COALESCE(ppd.unit_fob_ajustado, 0)::text AS precio_unitario_gs,
      ${PE_MONTO_GS_EXPR}::text AS monto_gs,
      pp.numero_proforma AS batch_label
    ${PE_PPD_FROM}
    ${where}
    ORDER BY pp.deposito_codigo, ppd.linea, ppd.referencia
    LIMIT 8000
    `,
    params,
  );

  const mapped: StockImportadoRow[] = rows.map((r) => ({
    id: Number(r.id),
    deposito_codigo: r.deposito_codigo,
    codigo_barras: r.codigo_barras,
    lr: r.lr,
    material: r.material,
    color: r.color,
    grada: r.grada,
    cantidad: Number(r.cantidad),
    precio_unitario_gs: Number(r.precio_unitario_gs),
    monto_gs: Number(r.monto_gs),
    batch_label: r.batch_label,
  }));

  const agg = await pool.query<{
    deposito_codigo: string;
    filas: string;
    cantidad: string;
    monto_gs: string;
  }>(
    `
    SELECT pp.deposito_codigo,
           COUNT(*)::text AS filas,
           SUM(${PE_SALDO_EXPR})::text AS cantidad,
           SUM(${PE_MONTO_GS_EXPR})::text AS monto_gs
    ${PE_PPD_FROM}
    ${where}
    GROUP BY pp.deposito_codigo
    ORDER BY pp.deposito_codigo
    `,
    params,
  );

  const batchesRes = await pool.query<{ batch_label: string }>(
    `
    SELECT DISTINCT pp.numero_proforma AS batch_label
    FROM pedido_proveedor pp
    WHERE pp.entidad_comercial = 'STOCK'
      AND pp.deposito_codigo IS NOT NULL
    ORDER BY pp.numero_proforma DESC
    `,
  );

  const skus = new Set(mapped.map((r) => r.codigo_barras)).size;
  const summary: StockImportadoSummary = {
    filas: mapped.length,
    skus,
    cantidad_total: mapped.reduce((a, r) => a + r.cantidad, 0),
    monto_gs: mapped.reduce((a, r) => a + r.monto_gs, 0),
    batches: batchesRes.rows.map((b) => b.batch_label),
    por_deposito: agg.rows.map((d) => ({
      deposito_codigo: d.deposito_codigo,
      filas: Number(d.filas),
      cantidad: Number(d.cantidad),
      monto_gs: Number(d.monto_gs),
    })),
  };

  return { rows: mapped, summary };
}
