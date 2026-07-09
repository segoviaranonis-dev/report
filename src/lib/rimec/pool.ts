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

/** Serverless: 1 conexión por instancia — evita EMAXCONN Supabase pooler (límite ~200). */
function resolvePgPoolMax(): number {
  const maxRaw = Number(process.env.RIMEC_PG_POOL_MAX);
  if (Number.isFinite(maxRaw) && maxRaw >= 1 && maxRaw <= 32) {
    return maxRaw;
  }
  if (process.env.VERCEL === "1" || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return 1;
  }
  return 8;
}

export function getRimecPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url || !String(url).trim()) {
    throw new Error("DATABASE_URL no configurada (connection string Postgres, solo servidor).");
  }
  if (!globalThis.__rimecPgPool) {
    const max = resolvePgPoolMax();
    globalThis.__rimecPgPool = new Pool({
      connectionString: url,
      max,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 10_000,
      allowExitOnIdle: true,
      ssl:
        url.includes("localhost") || url.includes("127.0.0.1")
          ? false
          : { rejectUnauthorized: false },
    });
  }
  return globalThis.__rimecPgPool;
}
