/**
 * Prefetch en segundo plano desde Panel de Control → grilla casi instantánea al navegar.
 * Reutiliza la misma promesa si el usuario abre el módulo antes de que termine.
 */

type Json = Record<string, unknown>;

const inflight = new Map<string, Promise<Json>>();

function fetchJson(url: string): Promise<Json> {
  const prev = inflight.get(url);
  if (prev) return prev;
  const p = fetch(url, { credentials: "include", cache: "no-store" })
    .then(async (res) => {
      const j = (await res.json()) as Json;
      if (!res.ok || j.ok === false) {
        throw new Error(String(j.error ?? `HTTP ${res.status}`));
      }
      return j;
    })
    .finally(() => {
      inflight.delete(url);
    });
  inflight.set(url, p);
  return p;
}

export function prefetchGrillasPanelControl(): void {
  if (typeof window === "undefined") return;
  const run = () => {
    void fetchJson("/api/stock-pronta-entrega/productos").catch(() => {});
    void fetchJson("/api/stock-transito/productos").catch(() => {});
    void fetchJson("/api/stock-programado/productos").catch(() => {});
  };
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(run, { timeout: 4000 });
  } else {
    globalThis.setTimeout(run, 300);
  }
}

export function loadPeProductosPrefetch(): Promise<Json> {
  return fetchJson("/api/stock-pronta-entrega/productos");
}

export function loadTransitoProductosPrefetch(): Promise<Json> {
  return fetchJson("/api/stock-transito/productos");
}

export function loadProgramadoProductosPrefetch(): Promise<Json> {
  return fetchJson("/api/stock-programado/productos");
}
