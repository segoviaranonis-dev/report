"use client";

import { useEffect, useMemo, useState } from "react";
import type { GradaImportadoraLine } from "@/lib/depositos/agrupar-pe-importadora";
import { VENTA_VISUAL } from "@/lib/nexus/venta-visual";
import {
  esCurvaCajaCerrada654,
  parseGradaAbierta638,
  sortGradaSiameseBazzar,
} from "@/lib/deposito-rimec/grada-abierta-638";

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
  /** tipo_v2_id para orden siamese (1 calzado · 2 confecciones) */
  tipoV2Id?: number | null;
};

function fmtPares(n: number) {
  return new Intl.NumberFormat("es-PY", { maximumFractionDigits: 3 }).format(n);
}

const LIST_MAX_H = "max-h-[5.5rem]";

/**
 * Grada en tarjeta PE / Depósito Web.
 * Siamese Bazzar (Estadísticas de Stock): talles sueltos → chips horizontales con cantidad.
 * Curva caja cerrada 654 importadora → acordeón clásico (texto curva).
 */
export function GradaImportadoraAcordeon({
  gradas,
  cardExpanded = false,
  resetKey = false,
  showVentas = false,
  modoConfecciones = false,
  tipoV2Id = null,
}: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (resetKey) setOpen(false);
  }, [resetKey]);

  const sorted = useMemo(
    () =>
      [...gradas].sort((a, b) =>
        sortGradaSiameseBazzar(
          { curva: a.curva, talle: a.talle },
          { curva: b.curva, talle: b.talle },
          tipoV2Id ?? (modoConfecciones ? 2 : 1),
        ),
      ),
    [gradas, tipoV2Id, modoConfecciones],
  );

  if (sorted.length === 0) {
    return null;
  }

  const totalSaldo = sorted.reduce((s, g) => s + g.pares, 0);
  const totalVendido = sorted.reduce((s, g) => s + g.vendidos, 0);
  const uLabel = modoConfecciones ? "u" : "p";
  const titulo = modoConfecciones ? "Talle" : "Grada";

  const todasSueltas = sorted.every((g) => !esCurvaCajaCerrada654(g.curva));

  /** Modo siamese Estadísticas — talle + cantidad visible (caja abierta / ALM_WEB). */
  if (todasSueltas) {
    return (
      <div className="shrink-0 overflow-hidden rounded-md border border-sky-200/80 bg-sky-50/50 px-1.5 py-1">
        <p className="mb-1 text-[7px] font-bold uppercase leading-none tracking-wide text-sky-800">
          {titulo} · qty
        </p>
        <div className="flex flex-wrap gap-1">
          {sorted.map((g, idx) => {
            const etiqueta =
              (modoConfecciones && (g.talle || parseGradaAbierta638(g.curva)?.talle)) || g.curva;
            const qty = g.pares;
            const activa = qty > 0;
            return (
              <span
                key={`${g.curva}-${g.lpn ?? ""}-${idx}`}
                title={
                  showVentas && g.vendidos > 0
                    ? `${etiqueta}: ${qty} ${uLabel} · ${g.vendidos} v`
                    : `${etiqueta}: ${qty} ${uLabel}`
                }
                className={`inline-flex min-w-[1.75rem] flex-col items-center rounded border px-1 py-0.5 font-mono ${
                  activa
                    ? "border-sky-300 bg-white text-slate-900"
                    : "border-slate-200 bg-slate-50 text-slate-400"
                }`}
              >
                <span className="text-[10px] font-bold leading-none">{etiqueta}</span>
                <span
                  className={`mt-0.5 text-[9px] font-semibold tabular-nums leading-none ${
                    activa ? "text-sky-700" : "text-slate-400"
                  }`}
                >
                  {fmtPares(qty)}
                </span>
              </span>
            );
          })}
        </div>
        {totalSaldo > 0 ? (
          <p className="mt-1 text-[7px] font-semibold tabular-nums text-slate-500">
            Σ {fmtPares(totalSaldo)} {uLabel}
            {showVentas && totalVendido > 0 ? ` · ${fmtPares(totalVendido)} v` : ""}
          </p>
        ) : null}
      </div>
    );
  }

  const filas = (
    <div className="flex flex-col gap-px">
      {sorted.map((g, idx) => (
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
              <span className="text-bazzar-naranja-dark">
                {fmtPares(g.pares)} {uLabel}
              </span>
            ) : showVentas && g.vendidos > 0 ? null : (
              <span className="text-slate-400">0</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );

  const resumen = [
    `${sorted.length} ${modoConfecciones ? "talle" : "curva"}${sorted.length === 1 ? "" : "s"}`,
    showVentas && totalVendido > 0 ? `${fmtPares(totalVendido)} v` : null,
    totalSaldo > 0 ? `${fmtPares(totalSaldo)} ${uLabel}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  if (sorted.length === 1) {
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
        open || cardExpanded ? "flex flex-col" : ""
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
        <div
          className={`overflow-x-hidden overflow-y-auto border-t border-orange-100 px-1.5 py-0.5 ${LIST_MAX_H}`}
        >
          {filas}
        </div>
      ) : null}
    </div>
  );
}
