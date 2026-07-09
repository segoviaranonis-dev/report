import { Pool } from "pg";

/**
 * Pool singleton (Next.js server). Serverless Vercel: max 1 conexión por instancia.
 * Supabase pooler (:6543) + pgbouncer=true — evita EMAXCONN (límite ~200).
 */
export function isRimecDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

declare global {
  // eslint-disable-next-line no-var -- singleton dev HMR
  var __rimecPgPool: Pool | undefined;
}

function normalizePoolerUrl(raw: string): string {
  try {
    const u = new URL(raw);
    if (u.hostname.includes("pooler.supabase.com") && !u.searchParams.has("pgbouncer")) {
      u.searchParams.set("pgbouncer", "true");
    }
    return u.toString();
  } catch {
    return raw;
  }
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
    const connectionString = normalizePoolerUrl(String(url).trim());
    globalThis.__rimecPgPool = new Pool({
      connectionString,
      max,
      min: 0,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8_000,
      allowExitOnIdle: true,
      ssl:
        connectionString.includes("localhost") || connectionString.includes("127.0.0.1")
          ? false
          : { rejectUnauthorized: false },
    });
  }
  return globalThis.__rimecPgPool;
}