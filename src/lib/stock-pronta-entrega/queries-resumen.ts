import type { Pool } from "pg";
import { resolveDepositoCodigo } from "@/lib/deposito-rimec/rimec-csv-sdrm";

export type PeResumenRamo = { tipo_v2_id: number; label: string; uds: number; filas: number; monto_gs: number };
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
  uds_vendidas: number;
  monto_gs: number;
  calzado: PeResumenRamo;
  confecciones: PeResumenRamo;
  por_deposito: PeResumenDeposito[];
  violacion: "HIEDRA_VENENOSA_PE";
};

export async function getStockProntaEntregaResumen(
  pool: Pool,
  opts?: { deposito?: string; batch?: string; tipo_v2?: number },
): Promise<StockProntaEntregaResumen> {
  const params: unknown[] = [];
  const filters: string[] = ["s.cantidad > 0"];

  if (opts?.deposito) {
    const dep = resolveDepositoCodigo(opts.deposito);
    if (dep) {
      params.push(dep);
      filters.push(`s.deposito_codigo = $${params.length}`);
    }
  }
  if (opts?.batch) {
    params.push(opts.batch);
    filters.push(`s.batch_label = $${params.length}`);
  }
  if (opts?.tipo_v2 === 1 || opts?.tipo_v2 === 2) {
    params.push(opts.tipo_v2);
    filters.push(`s.tipo_v2_id = $${params.length}`);
  }

  const where = `WHERE ${filters.join(" AND ")}`;

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
      COALESCE(MAX(s.batch_label), '—') AS batch_label,
      COUNT(*)::text AS filas,
      COUNT(DISTINCT s.codigo_barras)::text AS skus,
      COALESCE(SUM(s.cantidad), 0)::text AS uds,
      COALESCE(SUM(s.monto_gs), 0)::text AS monto,
      MAX(s.created_at)::text AS max_created
    FROM stock_pronta_entrega_rimec s
    ${where}
    `,
    params,
  );

  const row = agg.rows[0];
  const calzadoQ = await pool.query<{ uds: string; filas: string; monto: string }>(
    `SELECT COALESCE(SUM(cantidad),0)::text AS uds, COUNT(*)::text AS filas,
            COALESCE(SUM(monto_gs),0)::text AS monto
     FROM stock_pronta_entrega_rimec s ${where} AND s.tipo_v2_id = 1`,
    params,
  );
  const confQ = await pool.query<{ uds: string; filas: string; monto: string }>(
    `SELECT COALESCE(SUM(cantidad),0)::text AS uds, COUNT(*)::text AS filas,
            COALESCE(SUM(monto_gs),0)::text AS monto
     FROM stock_pronta_entrega_rimec s ${where} AND s.tipo_v2_id = 2`,
    params,
  );

  const depQ = await pool.query<{
    deposito_codigo: string;
    columna_stock_legal: string;
    uds: string;
    filas: string;
  }>(
    `
    SELECT
      s.deposito_codigo,
      COALESCE(s.columna_stock_legal,
        CASE s.deposito_codigo
          WHEN 'D1' THEN 'S00_D1'
          WHEN 'DEP2' THEN 'S00_DEP2'
          WHEN 'D3' THEN 'S00_D3'
          ELSE s.deposito_codigo
        END
      ) AS columna_stock_legal,
      COALESCE(SUM(s.cantidad), 0)::text AS uds,
      COUNT(*)::text AS filas
    FROM stock_pronta_entrega_rimec s
    ${where}
    GROUP BY s.deposito_codigo, s.columna_stock_legal
    ORDER BY s.deposito_codigo
    `,
    params,
  );

  return {
    batch_label: row?.batch_label ?? "—",
    fecha_importacion: row?.max_created ?? null,
    filas: Number(row?.filas ?? 0),
    skus: Number(row?.skus ?? 0),
    uds_total: Number(row?.uds ?? 0),
    uds_vendidas: 0,
    monto_gs: Number(row?.monto ?? 0),
    calzado: {
      tipo_v2_id: 1,
      label: "CALZADO",
      uds: Number(calzadoQ.rows[0]?.uds ?? 0),
      filas: Number(calzadoQ.rows[0]?.filas ?? 0),
      monto_gs: Number(calzadoQ.rows[0]?.monto ?? 0),
    },
    confecciones: {
      tipo_v2_id: 2,
      label: "CONFECCIONES",
      uds: Number(confQ.rows[0]?.uds ?? 0),
      filas: Number(confQ.rows[0]?.filas ?? 0),
      monto_gs: Number(confQ.rows[0]?.monto ?? 0),
    },
    por_deposito: depQ.rows.map((d) => ({
      deposito_codigo: d.deposito_codigo,
      columna_stock_legal: d.columna_stock_legal,
      uds: Number(d.uds),
      filas: Number(d.filas),
    })),
    violacion: "HIEDRA_VENENOSA_PE",
  };
}
