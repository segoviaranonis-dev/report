"use client";

import { useMemo, useState } from "react";
import {
  buildSliceArcs,
  type StatSlice,
} from "@/lib/depositos/deposito-estadisticas-charts";
import { ChartTooltip } from "./ChartTooltip";

type Props = {
  slices: StatSlice[];
  totalPares: number;
  size?: number;
};

const CX = 50;
const CY = 50;
const R = 42;
const IR = 26;

function degToRad(deg: number) {
  return ((deg - 90) * Math.PI) / 180;
}

function polar(r: number, deg: number) {
  const rad = degToRad(deg);
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function arcPath(startDeg: number, endDeg: number, outer: number, inner: number) {
  if (endDeg - startDeg >= 359.9) {
    endDeg = startDeg + 359.99;
  }
  const p1 = polar(outer, startDeg);
  const p2 = polar(outer, endDeg);
  const p3 = polar(inner, endDeg);
  const p4 = polar(inner, startDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${outer} ${outer} 0 ${large} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${inner} ${inner} 0 ${large} 0 ${p4.x} ${p4.y}`,
    "Z",
  ].join(" ");
}

export function InteractiveDonutChart({ slices, totalPares, size = 176 }: Props) {
  const arcs = useMemo(() => buildSliceArcs(slices), [slices]);
  const [active, setActive] = useState<number | null>(null);

  const hover = active != null ? arcs[active] : null;

  return (
    <div className="relative flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label="Torta interactiva">
          {arcs.map((a) => (
            <path
              key={a.slice.label}
              d={arcPath(a.startDeg, a.endDeg, R, IR)}
              fill={a.color}
              opacity={active == null || active === a.index ? 1 : 0.35}
              className="cursor-pointer transition-opacity"
              onMouseEnter={() => setActive(a.index)}
              onMouseLeave={() => setActive(null)}
            />
          ))}
          <circle cx={CX} cy={CY} r={IR - 1} fill="white" pointerEvents="none" />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {hover ? (
            <ChartTooltip
              label={hover.slice.label}
              color={hover.color}
              pares={hover.slice.pares}
              pct={hover.slice.pct}
              compact
            />
          ) : (
            <>
              <span className="text-[10px] font-bold uppercase text-report-muted">Total</span>
              <span className="text-sm font-black tabular-nums text-bazzar-naranja-dark">
                {totalPares.toLocaleString("es-PY")} p
              </span>
            </>
          )}
        </div>
      </div>

      <ul className="w-full space-y-1.5">
        {arcs.map((a) => (
          <li
            key={a.slice.label}
            className={`flex cursor-pointer items-center gap-2 rounded-lg px-1 py-0.5 text-xs transition ${
              active === a.index ? "bg-orange-50 ring-1 ring-bazzar-naranja/30" : "hover:bg-slate-50"
            }`}
            onMouseEnter={() => setActive(a.index)}
            onMouseLeave={() => setActive(null)}
          >
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: a.color }} />
            <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{a.slice.label}</span>
            <span className="shrink-0 tabular-nums text-slate-600">
              {a.slice.pares.toLocaleString("es-PY")} p
            </span>
            <span className="shrink-0 tabular-nums font-bold text-bazzar-naranja">{a.slice.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
