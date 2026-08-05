/** Detecta saturación del pool Supabase o espera de conexión (serverless). */
export function isPoolSaturatedError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  const code =
    e && typeof e === "object" && "code" in e ? String((e as { code?: unknown }).code ?? "") : "";
  // 53300 = too_many_connections (Postgres agotó max_connections, no solo el pooler)
  if (code === "53300") return true;
  return /max client connections|EMAXCONN|too many clients|pool exhausted|timeout exceeded when trying to connect|connection terminated unexpectedly|sorry, too many clients already|remaining connection slots are reserved|too many connections for role/i.test(
    msg,
  );
}

export function poolSaturatedResponse(raw?: string) {
  return {
    ok: false as const,
    error:
      "Base de datos ocupada (import u otra operación en curso). Esperá 30 s y reintentá — no cierres la pestaña.",
    code: "EMAXCONN" as const,
    detail: raw,
  };
}
