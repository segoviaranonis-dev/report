/** Detecta saturación del pool Supabase (límite ~200 conexiones en pooler). */
export function isPoolSaturatedError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  return /max client connections|EMAXCONN|too many clients|pool exhausted/i.test(msg);
}

export function poolSaturatedResponse(raw?: string) {
  return {
    ok: false as const,
    error: "Conexiones BD saturadas (pool Supabase). Reintentá en 30 s.",
    code: "EMAXCONN" as const,
    detail: raw,
  };
}
