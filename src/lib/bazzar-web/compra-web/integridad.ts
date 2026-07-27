/**
 * Integridad bancaria pares — TRP detalle vs FI (cliente 5000).
 */
import type { PoolClient } from "pg";
import { getRimecPool } from "@/lib/rimec/pool";

export type TraspasoIntegridad = {
  fi_pares: number;
  td_pares: number;
  delta: number;
  ok: boolean;
  documento_ref: string | null;
};

export async function getTraspasoIntegridad(
  idTrp: number,
  client?: PoolClient,
): Promise<TraspasoIntegridad> {
  const sql = `
    SELECT
      t.documento_ref,
      COALESCE(fi.total_pares, 0)::int AS fi_pares,
      COALESCE((
        SELECT SUM(td.cantidad)::int FROM traspaso_detalle td WHERE td.traspaso_id = t.id
      ), 0) AS td_pares
    FROM traspaso t
    LEFT JOIN factura_interna fi ON fi.nro_factura = t.documento_ref
      AND fi.estado IN ('CONFIRMADA', 'RESERVADA')
    WHERE t.id = $1
  `;

  const run = client ? client.query.bind(client) : getRimecPool().query.bind(getRimecPool());
  const { rows } = await run<{
    documento_ref: string | null;
    fi_pares: number;
    td_pares: number;
  }>(sql, [idTrp]);

  if (!rows.length) {
    return { fi_pares: 0, td_pares: 0, delta: 0, ok: true, documento_ref: null };
  }

  const r = rows[0];
  const fiPares = Number(r.fi_pares) || 0;
  const tdPares = Number(r.td_pares) || 0;
  const delta = fiPares - tdPares;
  const ok = fiPares <= 0 || delta === 0;

  return {
    fi_pares: fiPares,
    td_pares: tdPares,
    delta,
    ok,
    documento_ref: r.documento_ref,
  };
}
