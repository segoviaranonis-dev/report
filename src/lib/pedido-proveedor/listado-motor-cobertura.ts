import type { Pool } from "pg";

export type EventoCoberturaPp = {
  evento_id: number;
  skus_match: number;
  skus_total: number;
  pct: number;
};

/** Cuántas moléculas L+R de las FI del PP existen en cada evento motor. */
export async function listEventoCoberturaPp(pool: Pool, ppId: number): Promise<EventoCoberturaPp[]> {
  const totalRes = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM (
       SELECT DISTINCT ppd.linea, ppd.referencia
       FROM factura_interna_detalle fid
       JOIN factura_interna fi ON fi.id = fid.factura_id
       JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
       WHERE fi.pp_id = $1
     ) t`,
    [ppId],
  );
  const skusTotal = Number(totalRes.rows[0]?.n ?? 0);
  if (skusTotal === 0) return [];

  const { rows } = await pool.query<{ evento_id: string; skus_match: string }>(
    `
    WITH pp_lr AS (
      SELECT DISTINCT TRIM(ppd.linea) AS linea, TRIM(ppd.referencia) AS referencia
      FROM factura_interna_detalle fid
      JOIN factura_interna fi ON fi.id = fid.factura_id
      JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
      WHERE fi.pp_id = $1
    )
    SELECT pl.evento_id::text AS evento_id,
           COUNT(DISTINCT (TRIM(pl.linea_codigo), TRIM(pl.referencia_codigo)))::text AS skus_match
    FROM precio_lista pl
    INNER JOIN pp_lr lr
      ON TRIM(pl.linea_codigo) = lr.linea AND TRIM(pl.referencia_codigo) = lr.referencia
    GROUP BY pl.evento_id
    ORDER BY COUNT(DISTINCT (TRIM(pl.linea_codigo), TRIM(pl.referencia_codigo))) DESC
    `,
    [ppId],
  );

  return rows.map((r) => {
    const skus_match = Number(r.skus_match ?? 0);
    return {
      evento_id: Number(r.evento_id),
      skus_match,
      skus_total: skusTotal,
      pct: Math.round((skus_match / skusTotal) * 100),
    };
  });
}

export function coberturaEventoMap(list: EventoCoberturaPp[]): Map<number, EventoCoberturaPp> {
  return new Map(list.map((x) => [x.evento_id, x]));
}

/** Cobertura evento vs moléculas de una FI concreta. */
export async function getEventoCoberturaFi(
  pool: Pool,
  fiId: number,
  eventoId: number,
): Promise<{ skus_match: number; skus_total: number; pct: number }> {
  const totalRes = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM (
       SELECT DISTINCT ppd.linea, ppd.referencia
       FROM factura_interna_detalle fid
       JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
       WHERE fid.factura_id = $1
     ) t`,
    [fiId],
  );
  const skusTotal = Number(totalRes.rows[0]?.n ?? 0);
  if (skusTotal === 0) return { skus_match: 0, skus_total: 0, pct: 0 };

  const matchRes = await pool.query<{ n: string }>(
    `
    WITH fi_lr AS (
      SELECT DISTINCT TRIM(ppd.linea) AS linea, TRIM(ppd.referencia) AS referencia
      FROM factura_interna_detalle fid
      JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
      WHERE fid.factura_id = $1
    )
    SELECT COUNT(*)::text AS n
    FROM fi_lr lr
    WHERE EXISTS (
      SELECT 1 FROM precio_lista pl
      WHERE pl.evento_id = $2
        AND TRIM(pl.linea_codigo) = lr.linea
        AND TRIM(pl.referencia_codigo) = lr.referencia
    )
    `,
    [fiId, eventoId],
  );
  const skusMatch = Number(matchRes.rows[0]?.n ?? 0);
  return {
    skus_match: skusMatch,
    skus_total: skusTotal,
    pct: Math.round((skusMatch / skusTotal) * 100),
  };
}
