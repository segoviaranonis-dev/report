"use client";

import { useMemo, useState } from "react";
import type { EstiloDrill } from "@/lib/depositos/deposito-estadisticas-drill";
import { colorForIndex, estilosDrillToSlices, tonosToSlices } from "@/lib/depositos/deposito-estadisticas-charts";
import { ChartAccordion } from "./charts/ChartAccordion";
import { InteractiveBarChart } from "./charts/ChartTooltip";
import { InteractiveDonutChart } from "./charts/InteractiveDonutChart";

type Props = {
  index: number;
  drill: EstiloDrill[];
  defaultOpen?: boolean;
};

export function EstiloTonoDrillSection({ index, drill, defaultOpen = false }: Props) {
  const [openEstilo, setOpenEstilo] = useState<string | null>(null);
  const totalPares = useMemo(() => drill.reduce((s, e) => s + e.totalPares, 0), [drill]);
  const estiloSlices = useMemo(() => estilosDrillToSlices(drill), [drill]);

  if (drill.length === 0) {
    return (
      <ChartAccordion
        index={index}
        title="Estilo · tono"
        subtitle="Sin datos en la vista filtrada"
        defaultOpen={defaultOpen}
      >
        <p className="py-6 text-center text-sm text-report-muted">Sin datos estilo / tono.</p>
      </ChartAccordion>
    );
  }

  return (
    <ChartAccordion
      index={index}
      title="Estilo · tono"
      subtitle="Abrí estilo → tono → N° · hover muestra pares y %"
      badge={`${drill.length} estilos`}
      defaultOpen={defaultOpen}
    >
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <InteractiveDonutChart slices={estiloSlices} totalPares={totalPares} />
          <InteractiveBarChart slices={estiloSlices} label="Estilos · vista filtrada" />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-report-muted">
          Detalle · estilo → tono → N°
        </p>
        <div className="space-y-2">
          {drill.map((est) => (
            <EstiloBlock
              key={est.estilo}
              est={est}
              open={openEstilo === est.estilo}
              onToggle={() => setOpenEstilo((prev) => (prev === est.estilo ? null : est.estilo))}
            />
          ))}
        </div>
      </div>
    </ChartAccordion>
  );
}

function EstiloBlock({
  est,
  open,
  onToggle,
}: {
  est: EstiloDrill;
  open: boolean;
  onToggle: () => void;
}) {
  const [openTono, setOpenTono] = useState<string | null>(null);
  const slices = useMemo(() => tonosToSlices(est.tonos), [est.tonos]);

  return (
    <article className="overflow-hidden rounded-lg border border-report-rule bg-slate-50/50">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
      >
        <div>
          <p className="text-sm font-black uppercase text-bazzar-naranja-dark">{est.estilo}</p>
          <p className="text-xs text-report-muted">
            {est.tonos.length} tonos ·{" "}
            <span className="font-bold tabular-nums text-bazzar-naranja">
              {est.totalPares.toLocaleString("es-PY")} p
            </span>
          </p>
        </div>
        <span className="text-lg text-slate-400">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-report-rule bg-white px-3 pb-3 pt-2">
          <div className="grid gap-4 md:grid-cols-2">
            <InteractiveDonutChart slices={slices} totalPares={est.totalPares} size={152} />
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-report-muted">
                Tonos · clic para N°
              </p>
              {est.tonos.map((t, i) => {
                const color = colorForIndex(i);
                const pct =
                  est.totalPares > 0
                    ? Math.round((t.totalPares / est.totalPares) * 1000) / 10
                    : 0;
                const active = openTono === t.tono;
                return (
                  <button
                    key={t.tono}
                    type="button"
                    onClick={() => setOpenTono((prev) => (prev === t.tono ? null : t.tono))}
                    className={`group w-full rounded-lg px-1 py-1 text-left transition ${
                      active ? "bg-orange-50 ring-1 ring-bazzar-naranja/40" : "hover:bg-slate-50"
                    }`}
                    title={`${t.tono} · ${t.totalPares.toLocaleString("es-PY")} p · ${pct}%`}
                  >
                    <div className="flex justify-between gap-2 text-[11px]">
                      <span className="flex min-w-0 items-center gap-1 truncate font-medium text-slate-700">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                        {t.tono}
                      </span>
                      <span className="shrink-0 tabular-nums font-bold text-bazzar-naranja group-hover:inline">
                        {t.totalPares.toLocaleString("es-PY")} p · {pct}%
                      </span>
                    </div>
                    <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(4, (t.totalPares / est.totalPares) * 100)}%`,
                          background: color,
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {openTono ? (() => {
            const tono = est.tonos.find((t) => t.tono === openTono);
            return tono ? <TonoTallaBlock estilo={est.estilo} tono={tono} /> : null;
          })() : null}
        </div>
      )}
    </article>
  );
}

function TonoTallaBlock({
  estilo,
  tono,
}: {
  estilo: string;
  tono: EstiloDrill["tonos"][number];
}) {
  const max = Math.max(...tono.tallas.map((t) => t.pares), 1);

  return (
    <div className="rounded-xl border border-report-rule bg-slate-50/80 p-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-bold text-slate-800">
          {estilo} · <span className="text-bazzar-naranja">{tono.tono}</span>
        </p>
        <p className="text-xs font-black tabular-nums text-bazzar-naranja-dark">
          {tono.totalPares.toLocaleString("es-PY")} p total
        </p>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {tono.tallas.map((t) => {
          const pct = tono.totalPares > 0 ? Math.round((t.pares / tono.totalPares) * 1000) / 10 : 0;
          return (
            <div
              key={t.talla}
              className="group rounded-lg bg-white px-2 py-1.5 shadow-sm"
              title={`N° ${t.talla} · ${t.pares.toLocaleString("es-PY")} p · ${pct}%`}
            >
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="font-bold text-emerald-700">N° {t.talla}</span>
                <span className="tabular-nums font-semibold text-slate-700 group-hover:hidden">
                  {t.pares.toLocaleString("es-PY")} p
                </span>
                <span className="hidden tabular-nums font-bold text-bazzar-naranja group-hover:inline">
                  {t.pares.toLocaleString("es-PY")} p · {pct}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500 group-hover:brightness-110"
                  style={{ width: `${Math.max(6, (t.pares / max) * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
