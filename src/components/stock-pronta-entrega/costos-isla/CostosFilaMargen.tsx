"use client";

import { useMemo } from "react";
import { DepositoProductThumb } from "@/app/depositos-bazzar/components/DepositoProductThumb";
import { formatPrecioGs } from "@/lib/depositos/precio-venta";
import {
  labelMoleculaCostos,
  pilaresImagenCostos,
} from "@/lib/costos-rimec-isla/molecule-label";
import type { FilaMargenCalc } from "@/lib/costos-rimec-isla/types";

type Props = { fila: FilaMargenCalc; listaLabel: string };

function fmtUsd(n: number): string {
  return n.toLocaleString("es-PY", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}

export function CostosFilaMargen({ fila, listaLabel }: Props) {
  const { linea: l } = fila;
  const molLabel = labelMoleculaCostos(l);
  const pilares = pilaresImagenCostos(l);

  const imageCtx = useMemo(
    () => ({
      tipoV2Id: pilares.tipoV2Id,
      proveedorImportacionId: l.proveedorId ?? undefined,
      imagenColorExcel: pilares.imagenColorExcel,
    }),
    [pilares.tipoV2Id, pilares.imagenColorExcel, l.proveedorId],
  );

  return (
    <article
      className={`flex flex-col gap-2 rounded-xl border px-3 py-2.5 sm:flex-row sm:items-stretch ${
        fila.encimaCosto ? "border-emerald-200 bg-white" : "border-red-200 bg-red-50/30"
      }`}
    >
      <div className="flex min-w-0 flex-1 gap-3">
        <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          <DepositoProductThumb
            linea={pilares.linea}
            referencia={pilares.referencia}
            material={pilares.material}
            color={pilares.color}
            imageCtx={imageCtx}
            variant="frame"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-mono text-xs font-bold text-slate-900">{l.codigo}</span>
            <span
              className={`rounded px-1.5 py-0.5 text-[9px] font-black ${
                l.proveedorId === 638
                  ? "bg-violet-100 text-violet-900"
                  : "bg-sky-100 text-sky-900"
              }`}
            >
              {l.proveedorId ?? "?"}
            </span>
            {l.marca ? (
              <span className="text-[10px] font-bold uppercase text-rimec-azul">{l.marca}</span>
            ) : null}
            {l.tipo1 ? (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600">
                {l.tipo1}
              </span>
            ) : null}
            {l.cadena && l.cadena !== "NORMAL" ? (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-900">
                {l.cadena}
              </span>
            ) : null}
          </div>
          <p className="truncate text-[11px] text-slate-600">{l.descripcion || l.grupoTexto || "—"}</p>
          <p className="font-mono text-[11px] font-bold text-rimec-azul-dark">{molLabel}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">
            Stock {Math.round(l.qty).toLocaleString("es-PY")} p · {l.depositoKey}
          </p>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-slate-100 pt-2 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0 lg:grid-cols-4 xl:grid-cols-7">
        <div className="rounded-lg border-2 border-emerald-400 bg-emerald-50 px-2 py-1.5 text-center">
          <p className="text-[8px] font-bold uppercase text-emerald-800">USD unit.</p>
          <p className="text-sm font-black tabular-nums text-emerald-950">U$ {fmtUsd(fila.usdUnit)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-2 py-1.5 text-center">
          <p className="text-[8px] font-bold uppercase text-slate-500">Costo Gs.</p>
          <p className="text-xs font-bold tabular-nums">{formatPrecioGs(fila.costoUnitGs)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-2 py-1.5 text-center">
          <p className="text-[8px] font-bold uppercase text-slate-500">{listaLabel} s/desc.</p>
          <p className="text-xs font-bold tabular-nums text-slate-800">
            {formatPrecioGs(fila.precioListaGs)}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 px-2 py-1.5 text-center">
          <p className="text-[8px] font-bold uppercase text-slate-500">{listaLabel} c/desc.</p>
          <p className="text-xs font-bold tabular-nums text-rimec-azul">
            {formatPrecioGs(fila.precioVentaGs)}
          </p>
        </div>
        <div
          className={`rounded-lg border-2 px-2 py-1.5 text-center ${
            fila.encimaCosto
              ? "border-amber-400 bg-amber-50"
              : "border-red-400 bg-red-50"
          }`}
          title="Más % que podés restar al LP c/desc (D1–D4 ya aplicados) antes de quedar bajo costo"
        >
          <p className="text-[8px] font-bold uppercase text-amber-900">Desc. extra máx.</p>
          <p
            className={`text-sm font-black tabular-nums ${
              fila.encimaCosto ? "text-amber-950" : "text-red-700"
            }`}
          >
            {fila.encimaCosto ? "hasta −" : ""}
            {Math.abs(fila.margenPctVenta).toFixed(1)}%
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 px-2 py-1.5 text-center">
          <p className="text-[8px] font-bold uppercase text-slate-500">Gs / par</p>
          <p
            className={`text-xs font-black tabular-nums ${
              fila.encimaCosto ? "text-emerald-800" : "text-red-700"
            }`}
          >
            {formatPrecioGs(fila.margenGsPar)}
          </p>
        </div>
        <div className="rounded-lg border-2 border-emerald-600/40 bg-emerald-50/80 px-2 py-1.5 text-center">
          <p className="text-[8px] font-bold uppercase text-emerald-900">Gs/par ÷ LP</p>
          <p
            className={`text-sm font-black tabular-nums ${
              fila.margenPctLista >= 0 ? "text-emerald-900" : "text-red-700"
            }`}
          >
            {fila.margenPctLista >= 0 ? "+" : ""}
            {fila.margenPctLista.toFixed(1)}%
          </p>
        </div>
      </div>
    </article>
  );
}
