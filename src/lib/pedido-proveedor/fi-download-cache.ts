/** Cache en memoria para descargas FI/CSV — prefetch controlado en tab FI. */

const pdfCache = new Map<string, Blob>();
let csvEntry: { key: string; blob: Blob } | null = null;

function pdfKey(ppId: number, fiId: number) {
  return `${ppId}:${fiId}`;
}

export function getCachedPdf(ppId: number, fiId: number): Blob | undefined {
  return pdfCache.get(pdfKey(ppId, fiId));
}

export function getCachedCsv(ppId: number): Blob | undefined {
  return csvEntry?.key === String(ppId) ? csvEntry.blob : undefined;
}

export function setCachedPdf(ppId: number, fiId: number, blob: Blob) {
  pdfCache.set(pdfKey(ppId, fiId), blob);
}

export function setCachedCsv(ppId: number, blob: Blob) {
  csvEntry = { key: String(ppId), blob };
}

export function clearCachedCsv(ppId?: number) {
  if (ppId == null || csvEntry?.key === String(ppId)) {
    csvEntry = null;
  }
}

const inflightPdf = new Set<string>();
const inflightCsv = new Set<string>();

export async function fetchPdfBlob(ppId: number, fiId: number): Promise<Blob | null> {
  const cached = getCachedPdf(ppId, fiId);
  if (cached) return cached;

  const key = pdfKey(ppId, fiId);
  if (inflightPdf.has(key)) return null;

  inflightPdf.add(key);
  try {
    const res = await fetch(
      `/api/proceso-importacion/pedido-proveedor/${ppId}/fi/${fiId}/pdf`,
      { credentials: "same-origin" },
    );
    if (!res.ok) {
      let msg = `Error ${res.status} al generar PDF`;
      try {
        const ct = res.headers.get("content-type") ?? "";
        if (ct.includes("application/json")) {
          const data = (await res.json()) as { error?: string };
          if (data.error) msg = data.error;
        }
      } catch {
        /* ignore parse */
      }
      throw new Error(msg);
    }
    const blob = await res.blob();
    if (blob.type && !blob.type.includes("pdf") && blob.size < 512) {
      throw new Error("Respuesta inválida del servidor (no es PDF)");
    }
    setCachedPdf(ppId, fiId, blob);
    return blob;
  } catch (e) {
    if (e instanceof Error) throw e;
    return null;
  } finally {
    inflightPdf.delete(key);
  }
}

export async function fetchCsvBlob(ppId: number): Promise<Blob | null> {
  const cached = getCachedCsv(ppId);
  if (cached) return cached;

  const key = String(ppId);
  if (inflightCsv.has(key)) return null;

  inflightCsv.add(key);
  try {
    const res = await fetch(
      `/api/proceso-importacion/pedido-proveedor/${ppId}/csv-ventas`,
      { credentials: "same-origin" },
    );
    if (!res.ok) return null;
    const blob = await res.blob();
    setCachedCsv(ppId, blob);
    return blob;
  } catch {
    return null;
  } finally {
    inflightCsv.delete(key);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Prefetch de un PDF (p. ej. al abrir acordeón FI). */
export function prefetchSingleFiPdf(ppId: number, fiId: number) {
  if (getCachedPdf(ppId, fiId)) return;
  void fetchPdfBlob(ppId, fiId).catch(() => {
    /* prefetch best-effort */
  });
}

/** Prefetch CSV + PDFs visibles primero; resto en background controlado. */
export function prefetchPpFiDownloads(
  ppId: number,
  fiIds: number[],
  opts?: {
    csv?: boolean;
    pdfConcurrency?: number;
    delayMs?: number;
    /** Cuántos PDF prefetch inmediato (resto en cola lenta). */
    pdfPriorityCount?: number;
  },
): () => void {
  let cancelled = false;
  const csv = opts?.csv !== false;
  const concurrency = opts?.pdfConcurrency ?? 1;
  const delayMs = opts?.delayMs ?? 700;
  const priorityCount = opts?.pdfPriorityCount ?? 2;

  (async () => {
    await sleep(1200);
    if (cancelled || (typeof document !== "undefined" && document.hidden)) return;

    if (csv) {
      void fetchCsvBlob(ppId);
      await sleep(delayMs);
    }
    if (cancelled || fiIds.length === 0) return;

    const priority = fiIds.slice(0, priorityCount);
    const rest = fiIds.slice(priorityCount);

    for (const fiId of priority) {
      if (cancelled) return;
      try {
        await fetchPdfBlob(ppId, fiId);
      } catch {
        /* prefetch best-effort */
      }
      await sleep(delayMs);
    }

    if (cancelled || rest.length === 0) return;

    let idx = 0;
    async function worker() {
      while (!cancelled) {
        const i = idx++;
        if (i >= rest.length) break;
        try {
          await fetchPdfBlob(ppId, rest[i]);
        } catch {
          /* prefetch best-effort */
        }
        await sleep(delayMs * 2);
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, rest.length) }, worker));
  })();

  return () => {
    cancelled = true;
  };
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
