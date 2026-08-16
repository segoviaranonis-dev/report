import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import { getRimecPool } from "@/lib/rimec/pool";
import { listImportadoProductos } from "@/lib/deposito-rimec/queries-productos-grilla";

/**
 * Cache en memoria del proceso Node (mismo patrón AM).
 * Payload PE puede superar 2 MB → no usar unstable_cache de Next.
 * Primera consulta paga SQL · siguientes within TTL vuelan.
 */
export type PeProductosPayload = {
  productos: DepositoRow[];
  cajas: number;
  pares: number;
  batch: string | null;
};

type CacheEntry = { ts: number; gen: string; key: string; data: PeProductosPayload };

const CACHE_GEN = "pe-productos-v1";
const TTL_MS = 90 * 1000;

const g = globalThis as typeof globalThis & {
  __peProductosCache?: Map<string, CacheEntry>;
};

function cacheMap(): Map<string, CacheEntry> {
  if (!g.__peProductosCache) g.__peProductosCache = new Map();
  return g.__peProductosCache;
}

function cacheKey(opts?: { deposito?: string; batch?: string; tipo_v2?: 1 | 2 }): string {
  return [
    opts?.deposito?.trim() || "",
    opts?.batch?.trim() || "",
    opts?.tipo_v2 ?? "",
  ].join("|");
}

export async function listImportadoProductosCached(
  opts?: { deposito?: string; batch?: string; tipo_v2?: 1 | 2 },
): Promise<{ data: PeProductosPayload; cache: "hit" | "miss"; ms: number }> {
  const key = cacheKey(opts);
  const hit = cacheMap().get(key);
  if (hit && hit.gen === CACHE_GEN && hit.key === key && Date.now() - hit.ts < TTL_MS) {
    return { data: hit.data, cache: "hit", ms: 0 };
  }
  const t0 = Date.now();
  const data = await listImportadoProductos(getRimecPool(), opts);
  cacheMap().set(key, { ts: Date.now(), gen: CACHE_GEN, key, data });
  return { data, cache: "miss", ms: Date.now() - t0 };
}

export async function listImportadoProductosFresh(
  opts?: { deposito?: string; batch?: string; tipo_v2?: 1 | 2 },
): Promise<{ data: PeProductosPayload; cache: "bypass"; ms: number }> {
  const key = cacheKey(opts);
  const t0 = Date.now();
  const data = await listImportadoProductos(getRimecPool(), opts);
  cacheMap().set(key, { ts: Date.now(), gen: CACHE_GEN, key, data });
  return { data, cache: "bypass", ms: Date.now() - t0 };
}

export function invalidarCachePeProductos(): void {
  g.__peProductosCache = undefined;
}
