import { Client, Pool, type QueryResult, type QueryResultRow } from "pg";
import { isPoolSaturatedError } from "@/lib/rimec/pool-saturated";

/**
 * Acceso Postgres para Report (Next.js server).
 *
 * Vercel/serverless:
 * - URL pooler Supabase (:6543) + pgbouncer=true + connection_limit=1
 * - Una conexión efímera por query, serializada por instancia lambda (mutex)
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
  var __rimecVercelExecutor: VercelEphemeralPg | undefined;
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

/**
 * Vercel: conecta → query → cierra. Mutex por lambda (Promise.all no abre N conexiones).
 * Reintenta EMAXCONN con backoff exponencial + jitter.
 */
class VercelEphemeralPg {
  private tail: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly connectionString: string,
    private readonly ssl: ReturnType<typeof resolveSsl>,
  ) {}

  private enqueue<R>(fn: () => Promise<R>): Promise<R> {
    const next = this.tail.then(fn, fn);
    this.tail = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  async query<R extends QueryResultRow = QueryResultRow>(
    queryText: string,
    values?: unknown[],
  ): Promise<QueryResult<R>>;
  async query<R extends QueryResultRow = QueryResultRow>(
    queryConfig: Parameters<Client["query"]>[0],
  ): Promise<QueryResult<R>>;
  async query<R extends QueryResultRow = QueryResultRow>(
    queryTextOrConfig: string | Parameters<Client["query"]>[0],
    values?: unknown[],
  ): Promise<QueryResult<R>> {
    return this.enqueue(() => this.runQuery<R>(queryTextOrConfig, values));
  }

  private async runQuery<R extends QueryResultRow>(
    queryTextOrConfig: string | Parameters<Client["query"]>[0],
    values?: unknown[],
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
        return typeof queryTextOrConfig === "string"
          ? values !== undefined
            ? await client.query<R>(queryTextOrConfig, values)
            : await client.query<R>(queryTextOrConfig)
          : await client.query<R>(queryTextOrConfig);
      } catch (e) {
        lastError = e;
        if (isPoolSaturatedError(e) && attempt < maxAttempts - 1) {
          await sleep(200 * 2 ** attempt + Math.random() * 400);
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
