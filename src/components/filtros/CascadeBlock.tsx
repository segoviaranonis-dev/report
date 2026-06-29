"use client";

/** Bloque acordeón — patrón ImmersiveFiltersPanel / CABECERA DE FILTROS Report */
export function CascadeBlock({
  title,
  summary,
  open,
  onOpen,
  disabled,
  children,
}: {
  title: string;
  summary: string;
  open: boolean;
  onOpen: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-orange-100 bg-white">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && onOpen()}
        className="flex min-h-[44px] w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition hover:bg-orange-50/80 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <div className="min-w-0 flex-1">
          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-gray-500">{title}</div>
          <div className="truncate text-xs font-semibold text-rimec-azul">{summary}</div>
        </div>
        <span className="shrink-0 text-sm text-bazzar-naranja" aria-hidden>
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open ? <div className="border-t border-orange-50 px-2 py-2">{children}</div> : null}
    </div>
  );
}

export function summarizeIds(
  selected: number[],
  items: { id: number | string; label: string }[],
  emptyLabel: string,
  max = 2,
): string {
  if (selected.length === 0) return emptyLabel;
  const labels = selected
    .map((id) => items.find((i) => Number(i.id) === id)?.label)
    .filter(Boolean) as string[];
  if (labels.length === 0) return `${selected.length} seleccionados`;
  if (labels.length <= max) return labels.join(", ");
  return `${labels.slice(0, max).join(", ")} +${labels.length - max}`;
}

export function summarizeTonos(tonos: string[], sinTono: boolean): string {
  if (sinTono) return "Sin asignar";
  if (tonos.length === 0) return "Todos";
  if (tonos.length <= 2) return tonos.join(", ");
  return `${tonos.slice(0, 2).join(", ")} +${tonos.length - 2}`;
}
