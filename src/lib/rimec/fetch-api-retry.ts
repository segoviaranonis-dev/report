/**
 * Retry fetch ante 503 / EMAXCONN — uso transversal Report (IC, ventas-fotos, etc.).
 */
export async function fetchReportApiWithRetry(
  url: string,
  init?: RequestInit,
  opts?: { retries?: number; waitMs?: number },
): Promise<Response> {
  const retries = opts?.retries ?? 6;
  const waitMs = opts?.waitMs ?? 2_000;
  let lastRes: Response | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url, { credentials: "same-origin", ...init });
    lastRes = res;
    if (res.ok) return res;

    let data: { code?: string } = {};
    try {
      data = await res.clone().json();
    } catch {
      /* ignore */
    }

    const saturated = res.status === 503 || data.code === "EMAXCONN";
    if (saturated && attempt < retries - 1) {
      await new Promise((r) => setTimeout(r, waitMs * (attempt + 1)));
      continue;
    }
    return res;
  }

  return lastRes!;
}

export function reportApiErrorMessage(data: { error?: string; message?: string }, fallback: string): string {
  const raw = data.error ?? data.message ?? "";
  if (/EMAXCONN|max client connections|pool Supabase|saturad/i.test(raw)) {
    return "Conexiones BD saturadas (pool Supabase). Reintentá en unos segundos.";
  }
  return raw || fallback;
}

export function isReportApiSaturated(data: { code?: string; error?: string; message?: string }): boolean {
  if (data.code === "EMAXCONN") return true;
  const raw = data.error ?? data.message ?? "";
  return /max client connections|EMAXCONN/i.test(raw);
}
