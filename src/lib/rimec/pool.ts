import { Pool } from "pg";
import { isPoolSaturatedError } from "@/lib/rimec/pool-saturated";

/**
 * Acceso Postgres para Report (Next.js server).
 *
 * Vercel/serverless:
 * - URL pooler Supabase (:6543) + pgbouncer=true + connection_limit=1
 * - Serializado por lambda; soporta pool.query y pool.connect (transacciones motor precios / digitación)
 * - Reintentos automáticos ante EMAXCONN (límite ~200 en pooler)
 *
 * Local: Pool singleton clásico (max 8).
 *
 * Doc operativa: report/docs/EMAXCONN_SOLUCION_INTEGRAL.md
 */
export function isRimecDatabaseConfigured(): boolean {
  return Boolean(resolveDatabaseUrl());
}

/** Preferir pooler explícito si existe (Vercel env). */
export function resolveDatabaseUrl(): string | undefined {
  const pooler = process.env.DATABASE_POOLER_URL?.trim();
  if (pooler) return pooler;
  const direct = process.env.DATABASE_URL?.trim();
  return direct || undefined;
}

export function isDirectSupabasePostgres(url: string): boolean {
  return /db\.[a-z0-9]+\.supabase\.co/i.test(url) && /:5432/.test(url);
}

declare global {
  // eslint-disable-next-line no-var -- singleton dev HMR
  var __rimecPgPool: Pool | undefined;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizePoolerUrl(raw: string): string {
  try {
    const u = new URL(raw);
    if (u.hostname.includes("pooler.supabase.com") || u.port === "6543") {
      if (!u.searchParams.has("pgbouncer")) u.searchParams.set("pgbouncer", "true");
      if (!u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", "1");
    }
    return u.toString();
  } catch {
    return raw;
  }
}

function resolveSsl(connectionString: string) {
  return connectionString.includes("localhost") || connectionString.includes("127.0.0.1")
    ? false
    : { rejectUnauthorized: false };
}

function isVercelRuntime(): boolean {
  return process.env.VERCEL === "1" || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
}

function resolvePgPoolMax(): number {
  const maxRaw = Number(process.env.RIMEC_PG_POOL_MAX);
  if (Number.isFinite(maxRaw) && maxRaw >= 1 && maxRaw <= 32) return maxRaw;
  if (isVercelRuntime()) return 1;
  return 8;
}

function resolveRetryMax(): number {
  const n = Number(process.env.RIMEC_PG_RETRY_MAX);
  return Number.isFinite(n) && n >= 1 && n <= 12 ? n : 8;
}

/** Pool con reintento en query() ante EMAXCONN (Vercel). */
function wrapPoolWithRetry(base: Pool): Pool {
  const maxAttempts = resolveRetryMax();
  const originalQuery = base.query.bind(base);

  async function queryWithRetry(...args: Parameters<Pool["query"]>) {
    let lastError: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await originalQuery(...args);
      } catch (e) {
        lastError = e;
        if (isPoolSaturatedError(e) && attempt < maxAttempts - 1) {
          await sleep(200 * 2 ** attempt + Math.random() * 400);
          continue;
        }
        throw e;
      }
    }
    throw lastError;
  }

  return new Proxy(base, {
    get(target, prop, receiver) {
      if (prop === "query") return queryWithRetry;
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as Pool;
}

export function getRimecPool(): Pool {
  const rawUrl = resolveDatabaseUrl();
  if (!rawUrl) {
    throw new Error("DATABASE_URL no configurada (connection string Postgres, solo servidor).");
  }

  if (isVercelRuntime() && isDirectSupabasePostgres(rawUrl)) {
    console.warn(
      "[rimec/pool] DATABASE_URL usa Postgres directo :5432. En Vercel usar DATABASE_POOLER_URL (pooler :6543).",
    );
  }

  const connectionString = normalizePoolerUrl(rawUrl);
  const ssl = resolveSsl(connectionString);

  if (!globalThis.__rimecPgPool) {
    globalThis.__rimecPgPool = new Pool({
      connectionString,
      max: resolvePgPoolMax(),
      min: 0,
      idleTimeoutMillis: isVercelRuntime() ? 5_000 : 10_000,
      connectionTimeoutMillis: 12_000,
      allowExitOnIdle: true,
      ssl,
    });
  }

  if (isVercelRuntime()) {
    return wrapPoolWithRetry(globalThis.__rimecPgPool);
  }
  return globalThis.__rimecPgPool;
}
