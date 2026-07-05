"use client";

import { useState } from "react";
import { colorForIndex, type StatSlice } from "@/lib/depositos/deposito-estadisticas-charts";

type Props = {
  slices: StatSlice[];
  totalPares: number;
};

export function ParallelGradaBarChart({ slices, totalPares }: Props) {
  const [active, setActive] = useState<number | null>(null);
  const maxBar = Math.max(...slices.map((s) => s.value), 1);
  const hover = active != null ? slices[active] : null;

  return (
    <div className="space-y-4">
      {hover ? (
        <p className="rounded-lg bg-orange-50 px-3 py-2 text-center text-sm tabular-nums">
          <span className="font-black text-bazzar-naranja-dark">N° {hover.label}</span>
          <span className="mx-2 text-report-muted">·</span>
          <span className="font-bold text-bazzar-naranja">
            {hover.pares.toLocaleString("es-PY")} p · {hover.pct}%
          </span>
          <span className="mx-2 text-report-muted">·</span>
          <span className="text-report-muted">{hover.cajas ?? 0} cajas</span>
        </p>
      ) : (
        <p className="text-center text-xs text-report-muted">
          Total vista ·{" "}
          <span className="font-bold tabular-nums text-bazzar-naranja">
            {totalPares.toLocaleString("es-PY")} p
          </span>{" "}
          · pasá el mouse sobre cada N°
        </p>
      )}

      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-max items-end justify-center gap-2 px-1" style={{ minHeight: 220 }}>
          {slices.map((s, i) => {
            const color = colorForIndex(i);
            const h = Math.max(12, Math.round((s.value / maxBar) * 168));
            const isActive = active === i;
            return (
              <button
                key={s.label}
                type="button"
                className="group flex w-12 shrink-0 flex-col items-center gap-1"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                title={`N° ${s.label} · ${s.pares.toLocaleString("es-PY")} p · ${s.pct}%`}
              >
                <span
                  className={`text-[10px] font-bold tabular-nums transition ${
                    isActive ? "text-bazzar-naranja" : "text-slate-500 group-hover:text-bazzar-naranja"
                  }`}
                >
                  {s.pares.toLocaleString("es-PY")}
                </span>
                <div
                  className="w-full rounded-t-md transition-all group-hover:brightness-110"
                  style={{
                    height: h,
                    background: color,
                    opacity: active == null || isActive ? 1 : 0.35,
                    boxShadow: isActive ? `0 0 0 2px ${color}55` : undefined,
                  }}
                />
                <span
                  className={`text-xs font-black tabular-nums ${
                    isActive ? "text-bazzar-naranja-dark" : "text-slate-700"
                  }`}
                >
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function GradaQuantityTable({ slices }: { slices: StatSlice[] }) {
  if (slices.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-xl border border-report-rule bg-slate-50/50">
      <table className="w-full min-w-max border-collapse text-center text-xs">
        <thead>
          <tr className="bg-white">
            <th className="border-b border-report-rule px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-report-muted">
              N°
            </th>
            {slices.map((s) => (
              <th
                key={s.label}
                className="border-b border-report-rule px-2 py-2 font-black tabular-nums text-bazzar-naranja-dark"
              >
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border-b border-report-rule bg-white px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-report-muted">
              Cantidad
            </td>
            {slices.map((s) => (
              <td
                key={s.label}
                className="border-b border-report-rule px-2 py-2 tabular-nums font-bold text-bazzar-naranja"
              >
                {s.pares.toLocaleString("es-PY")} p
              </td>
            ))}
          </tr>
          <tr>
            <td className="bg-white px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-report-muted">
              %
            </td>
            {slices.map((s) => (
              <td key={s.label} className="px-2 py-2 tabular-nums text-slate-600">
                {s.pct}%
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
