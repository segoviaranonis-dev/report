import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { FullSnapshotResponse } from "@/lib/rimec/full-snapshot-types";
import { variacionPctVsObjetivo } from "@/lib/rimec/variacion-objetivo";
import { TablaJerarquiaVendedorCadenaClienteMarcaMes } from "./TablaJerarquiaVendedorCadenaClienteMarcaMes";

const fmtGs = (n: number) => new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number | null) => (n === null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(1)}%`);

export function MundoVendedores({ data }: { data: FullSnapshotResponse }) {
  const { ranking_vendedores, detalle_operativo } = data;

  const top3 = ranking_vendedores.slice(0, 3);
  const total2026 = ranking_vendedores.reduce((s, v) => s + v.monto_2026, 0);
  const totalObj = ranking_vendedores.reduce((s, v) => s + v.objetivo, 0);

  const pct = totalObj > 0 ? (total2026 / totalObj) * 100 : 0;
  const clampedPct = Math.min(100, Math.max(0, pct));
  const gaugeData = [
    { name: "Completado", value: clampedPct, color: pct >= 100 ? "#4ade80" : pct >= 80 ? "#eab308" : "#f87171" },
    { name: "Restante", value: 100 - clampedPct, color: "rgba(255,255,255,0.05)" },
  ];

  return (
    <div className="flex h-full flex-col gap-6 p-2">
      <div className="grid shrink-0 grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex gap-4 lg:col-span-2">
          {top3.map((v, i) => (
            <div
              key={v.vendedor}
              className={`group relative flex-1 rounded-2xl border bg-white/5 p-6 backdrop-blur-md transition-all duration-500 ${
                i === 0
                  ? "-mb-4 -mt-4 mb-4 border-rimec-text-white/50 shadow-[0_0_30px_rgba(0,43,78,0.2)]"
                  : "mt-4 -mb-4 border-white/10"
              }`}
            >
              <div className="absolute right-4 top-4 font-serif text-4xl italic opacity-20">#{i + 1}</div>
              <h4 className="mb-1 font-sans text-sm uppercase tracking-widest text-white/50">Vendedor</h4>
              <p className={`mb-6 truncate font-serif text-xl ${i === 0 ? "text-rimec-text-white" : "text-white"}`}>{v.vendedor}</p>

              <div className="space-y-4">
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-white/40">Volumen generado</div>
                  <div className="font-serif text-2xl tabular-nums">{fmtGs(v.monto_2026)}</div>
                </div>
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-white/40">Cumplimiento</div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full ${v.cumplimiento_pct >= 100 ? "bg-green-400" : "bg-rimec-text-white"}`}
                        style={{ width: `${Math.min(100, v.cumplimiento_pct)}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs">{v.cumplimiento_pct.toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="relative flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
          <h3 className="absolute left-6 top-6 font-serif text-sm uppercase tracking-widest text-white/70">Ritmo global</h3>
          <div className="relative mt-8 h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={gaugeData}
                  cx="50%"
                  cy="100%"
                  startAngle={180}
                  endAngle={0}
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={0}
                  dataKey="value"
                  stroke="none"
                >
                  {gaugeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute bottom-0 left-0 w-full text-center">
              <div className="font-serif text-3xl">{pct.toFixed(1)}%</div>
              <div className="mt-1 text-[10px] uppercase tracking-wider text-white/40">del objetivo general</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla 7 · Ranking vendedores (paridad RimecClient / Sales Report — `porVendedor`) */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md">
        <div className="border-b border-white/10 bg-black/20 p-6">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-indigo-300/90">Tabla 7 · Ranking vendedores</p>
          <h3 className="font-serif text-sm uppercase tracking-widest text-white/90">Ranking de vendedores</h3>
          <p className="mt-2 max-w-3xl text-[10px] leading-snug text-white/40">
            Totales por vendedor desde el pivot enriquecido (<span className="text-white/50">v_ventas_pivot</span>): objetivo
            derivado de 2025 + % de meta y real del período filtrado. <span className="text-white/50">Var %</span> = variación vs
            objetivo <span className="font-mono text-white/45">(Real − Obj) / Obj</span>.
          </p>
        </div>
        <div className="custom-scrollbar max-h-[min(52vh,560px)] flex-1 overflow-auto p-0">
          <table className="w-full table-auto whitespace-nowrap text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur">
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-white/40">
                <th className="px-6 py-3 font-normal">Vendedor</th>
                <th className="px-6 py-3 text-right font-normal">Objetivo</th>
                <th className="px-6 py-3 text-right font-normal">Real 2026</th>
                <th className="px-6 py-3 text-right font-normal">Var %</th>
              </tr>
            </thead>
            <tbody>
              {ranking_vendedores.map((v, rowIdx) => {
                const varVsObj = variacionPctVsObjetivo(v.objetivo, v.monto_2026);
                const varClass =
                  varVsObj === null
                    ? "text-white/40"
                    : varVsObj >= 0
                      ? "text-emerald-400"
                      : "text-red-400";
                return (
                  <tr key={`${v.vendedor}-${rowIdx}`} className="border-b border-white/5 transition-colors hover:bg-white/5">
                    <td className="px-6 py-3 font-medium text-white/80">{v.vendedor}</td>
                    <td className="px-6 py-3 text-right tabular-nums text-white/50">{fmtGs(v.objetivo)}</td>
                    <td className="px-6 py-3 text-right tabular-nums text-rimec-text-white">{fmtGs(v.monto_2026)}</td>
                    <td className={`px-6 py-3 text-right tabular-nums ${varClass}`}>{fmtPct(varVsObj)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabla 8 · Gestión detallada (árbol 5 niveles, mismo universo que el pivot del snapshot) */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md">
        <div className="border-b border-white/10 bg-black/20 p-6">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-indigo-300/90">Tabla 8 · Gestión detallada</p>
          <h3 className="font-serif text-sm uppercase tracking-widest text-white/90">Vendedor → Cadena → Cliente → Marca → Mes</h3>
          <p className="mt-2 max-w-3xl text-[10px] leading-snug text-white/40">
            Paridad con el informe Streamlit / pestaña clásica tabla 8: se agrupa el{" "}
            <span className="text-white/50">detalle_operativo</span> del snapshot (mismas columnas de monto objetivo y real) en cinco niveles; expandí
            cada vendedor para bajar hasta el mes.
          </p>
        </div>
        <div className="custom-scrollbar max-h-[min(60vh,640px)] flex-1 overflow-auto p-3">
          <TablaJerarquiaVendedorCadenaClienteMarcaMes detalleOperativo={detalle_operativo as Record<string, unknown>[]} />
        </div>
      </div>
    </div>
  );
}
