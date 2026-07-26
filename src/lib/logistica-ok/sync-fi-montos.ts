import type { Pool, PoolClient } from "pg";
import { sqlFiCajasSubquery } from "./fi-cajas";

/** Propaga total_monto / pares / cajas FI → fila Logística OK (post-recalc LP). */
export async function syncLogisticaMontosDesdeFi(
  client: Pool | PoolClient,
  fiId: number,
): Promise<{ updated: boolean; monto_neto: number | null }> {
  const cajasSql = sqlFiCajasSubquery("fi");
  const { rows } = await client.query<{ monto_neto: string | null; updated: boolean }>(
    `
    WITH upd AS (
      UPDATE logistica_pendiente_confirmacion l
      SET monto_neto = fi.total_monto,
          pares = COALESCE(fi.total_pares, 0)::int,
          cajas = ${cajasSql},
          updated_at = now()
      FROM factura_interna fi
      WHERE l.factura_interna_id = fi.id
        AND fi.id = $1
      RETURNING l.monto_neto::text AS monto_neto
    )
    SELECT monto_neto, true AS updated FROM upd
    UNION ALL
    SELECT NULL::text, false AS updated
    WHERE NOT EXISTS (SELECT 1 FROM upd)
    LIMIT 1
    `,
    [fiId],
  );
  const r = rows[0];
  return {
    updated: Boolean(r?.updated),
    monto_neto: r?.monto_neto != null ? Number(r.monto_neto) : null,
  };
}
