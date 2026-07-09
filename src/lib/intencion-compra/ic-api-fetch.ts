/** Fetch IC API con reintentos ante saturación pool (503 / EMAXCONN). */
export async function fetchIcApiWithRetry(
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

export function icApiErrorMessage(data: { error?: string }, fallback: string): string {
  if (data.error?.includes("EMAXCONN") || data.error?.includes("max client connections")) {
    return "Conexiones BD saturadas (pool Supabase). Reintentá en unos segundos.";
  }
  return data.error || fallback;
}
