import { getRimecPool } from "@/lib/rimec/pool";
import {
  getHerramientaReposicion,
  type HerramientaReposicionPayload,
} from "@/lib/herramienta-reposicion/queries";

/**
 * Cache en memoria del proceso Node (no `unstable_cache`:
 * payload AM ~7–8 MB > límite 2 MB de Next Data Cache).
 * Primera consulta paga SQL · siguientes within TTL vuelan.
 */
type CacheEntry = { ts: number; data: HerramientaReposicionPayload };

const g = globalThis as typeof globalThis & {
  __herramientaReposicionCache?: CacheEntry;
};

const TTL_MS = 5 * 60 * 1000;

export async function getHerramientaReposicionCached(): Promise<HerramientaReposicionPayload> {
  const hit = g.__herramientaReposicionCache;
  if (hit && Date.now() - hit.ts < TTL_MS) {
    return hit.data;
  }
  const data = await getHerramientaReposicion(getRimecPool());
  g.__herramientaReposicionCache = { ts: Date.now(), data };
  return data;
}

export async function getHerramientaReposicionFresh(): Promise<HerramientaReposicionPayload> {
  const data = await getHerramientaReposicion(getRimecPool());
  g.__herramientaReposicionCache = { ts: Date.now(), data };
  return data;
}

export function invalidarCacheHerramientaReposicion(): void {
  g.__herramientaReposicionCache = undefined;
}
