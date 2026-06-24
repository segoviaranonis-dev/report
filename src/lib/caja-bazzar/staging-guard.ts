import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

/** ABIERTO en bandeja = sesión POS en curso — bloquea sync depósito. */
export async function contarTicketsStagingPendientes(clienteId?: number): Promise<number> {
  if (!isRimecDatabaseConfigured()) return 0;
  const pool = getRimecPool();
  const exists = await pool.query<{ reg: boolean }>(
    `SELECT to_regclass('public.ticket_bandeja_cajero') IS NOT NULL AS reg`,
  );
  if (!exists.rows[0]?.reg) return 0;

  const r = clienteId
    ? await pool.query<{ n: string }>(
        `
          SELECT COUNT(DISTINCT staging_id)::text AS n
          FROM public.ticket_bandeja_cajero
          WHERE cliente_id = $1 AND estado = 'ABIERTO' AND activo = true AND staging_id IS NOT NULL
        `,
        [clienteId],
      )
    : await pool.query<{ n: string }>(
        `
          SELECT COUNT(DISTINCT staging_id)::text AS n
          FROM public.ticket_bandeja_cajero
          WHERE estado = 'ABIERTO' AND activo = true AND staging_id IS NOT NULL
        `,
      );

  return Number(r.rows[0]?.n ?? 0);
}

export async function assertSinStagingPendiente(clienteId?: number): Promise<string | null> {
  const n = await contarTicketsStagingPendientes(clienteId);
  if (n === 0) return null;
  const scope = clienteId ? `tienda ${clienteId}` : "holding";
  return `Hay ${n} factura(s) ABIERTA(s) en tablet en ${scope}. Cerrá o cancelá antes de actualizar stock.`;
}
