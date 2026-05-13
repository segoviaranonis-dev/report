type Props = { note?: string };

export function ReportFooter({ note }: Props) {
  return (
    <footer className="mt-16 border-t border-report-rule bg-report-paper2 py-8">
      <div className="mx-auto max-w-3xl px-6 font-sans text-xs leading-relaxed text-report-muted">
        <p className="font-semibold text-report-navy/90">Nota sobre este documento</p>
        <p className="mt-2">
          {note ??
            "Los valores numéricos de demostración se reemplazarán por consultas auditables a la base operativa una vez cerrada la capa de datos. Las imágenes de producto se sirven desde almacenamiento Supabase ya existente."}
        </p>
        <p className="mt-4 text-[11px] uppercase tracking-wider text-report-muted/90">
          RIMEC Nexus · Informes ejecutivos · Confidencial — uso interno
        </p>
      </div>
    </footer>
  );
}
