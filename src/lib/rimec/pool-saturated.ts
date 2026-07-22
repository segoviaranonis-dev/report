/** Detecta saturación del pool Supabase o espera de conexión (serverless). */
export function isPoolSaturatedError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  return /max client connections|EMAXCONN|too many clients|pool exhausted|timeout exceeded when trying to connect|connection terminated unexpectedly|sorry, too many clients already/i.test(
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
