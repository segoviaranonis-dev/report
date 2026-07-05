export type SalesReportServerTiming = {
  totalMs: number;
  pivotMs: number;
  jerMs: number;
  cascadaMs: number;
  buildMs: number;
};

export type SalesReportPerfSnapshot = {
  hubPrefetchStartedAt: number | null;
  prefetchReadyAt: number | null;
  metaFetchMs: number | null;
  snapshotFetchMs: number | null;
  serverTiming: SalesReportServerTiming | null;
  routeEnterAt: number | null;
  snapshotAppliedAt: number | null;
  dashboardPaintAt: number | null;
};

const PERF_KEY = "__NEXUS_SALES_REPORT_PERF_V1__";

function getStore(): SalesReportPerfSnapshot {
  if (typeof globalThis === "undefined") {
    return emptyPerf();
  }
  const g = globalThis as typeof globalThis & { [PERF_KEY]?: SalesReportPerfSnapshot };
  if (!g[PERF_KEY]) g[PERF_KEY] = emptyPerf();
  return g[PERF_KEY]!;
}

function emptyPerf(): SalesReportPerfSnapshot {
  return {
    hubPrefetchStartedAt: null,
    prefetchReadyAt: null,
    metaFetchMs: null,
    snapshotFetchMs: null,
    serverTiming: null,
    routeEnterAt: null,
    snapshotAppliedAt: null,
    dashboardPaintAt: null,
  };
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function getSalesReportPerf(): SalesReportPerfSnapshot {
  return { ...getStore() };
}

export function subscribeSalesReportPerf(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function markHubPrefetchStart() {
  const s = getStore();
  if (s.hubPrefetchStartedAt == null) {
    s.hubPrefetchStartedAt = performance.now();
    notify();
  }
}

export function markRouteEnter() {
  const s = getStore();
  s.routeEnterAt = performance.now();
  notify();
}

export function recordPrefetchMetaMs(ms: number) {
  getStore().metaFetchMs = ms;
  notify();
}

export function recordPrefetchSnapshotMs(ms: number, serverTiming?: SalesReportServerTiming | null) {
  const s = getStore();
  s.snapshotFetchMs = ms;
  if (serverTiming) s.serverTiming = serverTiming;
  notify();
}

export function markPrefetchReady() {
  const s = getStore();
  if (s.prefetchReadyAt == null) {
    s.prefetchReadyAt = performance.now();
  }
  notify();
}

export function markSnapshotApplied() {
  const s = getStore();
  if (s.snapshotAppliedAt == null) {
    s.snapshotAppliedAt = performance.now();
    notify();
  }
  notify();
}

export function markDashboardPaint() {
  const s = getStore();
  if (s.dashboardPaintAt == null) {
    s.dashboardPaintAt = performance.now();
    notify();
  }
  notify();
}

export function parseServerTiming(j: Record<string, unknown>): SalesReportServerTiming | null {
  const t = j._timing;
  if (!t || typeof t !== "object") return null;
  const o = t as Record<string, unknown>;
  if (typeof o.totalMs !== "number") return null;
  return {
    totalMs: o.totalMs,
    pivotMs: typeof o.pivotMs === "number" ? o.pivotMs : 0,
    jerMs: typeof o.jerMs === "number" ? o.jerMs : 0,
    cascadaMs: typeof o.cascadaMs === "number" ? o.cascadaMs : 0,
    buildMs: typeof o.buildMs === "number" ? o.buildMs : 0,
  };
}

export function formatPerfLines(perf: SalesReportPerfSnapshot): string[] {
  const lines: string[] = [];
  const hub = perf.hubPrefetchStartedAt;
  const route = perf.routeEnterAt;

  if (route != null && perf.dashboardPaintAt != null) {
    lines.push(
      `★ Director — clic → dashboard: ${((perf.dashboardPaintAt - route) / 1000).toFixed(2)} s`,
    );
  }
  if (hub != null && perf.prefetchReadyAt != null) {
    lines.push(`Prefetch listo en: ${((perf.prefetchReadyAt - hub) / 1000).toFixed(2)} s`);
  }
  if (perf.snapshotFetchMs != null) {
    lines.push(`API snapshot (red): ${(perf.snapshotFetchMs / 1000).toFixed(2)} s`);
  }
  if (perf.serverTiming) {
    const st = perf.serverTiming;
    lines.push(
      `BD: ${(st.totalMs / 1000).toFixed(2)} s (pivot ${st.pivotMs} · jer ${st.jerMs} · cascada ${st.cascadaMs} ms)`,
    );
  }
  if (hub != null && perf.prefetchReadyAt != null && route != null && route > perf.prefetchReadyAt) {
    lines.push(
      `Espera en hub tras prefetch: ${((route - perf.prefetchReadyAt) / 1000).toFixed(2)} s`,
    );
  }
  return lines;
}
