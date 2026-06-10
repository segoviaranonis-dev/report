import React from "react";
import type { TooltipProps } from "recharts";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { FullSnapshotResponse } from "@/lib/rimec/full-snapshot-types";
import { variacionPctVsObjetivo } from "@/lib/rimec/variacion-objetivo";
import { COLOR_OBJETIVO, COLOR_REAL_ACTUAL, COLOR_REAL_ANTERIOR, RIMEC_RECHARTS_TOOLTIP } from "../chart-theme";
import { TablaJerarquiaMarcaCadenaClienteVendedor } from "./TablaJerarquiaMarcaVendedor";

const fmtGs = (n: number) => new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number | null) => (n === null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(1)}%`);

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

type BubblePoint = {
  name: string;
  /** Eje X = mismo dato que la barra «Real 2026» del Top 10. */
  monto: number;
  cumplimiento: number;
  clientes: number;
  monto_2025: number;
  objetivo: number;
  monto_2026: number;
};

function MatrizTooltip(props: any) {
  if (!props.active || !props.payload?.length) return null;
  const d = props.payload[0].payload as BubblePoint;
  return (
    <div
      style={{
        ...RIMEC_RECHARTS_TOOLTIP.contentStyle,
        padding: "10px 12px",
        minWidth: 220,
      }}
    >
      <p style={{ ...RIMEC_RECHARTS_TOOLTIP.labelStyle, marginTop: 0 }}>{d.name}</p>
      <ul className="m-0 list-none space-y-1.5 p-0 text-[12px]">
        <li className="flex justify-between gap-6 tabular-nums">
          <span className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 shrink-0 rounded-sm" style={{ background: COLOR_REAL_ANTERIOR }} />
            Real 2025
          </span>
          <span style={{ color: "#fff" }}>{fmtGs(d.monto_2025)}</span>
        </li>
        <li className="flex justify-between gap-6 tabular-nums">
          <span className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 shrink-0 rounded-sm border border-white/30" style={{ background: COLOR_OBJETIVO }} />
            Objetivo
          </span>
          <span style={{ color: "#fff" }}>{fmtGs(d.objetivo)}</span>
        </li>
        <li className="flex justify-between gap-6 tabular-nums">
          <span className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 shrink-0 rounded-sm" style={{ background: COLOR_REAL_ACTUAL }} />
            Real 2026
          </span>
          <span style={{ color: "#fff" }}>{fmtGs(d.monto_2026)}</span>
        </li>
        <li className="mt-2 border-t border-white/10 pt-2 text-[11px] text-white/75">
          Cumplimiento (Real 2026 ÷ Objetivo): <strong className="text-white">{d.cumplimiento.toFixed(1)}%</strong>
        </li>
        <li className="text-[11px] text-white/75">
          Clientes activos (2026): <strong className="text-white">{d.clientes}</strong>
        </li>
      </ul>
    </div>
  );
}

export function MundoMarcas({ data }: { data: FullSnapshotResponse }) {
  const { ranking_marcas, detalle_operativo } = data;

  // Calculate clients per brand for the bubble chart
  const brandClients = new Map<string, Set<string>>();
  for (const r of detalle_operativo) {
    const m = String(r.marca || "S/I").trim();
    const c = String(r.cliente || "").trim();
    if (m && c && Number(r.monto_26) > 0) {
      if (!brandClients.has(m)) brandClients.set(m, new Set());
      brandClients.get(m)!.add(c);
    }
  }

  const bubbleData: BubblePoint[] = ranking_marcas
    .map((m) => ({
      name: m.marca,
      monto: m.monto_2026,
      cumplimiento: Math.min(m.cumplimiento_pct, 200),
      clientes: brandClients.get(m.marca)?.size || 1,
      monto_2025: m.monto_2025,
      objetivo: m.objetivo,
      monto_2026: m.monto_2026,
    }))
    .filter((m) => m.monto > 0);

  const topMarcas = ranking_marcas.slice(0, 10).map(m => ({
    ...m,
    marca_short: m.marca.substring(0, 12)
  }));

  return (
    <div className="flex flex-col gap-6 h-full p-2">
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[400px] shrink-0">
        
        {/* Slider Comparativo (Vertical Bar) */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 relative group hover:border-white/20 transition-all">
          <h3 className="font-serif text-white/70 uppercase tracking-widest text-sm mb-4">Top 10 (Real vs Obj)</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topMarcas} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
              <XAxis type="number" stroke="rgba(255,255,255,0.3)" tickFormatter={(v) => `${(v/1000000).toFixed(0)}M`} tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }} />
              <YAxis dataKey="marca_short" type="category" stroke="rgba(255,255,255,0.3)" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }} width={80} />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.05)" }}
                {...RIMEC_RECHARTS_TOOLTIP}
                formatter={(val) => (typeof val === 'number' ? fmtGs(val) : "")}
              />
              <Bar dataKey="monto_2025" name="Real 2025" fill={COLOR_REAL_ANTERIOR} radius={[0, 4, 4, 0]} barSize={12} />
              <Bar dataKey="objetivo" name="Objetivo" fill={COLOR_OBJETIVO} radius={[0, 4, 4, 0]} barSize={12} />
              <Bar dataKey="monto_2026" name="Real 2026" fill={COLOR_REAL_ACTUAL} radius={[0, 4, 4, 0]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Bubble Desempeño — color de burbuja = Real 2026 (misma serie amarilla del Top 10); eje X = ese monto. */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 relative group hover:border-white/20 transition-all">
          <h3 className="font-serif text-white/70 uppercase tracking-widest text-sm mb-1">Matriz de Desempeño</h3>
          <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-white/45">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: COLOR_REAL_ANTERIOR }} />
              Real 2025
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm border border-white/25" style={{ background: COLOR_OBJETIVO }} />
              Objetivo
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: COLOR_REAL_ACTUAL }} />
              Real 2026 (posición X y color de burbuja)
            </span>
          </p>
          <div style={{ height: "calc(100% - 3.25rem)" }}>
            <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 12, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="monto"
                type="number"
                name="Real 2026"
                stroke={COLOR_REAL_ACTUAL}
                tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`}
                tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 10 }}
                label={{ value: "Volumen Real 2026", position: "bottom", fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
              />
              <YAxis
                dataKey="cumplimiento"
                type="number"
                name="Cumplimiento %"
                stroke="rgba(255,255,255,0.3)"
                tickFormatter={(v) => `${v}%`}
                tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
                label={{ value: "Cumpl. % (2026 / obj.)", angle: -90, position: "insideLeft", fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
              />
              <ZAxis dataKey="clientes" type="number" range={[50, 400]} name="Clientes Activos" />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<MatrizTooltip />} />
              <Scatter
                name="Real 2026"
                data={bubbleData}
                fill={COLOR_REAL_ACTUAL}
                stroke="rgba(255,255,255,0.35)"
                strokeWidth={1}
                opacity={0.88}
              />
            </ScatterChart>
          </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Tabla 5 · Ranking marcas (paridad RimecClient / Sales Report — agregado por marca) */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md">
        <div className="border-b border-white/10 bg-black/20 p-6">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-indigo-300/90">Tabla 5 · Ranking marcas</p>
          <h3 className="font-serif text-sm uppercase tracking-widest text-white/90">Ranking de marcas</h3>
          <p className="mt-2 max-w-3xl text-[10px] leading-snug text-white/40">
            Misma lógica que el informe clásico (tabla 5): agregado por marca desde el pivot enriquecido, alineado al contrato{" "}
            <span className="text-white/50">v_ventas_pivot</span> / <span className="text-white/50">marca_v2</span>.
          </p>
        </div>
        <div className="custom-scrollbar max-h-[min(52vh,560px)] flex-1 overflow-auto p-0">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur">
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-white/40">
                <th className="px-6 py-3 font-normal">Marca</th>
                <th className="px-6 py-3 text-right font-normal">Real 2025</th>
                <th className="px-6 py-3 text-right font-normal">Objetivo</th>
                <th className="px-6 py-3 text-right font-normal">Real 2026</th>
                <th className="px-6 py-3 text-right font-normal">Var %</th>
                <th className="px-6 py-3 text-right font-normal">Cumpl. %</th>
              </tr>
            </thead>
            <tbody>
              {ranking_marcas.map((m) => {
                const varVsObj = variacionPctVsObjetivo(m.objetivo, m.monto_2026);
                return (
                <tr key={m.marca} className="border-b border-white/5 transition-colors hover:bg-white/5">
                  <td className="px-6 py-3 font-medium text-white/80">{m.marca}</td>
                  <td className="px-6 py-3 text-right tabular-nums text-white/50">{fmtGs(m.monto_2025)}</td>
                  <td className="px-6 py-3 text-right tabular-nums text-white/50">{fmtGs(m.objetivo)}</td>
                  <td className="px-6 py-3 text-right tabular-nums text-rimec-text-white">{fmtGs(m.monto_2026)}</td>
                  <td
                    className={`px-6 py-3 text-right tabular-nums ${m.cumplimiento_pct >= 100 ? "text-green-400" : "text-red-400"}`}
                  >
                    {fmtPct(varVsObj)}
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums">
                    <span
                      className={`rounded px-2 py-1 text-[10px] ${m.cumplimiento_pct >= 100 ? "bg-green-400/20 text-green-400" : "bg-white/10 text-white/70"}`}
                    >
                      {m.cumplimiento_pct.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabla 6 · Matriz marcas — acordeón Marca → Cadena → Cliente → Vendedor */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md">
        <div className="border-b border-white/10 bg-black/20 p-6">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-indigo-300/90">Tabla 6 · Matriz marcas (detalle)</p>
          <h3 className="font-serif text-sm uppercase tracking-widest text-white/90">Marca → Cadena → Cliente → Vendedor</h3>
          <p className="mt-2 max-w-3xl text-[10px] leading-snug text-white/40">
            Misma lógica que la estructura de análisis del informe: se agrupa el <span className="text-white/50">detalle_operativo</span> del snapshot
            (pivot con <span className="text-white/50">Monto 26</span> y <span className="text-white/50">Monto Obj</span>) en cuatro niveles. Expandí cada
            marca para ver cadena, cliente y vendedor con subtotales.
          </p>
        </div>
        <div className="custom-scrollbar max-h-[min(60vh,640px)] flex-1 overflow-auto p-3">
          <TablaJerarquiaMarcaCadenaClienteVendedor detalleOperativo={detalle_operativo as Record<string, unknown>[]} />
        </div>
      </div>
    </div>
  );
}
