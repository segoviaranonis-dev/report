import type { ReposicionArticulo } from "@/lib/herramienta-reposicion/merge-reposicion";

/** v2 · 2026-07-21: invalida payload previo con ventas CP «Sin llegada» sin lote. */
const SS_KEY = "hr-am-payload-v2";
const TTL_MS = 30 * 60 * 1000;

type CachePayload = {
  ts: number;
  articulos: ReposicionArticulo[];
};

export function leerCacheReposicionCliente(): ReposicionArticulo[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachePayload;
    if (!parsed?.ts || !Array.isArray(parsed.articulos)) return null;
    if (Date.now() - parsed.ts > TTL_MS) {
      sessionStorage.removeItem(SS_KEY);
      return null;
    }
    return parsed.articulos;
  } catch {
    return null;
  }
}

export function guardarCacheReposicionCliente(articulos: ReposicionArticulo[]): void {
  if (typeof window === "undefined") return;
  try {
    const payload: CachePayload = { ts: Date.now(), articulos };
    sessionStorage.setItem(SS_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode — ignorar */
  }
}

export function borrarCacheReposicionCliente(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(SS_KEY);
  } catch {
    /* ignore */
  }
}
