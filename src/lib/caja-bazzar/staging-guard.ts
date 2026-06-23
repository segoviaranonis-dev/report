import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

/** ABIERTO o CERRADO = sesión POS en curso — bloquea sync depósito. */
export async function contarTicketsStagingPendientes(clienteId?: number): Promise<number> {
  if (!isRimecDatabaseConfigured()) return 0;
  const pool = getRimecPool();
  const exists = await pool.query<{ reg: boolean }>(
    `SELECT to_regclass('public.ticket_pos_staging') IS NOT NULL AS reg`,
  );
  if (!exists.rows[0]?.reg) return 0;

  const r = clienteId
    ? await pool.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM public.ticket_pos_staging
         WHERE cliente_id = $1 AND estado IN ('ABIERTO', 'CERRADO')`,
        [clienteId],
      )
    : await pool.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM public.ticket_pos_staging
         WHERE estado IN ('ABIERTO', 'CERRADO')`,
      );

  return Number(r.rows[0]?.n ?? 0);
}

export async function assertSinStagingPendiente(clienteId?: number): Promise<string | null> {
  const n = await contarTicketsStagingPendientes(clienteId);
  if (n === 0) return null;
  const scope = clienteId ? `tienda ${clienteId}` : "holding";
  return `Hay ${n} ticket(s) intermedio(s) pendiente(s) en ${scope}. Cerrá → ORO o cancelá antes de actualizar stock.`;
}
