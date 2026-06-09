type Props = { note?: string; variant?: "paper" | "rim" | "exec" };

export function ReportFooter({ note, variant = "paper" }: Props) {
  const rim = variant === "rim";
  const exec = variant === "exec";
  return (
    <footer
      className={
        exec
          ? "mt-16 border-t-2 border-slate-200 bg-white py-10"
          : rim
            ? "mt-12 border-t-2 border-slate-200 bg-white py-8"
            : "mt-16 border-t-2 border-slate-200 bg-white py-8"
      }
    >
      <div className="mx-auto max-w-3xl px-6 font-sans text-xs leading-relaxed text-neutral-700">
        <p className="font-semibold uppercase tracking-[0.12em] text-rimec-azul-dark">
          Nota sobre este documento
        </p>
        <p className="mt-2">
          {note ??
            "Los valores numéricos de demostración se reemplazarán por consultas auditables a la base operativa una vez cerrada la capa de datos. Las imágenes de producto se sirven desde almacenamiento Supabase ya existente."}
        </p>
        <p className="mt-4 text-[11px] uppercase tracking-wider text-neutral-600">
          RIMEC · Informes ejecutivos · Confidencial — uso interno
        </p>
      </div>
    </footer>
  );
}
