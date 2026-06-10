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
          <span style={{ color: "#2d2520" }}>{fmtGs(d.monto_2025)}</span>
        </li>
        <li className="flex justify-between gap-6 tabular-nums">
          <span className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 shrink-0 rounded-sm border border-rimec-azul/30" style={{ background: COLOR_OBJETIVO }} />
            Objetivo
          </span>
          <span style={{ color: "#2d2520" }}>{fmtGs(d.objetivo)}</span>
        </li>
        <li className="flex justify-between gap-6 tabular-nums">
          <span className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 shrink-0 rounded-sm" style={{ background: COLOR_REAL_ACTUAL }} />
            Real 2026
          </span>
          <span style={{ color: "#2d2520" }}>{fmtGs(d.monto_2026)}</span>
        </li>
        <li className="mt-2 border-t border-rimec-azul/15 pt-2 text-[11px] text-neutral-ink">
          Cumplimiento (Real 2026 ÷ Objetivo): <strong className="text-neutral-ink">{d.cumplimiento.toFixed(1)}%</strong>
        </li>
        <li className="text-[11px] text-neutral-ink">
          Clientes activos (2026): <strong className="text-neutral-ink">{d.clientes}</strong>
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
        <div className="bg-white backdrop-blur-md border border-rimec-azul/15 rounded-2xl p-6 relative group hover:border-rimec-azul/25 transition-all">
          <h3 className="font-serif text-rimec-azul/80 uppercase tracking-widest text-sm mb-4">Top 10 (Real vs Obj)</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topMarcas} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,43,78,0.07)" horizontal={false} />
              <XAxis type="number" stroke="rgba(0,43,78,0.28)" tickFormatter={(v) => `${(v/1000000).toFixed(0)}M`} tick={{ fill: "rgba(45,37,32,0.65)", fontSize: 10 }} />
              <YAxis dataKey="marca_short" type="category" stroke="rgba(0,43,78,0.28)" tick={{ fill: "rgba(45,37,32,0.65)", fontSize: 10 }} width={80} />
              <Tooltip
                cursor={{ fill: "rgba(0,43,78,0.07)" }}
                {...RIMEC_RECHARTS_TOOLTIP}
                formatter={(val) => (typeof val === 'number' ? fmtGs(val) : "")}
              />
              <Bar dataKey="monto_2025" name="Real 2025" fill={COLOR_REAL_ANTERIOR} radius={[0, 4, 4, 0]} barSize={12} />
              <Bar dataKey="objetivo" name="Objetivo" fill={COLOR_OBJETIVO} radius={[0, 4, 4, 0]} barSize={12} />
              <Bar dataKey="monto_2026" name="Real 2026" fill={COLOR_REAL_ACTUAL} radius={[0, 4, 4, 0]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Bubble Desempeño — color de burbuja = Real 2026 (misma serie verde del Top 10); eje X = ese monto. */}
        <div className="bg-white backdrop-blur-md border border-rimec-azul/15 rounded-2xl p-6 relative group hover:border-rimec-azul/25 transition-all">
          <h3 className="font-serif text-rimec-azul/80 uppercase tracking-widest text-sm mb-1">Matriz de Desempeño</h3>
          <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-neutral-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: COLOR_REAL_ANTERIOR }} />
              Real 2025
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm border border-rimec-azul/25" style={{ background: COLOR_OBJETIVO }} />
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
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,43,78,0.07)" />
              <XAxis
                dataKey="monto"
                type="number"
                name="Real 2026"
                stroke={COLOR_REAL_ACTUAL}
                tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`}
                tick={{ fill: "rgba(45,37,32,0.70)", fontSize: 10 }}
                label={{ value: "Volumen Real 2026", position: "bottom", fill: "rgba(45,37,32,0.55)", fontSize: 10 }}
              />
              <YAxis
                dataKey="cumplimiento"
                type="number"
                name="Cumplimiento %"
                stroke="rgba(0,43,78,0.28)"
                tickFormatter={(v) => `${v}%`}
                tick={{ fill: "rgba(45,37,32,0.65)", fontSize: 10 }}
                label={{ value: "Cumpl. % (2026 / obj.)", angle: -90, position: "insideLeft", fill: "rgba(45,37,32,0.55)", fontSize: 10 }}
              />
              <ZAxis dataKey="clientes" type="number" range={[50, 400]} name="Clientes Activos" />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<MatrizTooltip />} />
              <Scatter
                name="Real 2026"
                data={bubbleData}
                fill={COLOR_REAL_ACTUAL}
                stroke="rgba(0,43,78,0.35)"
                strokeWidth={1}
                opacity={0.88}
              />
            </ScatterChart>
          </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Tabla 5 · Ranking marcas (paridad RimecClient / Sales Report — agregado por marca) */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-rimec-azul/15 bg-white backdrop-blur-md">
        <div className="border-b border-rimec-azul/15 bg-app-bg p-6">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-rimec-azul/80">Tabla 5 · Ranking marcas</p>
          <h3 className="font-serif text-sm uppercase tracking-widest text-rimec-azul">Ranking de marcas</h3>
          <p className="mt-2 max-w-3xl text-[10px] leading-snug text-neutral-ink-muted">
            Misma lógica que el informe clásico (tabla 5): agregado por marca desde el pivot enriquecido, alineado al contrato{" "}
            <span className="text-neutral-ink-muted">v_ventas_pivot</span> / <span className="text-neutral-ink-muted">marca_v2</span>.
          </p>
        </div>
        <div className="custom-scrollbar max-h-[min(52vh,560px)] flex-1 overflow-auto p-0">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="sticky top-0 z-10 bg-white backdrop-blur">
              <tr className="border-b border-rimec-azul/15 text-[10px] uppercase tracking-wider text-neutral-ink-muted">
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
                <tr key={m.marca} className="border-b border-rimec-azul/10 transition-colors hover:bg-white">
                  <td className="px-6 py-3 font-medium text-neutral-ink">{m.marca}</td>
                  <td className="px-6 py-3 text-right tabular-nums text-neutral-ink-muted">{fmtGs(m.monto_2025)}</td>
                  <td className="px-6 py-3 text-right tabular-nums text-neutral-ink-muted">{fmtGs(m.objetivo)}</td>
                  <td className="px-6 py-3 text-right tabular-nums text-rimec-azul">{fmtGs(m.monto_2026)}</td>
                  <td
                    className={`px-6 py-3 text-right tabular-nums ${m.cumplimiento_pct >= 100 ? "text-semantic-success" : "text-rimec-azul"}`}
                  >
                    {fmtPct(varVsObj)}
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums">
                    <span
                      className={`rounded px-2 py-1 text-[10px] ${m.cumplimiento_pct >= 100 ? "bg-semantic-success/20 text-semantic-success" : "bg-rimec-azul/5 text-rimec-azul/80"}`}
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
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-rimec-azul/15 bg-white backdrop-blur-md">
        <div className="border-b border-rimec-azul/15 bg-app-bg p-6">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-rimec-azul/80">Tabla 6 · Matriz marcas (detalle)</p>
          <h3 className="font-serif text-sm uppercase tracking-widest text-rimec-azul">Marca → Cadena → Cliente → Vendedor</h3>
          <p className="mt-2 max-w-3xl text-[10px] leading-snug text-neutral-ink-muted">
            Misma lógica que la estructura de análisis del informe: se agrupa el <span className="text-neutral-ink-muted">detalle_operativo</span> del snapshot
            (pivot con <span className="text-neutral-ink-muted">Monto 26</span> y <span className="text-neutral-ink-muted">Monto Obj</span>) en cuatro niveles. Expandí cada
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
