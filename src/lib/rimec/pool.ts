import { Client, Pool, type QueryResult, type QueryResultRow } from "pg";
import { isPoolSaturatedError } from "@/lib/rimec/pool-saturated";

/**
 * Pool singleton (Next.js server). En Vercel: cliente efímero por query + reintentos (no retiene conexiones).
 * Supabase pooler (:6543) + pgbouncer=true — evita EMAXCONN (límite ~200).
 */
export function isRimecDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

declare global {
  // eslint-disable-next-line no-var -- singleton dev HMR
  var __rimecPgPool: Pool | undefined;
  var __rimecVercelExecutor: VercelEphemeralPg | undefined;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizePoolerUrl(raw: string): string {
  try {
    const u = new URL(raw);
    if (u.hostname.includes("pooler.supabase.com")) {
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

/** Vercel: conecta → query → cierra. Reintenta EMAXCONN con backoff. */
class VercelEphemeralPg {
  constructor(
    private readonly connectionString: string,
    private readonly ssl: ReturnType<typeof resolveSsl>,
  ) {}

  async query<R extends QueryResultRow = QueryResultRow>(
    ...args: Parameters<Pool["query"]>
  ): Promise<QueryResult<R>> {
    const maxAttempts = resolveRetryMax();
    let lastError: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const client = new Client({
        connectionString: this.connectionString,
        ssl: this.ssl,
        connectionTimeoutMillis: 12_000,
      });
      try {
        await client.connect();
        return await client.query<R>(...args);
      } catch (e) {
        lastError = e;
        if (isPoolSaturatedError(e) && attempt < maxAttempts - 1) {
          await sleep(200 * 2 ** attempt + Math.random() * 300);
          continue;
        }
        throw e;
      } finally {
        await client.end().catch(() => undefined);
      }
    }
    throw lastError;
  }
}

export function getRimecPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url || !String(url).trim()) {
    throw new Error("DATABASE_URL no configurada (connection string Postgres, solo servidor).");
  }

  const connectionString = normalizePoolerUrl(String(url).trim());
  const ssl = resolveSsl(connectionString);

  if (isVercelRuntime()) {
    if (!globalThis.__rimecVercelExecutor) {
      globalThis.__rimecVercelExecutor = new VercelEphemeralPg(connectionString, ssl);
    }
    return globalThis.__rimecVercelExecutor as unknown as Pool;
  }

  if (!globalThis.__rimecPgPool) {
    globalThis.__rimecPgPool = new Pool({
      connectionString,
      max: resolvePgPoolMax(),
      min: 0,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8_000,
      allowExitOnIdle: true,
      ssl,
    });
  }
  return globalThis.__rimecPgPool;
}
