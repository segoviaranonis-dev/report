"use client";

import { colorForIndex, type StatSlice } from "@/lib/depositos/deposito-estadisticas-charts";

type Props = {
  label: string;
  color: string;
  pares: number;
  pct: number;
  cajas?: number;
  compact?: boolean;
};

export function ChartTooltip({ label, color, pares, pct, cajas, compact }: Props) {
  return (
    <div className={compact ? "px-1" : "rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md"}>
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />
        <span className={`truncate font-semibold text-slate-800 ${compact ? "text-[10px]" : "text-xs"}`}>
          {label}
        </span>
      </div>
      <p className={`mt-1 tabular-nums font-bold text-bazzar-naranja ${compact ? "text-[11px]" : "text-sm"}`}>
        {pares.toLocaleString("es-PY")} p · {pct}%
      </p>
      {cajas != null && !compact ? (
        <p className="text-[11px] text-report-muted">{cajas} cajas</p>
      ) : null}
    </div>
  );
}

type BarProps = {
  slices: StatSlice[];
  label?: string;
};

export function InteractiveBarChart({ slices, label = "Barras" }: BarProps) {
  const maxBar = Math.max(...slices.map((s) => s.value), 1);

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-report-muted">{label}</p>
      {slices.map((s, i) => {
        const color = colorForIndex(i);
        return (
          <div
            key={s.label}
            className="group space-y-0.5 rounded-lg px-1 py-1 transition hover:bg-orange-50/80"
            title={`${s.label} · ${s.pares.toLocaleString("es-PY")} p · ${s.pct}%`}
          >
            <div className="flex justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-1.5 truncate font-medium text-slate-700">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
                {s.label}
              </span>
              <span className="shrink-0 tabular-nums text-slate-600 group-hover:hidden">
                {s.pares.toLocaleString("es-PY")} p · {s.pct}%
              </span>
              <span className="hidden shrink-0 tabular-nums font-bold text-bazzar-naranja group-hover:inline">
                {s.pares.toLocaleString("es-PY")} p · {s.pct}%
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all group-hover:brightness-110"
                style={{
                  width: `${Math.max(4, (s.value / maxBar) * 100)}%`,
                  background: color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
