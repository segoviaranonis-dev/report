export type ReportPerfEntry = {
  id: string;
  label: string;
  ms: number;
  at: number;
  kind: "route" | "api" | "paint" | "user";
};

type ReportPerfStore = {
  route: string | null;
  routeStartedAt: number | null;
  entries: ReportPerfEntry[];
};

const STORE_KEY = "__NEXUS_REPORT_PERF_V1__";
const MAX_ENTRIES = 12;

function getStore(): ReportPerfStore {
  if (typeof globalThis === "undefined") {
    return { route: null, routeStartedAt: null, entries: [] };
  }
  const g = globalThis as typeof globalThis & { [STORE_KEY]?: ReportPerfStore };
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = { route: null, routeStartedAt: null, entries: [] };
  }
  return g[STORE_KEY]!;
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeReportPerf(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getReportPerfEntries(): ReportPerfEntry[] {
  return [...getStore().entries];
}

export function recordReportPerf(label: string, ms: number, kind: ReportPerfEntry["kind"] = "api") {
  const store = getStore();
  store.entries.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label,
    ms,
    at: Date.now(),
    kind,
  });
  if (store.entries.length > MAX_ENTRIES) store.entries.length = MAX_ENTRIES;
  notify();
}

export function markReportRouteStart(pathname: string) {
  const store = getStore();
  store.route = pathname;
  store.routeStartedAt = performance.now();
  notify();
}

export function markReportRoutePaint(pathname: string) {
  const store = getStore();
  if (store.routeStartedAt == null || store.route !== pathname) return;
  recordReportPerf(`${pathname} → pantalla`, performance.now() - store.routeStartedAt, "paint");
}

export async function fetchWithReportPerf<T>(
  label: string,
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const started = performance.now();
  const res = await fetch(input, init);
  const json = (await res.json()) as T & { _timing?: { totalMs?: number } };
  const networkMs = performance.now() - started;
  const timing = json && typeof json === "object" && "_timing" in json ? json._timing : null;
  const detail =
    timing && typeof timing.totalMs === "number"
      ? `${label}: red ${(networkMs / 1000).toFixed(2)}s · BD ${(timing.totalMs / 1000).toFixed(2)}s`
      : `${label}: ${(networkMs / 1000).toFixed(2)}s`;
  recordReportPerf(detail, networkMs, "api");
  return json;
}

export function formatReportPerfSummary(entries: ReportPerfEntry[]): string[] {
  if (entries.length === 0) return ["Sin mediciones aún — navegá entre módulos."];
  return entries.slice(0, 8).map((e) => {
    const sec = (e.ms / 1000).toFixed(2);
    return e.label.includes("s") ? e.label : `${e.label}: ${sec} s`;
  });
}
