import type { PoolClient } from "pg";

/** Serializa cambio de biblioteca vs lote FI en el mismo PP. */
export function ppFiLockKey(ppId: number): bigint {
  return BigInt(ppId);
}

export async function tryLockPpFiOps(client: PoolClient, ppId: number): Promise<boolean> {
  const { rows } = await client.query<{ locked: boolean }>(
    `SELECT pg_try_advisory_lock($1::bigint) AS locked`,
    [ppFiLockKey(ppId)],
  );
  return rows[0]?.locked === true;
}

/** Libera locks FI huérfanos (timeout Vercel sin unlock en pool). */
export async function releaseStalePpFiLock(
  client: PoolClient,
  ppId: number,
  maxAgeSec = 90,
): Promise<number> {
  const key = ppFiLockKey(ppId);
  const { rows } = await client.query<{ pid: number }>(
    `SELECT l.pid::int AS pid
     FROM pg_locks l
     JOIN pg_stat_activity a ON a.pid = l.pid
     WHERE l.locktype = 'advisory'
       AND l.objid = $1::bigint
       AND l.granted = true
       AND (
         a.state IN ('idle', 'idle in transaction')
         OR a.query_start < NOW() - ($2::text || ' seconds')::interval
       )`,
    [key, String(maxAgeSec)],
  );
  let released = 0;
  for (const { pid } of rows) {
    const r = await client.query<{ ok: boolean }>(
      `SELECT pg_terminate_backend($1::int) AS ok`,
      [pid],
    );
    if (r.rows[0]?.ok) released++;
  }
  return released;
}

export async function tryLockPpFiOpsWithStaleRecovery(
  client: PoolClient,
  ppId: number,
): Promise<boolean> {
  if (await tryLockPpFiOps(client, ppId)) return true;
  await releaseStalePpFiLock(client, ppId);
  return tryLockPpFiOps(client, ppId);
}

export async function unlockPpFiOps(client: PoolClient, ppId: number): Promise<void> {
  await client.query(`SELECT pg_advisory_unlock($1::bigint)`, [ppFiLockKey(ppId)]);
}
