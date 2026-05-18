type Props = { note?: string; variant?: "paper" | "rim" | "exec" };

export function ReportFooter({ note, variant = "paper" }: Props) {
  const rim = variant === "rim";
  const exec = variant === "exec";
  return (
    <footer
      className={
        exec
          ? "mt-16 border-t border-exec-line bg-exec-surface py-10"
          : rim
            ? "mt-12 border-t border-rim-line bg-rim-ink py-8"
            : "mt-16 border-t border-report-rule bg-report-paper2 py-8"
      }
    >
      <div
        className={`mx-auto max-w-3xl px-6 font-sans text-xs leading-relaxed ${
          exec ? "text-exec-muted" : rim ? "text-rim-muted" : "text-report-muted"
        }`}
      >
        <p
          className={
            exec
              ? "font-semibold uppercase tracking-[0.12em] text-exec-subtle"
              : rim
                ? "font-semibold text-rim-accent"
                : "font-semibold text-report-navy/90"
          }
        >
          Nota sobre este documento
        </p>
        <p className="mt-2">
          {note ??
            "Los valores numéricos de demostración se reemplazarán por consultas auditables a la base operativa una vez cerrada la capa de datos. Las imágenes de producto se sirven desde almacenamiento Supabase ya existente."}
        </p>
        <p
          className={`mt-4 text-[11px] uppercase tracking-wider ${
            exec ? "text-exec-subtle" : rim ? "text-rim-muted/90" : "text-report-muted/90"
          }`}
        >
          RIMEC · Informes ejecutivos · Confidencial — uso interno
        </p>
      </div>
    </footer>
  );
}
