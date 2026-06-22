"use client";

type Props = {
  open: boolean;
  title: string;
  detail?: string;
  hint?: string;
};

/** Overlay bloqueante — usuario siempre sabe que el sistema trabaja (ley Report importación). */
export function ProcesoImportacionWaitOverlay({ open, title, detail, hint }: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/45 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-labelledby="import-wait-title"
    >
      <div className="mx-4 max-w-md rounded-xl bg-white px-8 py-8 text-center shadow-xl">
        <div className="mx-auto h-11 w-11 animate-spin rounded-full border-4 border-rimec-azul border-t-transparent" />
        <p id="import-wait-title" className="mt-4 font-serif text-lg text-rimec-azul-dark">
          {title}
        </p>
        <p className="mt-2 text-sm font-medium text-slate-700">Por favor aguarde…</p>
        {detail ? <p className="mt-2 text-xs text-slate-500">{detail}</p> : null}
        {hint ? <p className="mt-3 text-xs text-slate-600">{hint}</p> : null}
      </div>
    </div>
  );
}
