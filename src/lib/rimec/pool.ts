import { Pool } from "pg";

/**
 * Pool singleton (Next.js server). Prioridad: pocas conexiones estables y reuso entre requests.
 * Ajustar `max` vía `RIMEC_PG_POOL_MAX` si el host lo permite y hay mucha concurrencia de snapshot.
 */
export function isRimecDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

declare global {
  // eslint-disable-next-line no-var -- singleton dev HMR
  var __rimecPgPool: Pool | undefined;
}

export function getRimecPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url || !String(url).trim()) {
    throw new Error("DATABASE_URL no configurada (connection string Postgres, solo servidor).");
  }
  if (!globalThis.__rimecPgPool) {
    const maxRaw = Number(process.env.RIMEC_PG_POOL_MAX);
    const max = Number.isFinite(maxRaw) && maxRaw >= 2 && maxRaw <= 32 ? maxRaw : 8;
    globalThis.__rimecPgPool = new Pool({
      connectionString: url,
      max,
      ssl:
        url.includes("localhost") || url.includes("127.0.0.1")
          ? false
          : { rejectUnauthorized: false },
    });
  }
  return globalThis.__rimecPgPool;
}
