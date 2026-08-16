/**
 * Prefetch en segundo plano desde Panel de Control → grilla casi instantánea al navegar.
 * Reutiliza la misma promesa si el usuario abre el módulo antes de que termine.
 * PE: también sessionStorage SWR (stale-while-revalidate) para reabrir <1s.
 */

type Json = Record<string, unknown>;

const inflight = new Map<string, Promise<Json>>();

/** sessionStorage — payload PE (puede ser grande; best-effort). */
export const PE_PRODUCTOS_SESSION_KEY = "nexus:pe-productos:v2";
const PE_SESSION_TTL_MS = 10 * 60 * 1000;

export function readPeProductosSession(): Json | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PE_PRODUCTOS_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts?: number; data?: Json };
    if (!parsed?.data || typeof parsed.ts !== "number") return null;
    if (Date.now() - parsed.ts > PE_SESSION_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function writePeProductosSession(data: Json): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      PE_PRODUCTOS_SESSION_KEY,
      JSON.stringify({ ts: Date.now(), data }),
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearPeProductosSession(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(PE_PRODUCTOS_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

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

export function loadPeProductosPrefetch(opts?: {
  fresh?: boolean;
  tipo_v2?: 1 | 2;
}): Promise<Json> {
  const q = new URLSearchParams();
  if (opts?.fresh) q.set("fresh", "1");
  if (opts?.tipo_v2 === 1 || opts?.tipo_v2 === 2) q.set("tipo_v2", String(opts.tipo_v2));
  const qs = q.toString();
  const url = qs
    ? `/api/stock-pronta-entrega/productos?${qs}`
    : "/api/stock-pronta-entrega/productos";
  return fetchJson(url).then((j) => {
    if (!opts?.tipo_v2) writePeProductosSession(j);
    return j;
  });
}

export function loadTransitoProductosPrefetch(): Promise<Json> {
  return fetchJson("/api/stock-transito/productos");
}

export function loadProgramadoProductosPrefetch(): Promise<Json> {
  return fetchJson("/api/stock-programado/productos");
}
