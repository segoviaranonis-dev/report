"use client";

import { useEffect, useState } from "react";
import type { GradaImportadoraLine } from "@/lib/depositos/agrupar-pe-importadora";
import { VENTA_VISUAL } from "@/lib/nexus/venta-visual";

type Props = {
  gradas: GradaImportadoraLine[];
  /** Tarjeta en modo extendido */
  cardExpanded?: boolean;
  /** Cierra acordeón al compactar tarjetas */
  resetKey?: boolean;
  /** Tránsito / programado — muestra vendido por curva */
  showVentas?: boolean;
  /** 638 confecciones — etiqueta Talle + unidades */
  modoConfecciones?: boolean;
};

function fmtPares(n: number) {
  return new Intl.NumberFormat("es-PY", { maximumFractionDigits: 3 }).format(n);
}

const LIST_MAX_H = "max-h-[5.5rem]";

/** Calzado importadora: acordeón — cerrado = 1 línea · abierto = lista completa con scroll si excede. */
export function GradaImportadoraAcordeon({
  gradas,
  cardExpanded = false,
  resetKey = false,
  showVentas = false,
  modoConfecciones = false,
}: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (resetKey) setOpen(false);
  }, [resetKey]);

  if (gradas.length === 0) {
    return null;
  }

  const totalSaldo = gradas.reduce((s, g) => s + g.pares, 0);
  const totalVendido = gradas.reduce((s, g) => s + g.vendidos, 0);

  const uLabel = modoConfecciones ? "u" : "p";
  const titulo = modoConfecciones ? "Talle" : "Grada";

  const filas = (
    <div className="flex flex-col gap-px">
      {gradas.map((g, idx) => (
        <div
          key={`${g.curva}-${g.lpn ?? ""}-${idx}`}
          className="flex items-start justify-between gap-1 font-mono text-[8px] leading-[1.15] tabular-nums text-slate-800"
        >
          <span className="min-w-0 flex-1 break-all" title={g.curva}>
            {modoConfecciones && g.lpn ? (
              <>
                {g.curva}
                <span className="text-slate-500"> · {g.lpn.toLocaleString("es-PY")}</span>
              </>
            ) : (
              g.curva
            )}
          </span>
          <span className="flex shrink-0 items-center gap-0.5 font-semibold whitespace-nowrap">
            {showVentas && g.vendidos > 0 ? (
              <span className={VENTA_VISUAL.label}>{fmtPares(g.vendidos)} v</span>
            ) : null}
            {g.pares > 0 ? (
              <span className="text-bazzar-naranja-dark">{fmtPares(g.pares)} {uLabel}</span>
            ) : showVentas && g.vendidos > 0 ? null : (
              <span className="text-slate-400">0</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );

  const resumen = [
    `${gradas.length} ${modoConfecciones ? "talle" : "curva"}${gradas.length === 1 ? "" : "s"}`,
    showVentas && totalVendido > 0 ? `${fmtPares(totalVendido)} v` : null,
    totalSaldo > 0 ? `${fmtPares(totalSaldo)} ${uLabel}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  if (gradas.length === 1) {
    return (
      <div className="shrink-0 overflow-hidden rounded-md border border-dashed border-slate-200 bg-slate-50/80 px-1.5 py-1">
        <p className="mb-px text-[7px] font-bold uppercase leading-none tracking-wide text-slate-500">
          {titulo}
        </p>
        {filas}
      </div>
    );
  }

  return (
    <div
      className={`shrink-0 overflow-hidden rounded-md border border-dashed border-bazzar-naranja/35 bg-orange-50/30 ${
        open ? "flex flex-col" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-h-[1.375rem] items-center justify-between gap-1 px-1.5 py-0.5 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-0.5 text-[7px] font-bold uppercase leading-none tracking-wide text-bazzar-naranja">
          <span className={`inline-block transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
            ▾
          </span>
          {titulo}
        </span>
        <span className="min-w-0 truncate text-[7px] font-semibold tabular-nums leading-none text-slate-600">
          {resumen}
        </span>
      </button>
      {open ? (
        <div className={`overflow-x-hidden overflow-y-auto border-t border-orange-100 px-1.5 py-0.5 ${LIST_MAX_H}`}>
          {filas}
        </div>
      ) : null}
    </div>
  );
}
