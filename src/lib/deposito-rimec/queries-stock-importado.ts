import type { Pool } from "pg";
import type { RimecDepositoCodigo } from "./rimec-csv-sdrm";

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

export async function getStockImportado(
  pool: Pool,
  opts?: { deposito?: string; batch?: string },
): Promise<{ rows: StockImportadoRow[]; summary: StockImportadoSummary }> {
  const params: unknown[] = [];
  const filters: string[] = ["s.cantidad > 0"];

  if (opts?.deposito) {
    params.push(opts.deposito);
    filters.push(`s.deposito_codigo = $${params.length}`);
  }
  if (opts?.batch) {
    params.push(opts.batch);
    filters.push(`s.batch_label = $${params.length}`);
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

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
      s.id,
      s.deposito_codigo,
      s.codigo_barras,
      COALESCE(
        NULLIF(TRIM(CONCAT(l.codigo_proveedor::text, '.', r.codigo_proveedor::text)), '.'),
        s.cod_art_proveedor,
        '—'
      ) AS lr,
      COALESCE(m.descripcion, s.excel_material_code, '—') AS material,
      COALESCE(c.nombre, s.excel_color_code, '—') AS color,
      COALESCE(NULLIF(TRIM(s.grada), ''), '—') AS grada,
      s.cantidad::text,
      s.precio_unitario_gs::text,
      s.monto_gs::text,
      s.batch_label
    FROM stock_pronta_entrega_rimec s
    LEFT JOIN linea l ON l.id = s.linea_id
    LEFT JOIN referencia r ON r.id = s.referencia_id
    LEFT JOIN material m ON m.id = s.material_id
    LEFT JOIN color c ON c.id = s.color_id
    ${where}
    ORDER BY s.deposito_codigo, s.codigo_barras
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
    SELECT deposito_codigo,
           COUNT(*)::text AS filas,
           SUM(cantidad)::text AS cantidad,
           SUM(monto_gs)::text AS monto_gs
    FROM stock_pronta_entrega_rimec s
    ${where}
    GROUP BY deposito_codigo
    ORDER BY deposito_codigo
    `,
    params,
  );

  const batchesRes = await pool.query<{ batch_label: string }>(
    `SELECT DISTINCT batch_label FROM stock_pronta_entrega_rimec ORDER BY batch_label DESC`,
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
