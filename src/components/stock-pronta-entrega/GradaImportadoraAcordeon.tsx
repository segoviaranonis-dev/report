"use client";

import { useEffect, useState } from "react";
import type { GradaImportadoraLine } from "@/lib/depositos/agrupar-pe-importadora";

type Props = {
  gradas: GradaImportadoraLine[];
  /** Tarjeta en modo extendido → slot grada más alto, siempre apilado */
  cardExpanded?: boolean;
  /** Cierra acordeón al compactar tarjetas */
  resetKey?: boolean;
};

function fmtPares(n: number) {
  return new Intl.NumberFormat("es-PY", { maximumFractionDigits: 3 }).format(n);
}

/** Calzado importadora: curvas apiladas verticalmente (nunca horizontal). */
export function GradaImportadoraAcordeon({
  gradas,
  cardExpanded = false,
  resetKey = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const slotH = cardExpanded ? "h-20" : "h-10";

  useEffect(() => {
    if (resetKey) setOpen(false);
  }, [resetKey]);

  if (gradas.length === 0) {
    return <div className={`${slotH} shrink-0`} aria-hidden />;
  }

  const total = gradas.reduce((s, g) => s + g.pares, 0);

  const filas = (
    <div className="flex flex-col gap-0.5">
      {gradas.map((g) => (
        <div
          key={g.curva}
          className="flex items-start justify-between gap-1 font-mono text-[8px] leading-tight tabular-nums text-slate-800"
        >
          <span className="min-w-0 flex-1 break-all" title={g.curva}>
            {g.curva}
          </span>
          <span className="shrink-0 font-semibold text-bazzar-naranja-dark">
            | {fmtPares(g.pares)}
          </span>
        </div>
      ))}
    </div>
  );

  if (gradas.length === 1) {
    return (
      <div
        className={`${slotH} shrink-0 overflow-y-auto overflow-x-hidden rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-2 py-1`}
      >
        <p className="mb-0.5 text-[8px] font-bold uppercase tracking-wide text-slate-500">Grada</p>
        {filas}
      </div>
    );
  }

  return (
    <div
      className={`${slotH} shrink-0 overflow-y-auto overflow-x-hidden rounded-lg border border-dashed border-bazzar-naranja/35 bg-orange-50/30`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-1 px-2 py-1 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-0.5 text-[8px] font-bold uppercase tracking-wide text-bazzar-naranja">
          <span className={`transition ${open ? "rotate-180" : ""}`} aria-hidden>
            ▾
          </span>
          Grada
        </span>
        <span className="truncate text-[8px] font-semibold tabular-nums text-slate-600">
          {gradas.length} curvas · {fmtPares(total)} p
        </span>
      </button>
      {open ? <div className="border-t border-orange-100 px-2 pb-1 pt-0.5">{filas}</div> : null}
    </div>
  );
}
