import type { FullSnapshotResponse } from "@/lib/rimec/full-snapshot-types";
import { filtrosToFullSnapshotBody, isFullSnapshotApiPayload } from "@/lib/rimec/snapshot-to-pkg";
import {
  markHubPrefetchStart,
  markPrefetchReady,
  parseServerTiming,
  recordPrefetchMetaMs,
  recordPrefetchSnapshotMs,
} from "@/lib/rimec/sales-report-perf";
import { recordReportPerf } from "@/lib/report/report-perf";
import { defaultSalesReportFilters } from "@/modules/sales-report/types";

export type SalesReportMeta = {
  configured: boolean;
  error?: string;
};

type PrefetchStatus = "idle" | "loading" | "ready" | "error";

type PrefetchCache = {
  status: PrefetchStatus;
  meta: SalesReportMeta | null;
  snapshot: FullSnapshotResponse | null;
  error: string | null;
  promise: Promise<void> | null;
};

const CACHE_KEY = "__NEXUS_SALES_REPORT_PREFETCH_V1__";

function getCache(): PrefetchCache {
  if (typeof globalThis === "undefined") {
    return { status: "idle", meta: null, snapshot: null, error: null, promise: null };
  }
  const g = globalThis as typeof globalThis & { [CACHE_KEY]?: PrefetchCache };
  if (!g[CACHE_KEY]) {
    g[CACHE_KEY] = {
      status: "idle",
      meta: null,
      snapshot: null,
      error: null,
      promise: null,
    };
  }
  return g[CACHE_KEY]!;
}

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

function normalizeSnapshot(j: Record<string, unknown>): FullSnapshotResponse {
  const snap = j as FullSnapshotResponse;
  return {
    ...snap,
    jerarquia_clientes: Array.isArray(snap.jerarquia_clientes) ? snap.jerarquia_clientes : [],
  };
}

export function getSalesReportPrefetchState() {
  const cache = getCache();
  return {
    status: cache.status,
    meta: cache.meta,
    snapshot: cache.snapshot,
    error: cache.error,
    isLoading: cache.status === "loading",
  };
}

export function subscribeSalesReportPrefetch(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Dispara meta + full-snapshot en paralelo (idempotente, cache global cross-route). */
export function prefetchSalesReportSnapshot(): Promise<void> {
  const cache = getCache();

  if (cache.status === "ready") return Promise.resolve();
  if (cache.status === "error") cache.status = "idle";
  if (cache.promise) return cache.promise;

  cache.status = "loading";
  cache.error = null;
  markHubPrefetchStart();

  const body = filtrosToFullSnapshotBody(defaultSalesReportFilters());

  cache.promise = (async () => {
    try {
      const metaStarted = performance.now();
      const snapStarted = performance.now();

      const [metaResult, snapResult] = await Promise.all([
        fetch("/api/rimec/meta")
          .then((r) => r.json())
          .then((j) => {
            recordPrefetchMetaMs(performance.now() - metaStarted);
            return j as SalesReportMeta;
          })
          .catch(() => null),
        fetch("/api/rimec/full-snapshot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }).then(async (r) => {
          const j = (await r.json()) as Record<string, unknown>;
          const serverTiming = parseServerTiming(j);
          recordPrefetchSnapshotMs(performance.now() - snapStarted, serverTiming);
          if (serverTiming) {
            recordReportPerf(
              `Sales Report snapshot: red ${((performance.now() - snapStarted) / 1000).toFixed(2)}s · BD ${(serverTiming.totalMs / 1000).toFixed(2)}s`,
              performance.now() - snapStarted,
              "api",
            );
          }
          if (j.configured === false) return null;
          if (!r.ok) throw new Error(String(j.error ?? "Consulta error"));
          if (!isFullSnapshotApiPayload(j)) throw new Error("Respuesta inválida");
          return normalizeSnapshot(j);
        }),
      ]);

      cache.meta = metaResult;
      if (metaResult?.configured === false) {
        cache.snapshot = null;
        cache.status = "ready";
      } else {
        cache.snapshot = snapResult;
        cache.status = "ready";
      }
    } catch (e) {
      cache.error = e instanceof Error ? e.message : "Error";
      cache.status = "error";
    } finally {
      cache.promise = null;
      if (cache.status === "ready") markPrefetchReady();
      notifyListeners();
    }
  })();

  return cache.promise;
}

export function clearSalesReportPrefetchSnapshot() {
  const cache = getCache();
  cache.snapshot = null;
  cache.status = cache.meta ? "ready" : "idle";
  cache.error = null;
  cache.promise = null;
  notifyListeners();
}
