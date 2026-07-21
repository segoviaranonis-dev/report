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

export async function unlockPpFiOps(client: PoolClient, ppId: number): Promise<void> {
  await client.query(`SELECT pg_advisory_unlock($1::bigint)`, [ppFiLockKey(ppId)]);
}
