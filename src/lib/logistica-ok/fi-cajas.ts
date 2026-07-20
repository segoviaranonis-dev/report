import type { Pool, PoolClient } from "pg";

/** Cajas canónicas logística — SUM(factura_interna_detalle.cajas) */
export function sqlFiCajasSubquery(fiAlias = "fi"): string {
  return `COALESCE((
    SELECT SUM(fid.cajas)::int
    FROM factura_interna_detalle fid
    WHERE fid.factura_id = ${fiAlias}.id
  ), 0)`;
}

export async function getLogisticaPpStats(
  client: Pool | PoolClient,
  ppId: number,
): Promise<{ n_fi: number; cajas: number }> {
  const { rows } = await client.query<{ n_fi: string; cajas: string }>(
    `
    SELECT COUNT(*)::text AS n_fi, COALESCE(SUM(cajas), 0)::text AS cajas
    FROM logistica_pendiente_confirmacion
    WHERE pedido_proveedor_id = $1
    `,
    [ppId],
  );
  return {
    n_fi: Number(rows[0]?.n_fi ?? 0),
    cajas: Number(rows[0]?.cajas ?? 0),
  };
}
