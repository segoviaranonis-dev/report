import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { FullSnapshotEvolucionMes, FullSnapshotResponse } from "@/lib/rimec/full-snapshot-types";
import { MES_MAP } from "@/modules/sales-report/constants";
import { COLOR_OBJETIVO, COLOR_REAL_ACTUAL, COLOR_REAL_ANTERIOR, RIMEC_RECHARTS_TOOLTIP } from "../chart-theme";
import { variacionPctVsObjetivo } from "@/lib/rimec/variacion-objetivo";

const fmtGs = (n: number) => new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number | null) => (n === null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(1)}%`);

function mesIdx(mes: string): number {
  return MES_MAP[mes] ?? 0;
}

function aggregateEvolucion(rows: FullSnapshotEvolucionMes[]) {
  const real_2025 = rows.reduce((s, m) => s + m.real_2025, 0);
  const objetivo = rows.reduce((s, m) => s + m.objetivo, 0);
  const real_2026 = rows.reduce((s, m) => s + m.real_2026, 0);
  const desvio_pct = (() => {
    const v = variacionPctVsObjetivo(objetivo, real_2026);
    if (v !== null && Number.isFinite(v)) return v;
    return real_2026 > 0 ? 100 : 0;
  })();
  return { real_2025, objetivo, real_2026, desvio_pct };
}

function SubtotalEvolucionRow({
  label,
  subtitle,
  agg,
  tone,
}: {
  label: string;
  subtitle: string;
  agg: { real_2025: number; objetivo: number; real_2026: number; desvio_pct: number };
  tone: "s1" | "s2" | "anual";
}) {
  const base =
    tone === "anual"
      ? "bg-gradient-to-r from-rimec-azul-light/15 via-rimec-azul/5 to-transparent border-t border-b border-rimec-azul/25"
      : tone === "s1"
        ? "bg-rimec-azul/5 border-t border-rimec-azul/15"
        : "bg-rimec-azul/5 border-t border-rimec-azul/15";
  return (
    <tr className={`${base} font-medium`}>
      <td className="px-4 py-3">
        <span className="block text-[9px] font-semibold uppercase tracking-[0.2em] text-neutral-ink-muted">{subtitle}</span>
        <span className="text-xs tracking-wide text-rimec-text-rimec-azul">{label}</span>
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-neutral-ink-medium">{fmtGs(agg.real_2025)}</td>
      <td className="px-4 py-3 text-right tabular-nums text-neutral-ink-medium">{fmtGs(agg.objetivo)}</td>
      <td className="px-4 py-3 text-right tabular-nums text-rimec-azul">{fmtGs(agg.real_2026)}</td>
      <td
        className={`px-4 py-3 text-right tabular-nums ${
          agg.desvio_pct >= 0 ? "text-semantic-success" : "text-semantic-error"
        }`}
      >
        {fmtPct(agg.desvio_pct)}
      </td>
    </tr>
  );
}

const RADIAL_MS = 1500;

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

/** Punto en el borde del círculo; 0° = arriba, avance horario. */
function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, sweepDeg: number) {
  if (sweepDeg <= 0.01) return "";
  const endDeg = startDeg + sweepDeg;
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  const large = sweepDeg > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

function useAnimatedRatio(targetPct: number, durationMs: number, resetKey: string, enabled: boolean) {
  const [v, setV] = React.useState(1);
  React.useEffect(() => {
    if (!enabled) {
      setV(0);
      return;
    }
    let raf = 0;
    let cancelled = false;
    const startVal = 1;
    const endVal = Number.isFinite(targetPct) ? targetPct : 0;
    const t0 = performance.now();
    function tick(now: number) {
      if (cancelled) return;
      const u = Math.min(1, (now - t0) / durationMs);
      const e = easeOutCubic(u);
      setV(startVal + (endVal - startVal) * e);
      if (u < 1) raf = requestAnimationFrame(tick);
      else setV(endVal);
    }
    setV(startVal);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [resetKey, targetPct, durationMs, enabled]);
  return enabled ? v : 0;
}

function SemesterRealRadialCard({
  title,
  subtitle,
  real2025,
  real2026,
  animKey,
}: {
  title: string;
  subtitle: string;
  real2025: number;
  real2026: number;
  animKey: string;
}) {
  const fid = React.useId().replace(/:/g, "");
  const cx = 60;
  const cy = 60;
  const r = 46;
  const strokeW = 9;

  const hasBase = real2025 > 0;
  const targetRatio = hasBase ? (real2026 / real2025) * 100 : 0;
  const animated = useAnimatedRatio(targetRatio, RADIAL_MS, animKey, hasBase);

  const sweepBlueDeg = Math.min(Math.min(animated, 100) * 3.6, 359.98);
  const sweepGoldDeg = animated > 100 ? Math.min((animated - 100) * 3.6, 359.98) : 0;
  const startGoldDeg = -90 + Math.min(animated, 100) * 3.6;

  const dBlue = sweepBlueDeg > 0.02 ? arcPath(cx, cy, r, -90, sweepBlueDeg) : "";
  const dGold = sweepGoldDeg > 0.02 ? arcPath(cx, cy, r, startGoldDeg, sweepGoldDeg) : "";

  const centerLabel =
    !hasBase && real2026 > 0 ? "—" : !hasBase && real2026 === 0 ? "—" : `${animated >= 10 ? animated.toFixed(0) : animated.toFixed(1)}%`;

  return (
    <div className="flex min-h-[240px] flex-col items-center justify-between px-1">
      <div className="w-full text-center">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-ink-muted">{subtitle}</p>
        <p className="mt-0.5 text-[11px] font-medium tracking-wide text-rimec-text-rimec-azul">{title}</p>
      </div>
      <div className="relative mt-2 h-[168px] w-[168px] shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full">
          <defs>
            <filter id={`glow-${fid}`} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="1.8" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="rgba(0,43,78,0.10)"
            strokeWidth={strokeW}
            strokeLinecap="round"
          />
          {dBlue ? (
            <path
              d={dBlue}
              fill="none"
              stroke={COLOR_REAL_ANTERIOR}
              strokeWidth={strokeW}
              strokeLinecap="round"
              filter={`url(#glow-${fid})`}
            />
          ) : null}
          {dGold ? (
            <path
              d={dGold}
              fill="none"
              stroke={COLOR_REAL_ACTUAL}
              strokeWidth={strokeW}
              strokeLinecap="round"
              filter={`url(#glow-${fid})`}
            />
          ) : null}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-1">
          <span className="font-serif text-2xl font-semibold tabular-nums tracking-tight text-neutral-ink">{centerLabel}</span>
          <span className="mt-1 h-1 w-10 rounded-full bg-rimec-azul/10" aria-hidden />
        </div>
      </div>
      <div className="mt-3 w-full space-y-2 px-1 text-[10px] leading-tight">
        <div className="flex items-center justify-between gap-2 border-b border-rimec-azul/10 pb-1.5">
          <span className="uppercase tracking-wider text-neutral-ink-muted">Real 2025</span>
          <span className="tabular-nums text-rimec-azul/80">{fmtGs(real2025)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="uppercase tracking-wider text-rimec-text-rimec-azul/80">Real 2026</span>
          <span className="tabular-nums text-rimec-text-rimec-azul">{fmtGs(real2026)}</span>
        </div>
      </div>
    </div>
  );
}

export function MundoDashboard({ data }: { data: FullSnapshotResponse }) {
  const { kpis, evolucion_mensual } = data;

  const mesesOrdenados = React.useMemo(
    () => [...evolucion_mensual].sort((a, b) => mesIdx(a.mes) - mesIdx(b.mes)),
    [evolucion_mensual]
  );

  const sem1Rows = React.useMemo(
    () => mesesOrdenados.filter((m) => {
      const i = mesIdx(m.mes);
      return i >= 1 && i <= 6;
    }),
    [mesesOrdenados]
  );
  const sem2Rows = React.useMemo(
    () => mesesOrdenados.filter((m) => {
      const i = mesIdx(m.mes);
      return i >= 7 && i <= 12;
    }),
    [mesesOrdenados]
  );

  const aggS1 = aggregateEvolucion(sem1Rows);
  const aggS2 = aggregateEvolucion(sem2Rows);
  const aggAnual = aggregateEvolucion(mesesOrdenados);

  const showSem1Chart = sem1Rows.length > 0;
  const showSem2Chart = sem2Rows.length > 0;
  const radialGridClass =
    showSem1Chart && showSem2Chart ? "grid-cols-1 gap-6 sm:grid-cols-2" : "grid-cols-1 place-items-center";

  return (
    <div className="flex h-full flex-col gap-6 p-2">
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <KpiCard title="Monto Período (Real 2026)" value={kpis.monto_periodo} type="currency" />
        <KpiCard
          title="Objetivo"
          value={kpis.monto_objetivo}
          type="currency"
          progress={kpis.monto_objetivo > 0 ? (kpis.monto_periodo / kpis.monto_objetivo) * 100 : 0}
        />
        <KpiCard title="Var. Interanual" value={kpis.variacion_pct} type="percent" highlight />
        <KpiCard title="Clientes Activos" value={kpis.clientes_activos} type="number" />
      </div>

      <div className="grid min-h-[400px] flex-1 grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Barras: orden Real 2025 | Objetivo | Real 2026 */}
        <div className="flex flex-col rounded-2xl border border-rimec-azul/15 bg-white p-6 backdrop-blur-md transition-all duration-500 hover:border-rimec-azul/25 lg:col-span-2">
          <h3 className="mb-6 font-serif text-sm uppercase tracking-widest text-rimec-azul/80">Evolución Mensual</h3>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mesesOrdenados} margin={{ top: 10, right: 10, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,43,78,0.07)" vertical={false} />
                <XAxis
                  dataKey="mes"
                  stroke="rgba(0,43,78,0.28)"
                  tick={{ fill: "rgba(45,37,32,0.65)", fontSize: 12 }}
                />
                <YAxis
                  stroke="rgba(0,43,78,0.28)"
                  tickFormatter={(val) => `${(val / 1000000).toFixed(0)}M`}
                  tick={{ fill: "rgba(45,37,32,0.65)", fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(0,43,78,0.07)" }}
                  {...RIMEC_RECHARTS_TOOLTIP}
                  formatter={(value) => (typeof value === 'number' ? fmtGs(value) : "")}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: "20px" }} />
                <Bar dataKey="real_2025" name="Real 2025" fill={COLOR_REAL_ANTERIOR} radius={[4, 4, 0, 0]} />
                <Bar dataKey="objetivo" name="Objetivo" fill={COLOR_OBJETIVO} radius={[4, 4, 0, 0]} />
                <Bar dataKey="real_2026" name="Real 2026" fill={COLOR_REAL_ACTUAL} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Real 2025 vs 2026 por semestre (radial); un solo gráfico si solo hay meses de un semestre */}
        <div className="relative flex flex-col rounded-2xl border border-rimec-azul/15 bg-white p-6 backdrop-blur-md transition-all duration-500 hover:border-rimec-azul/30 hover:shadow-sm">
          <h3 className="absolute left-6 top-6 max-w-[calc(100%-3rem)] font-serif text-sm uppercase tracking-widest text-rimec-azul/80">
            Real 2025 vs 2026
          </h3>
          <p className="absolute left-6 top-[2.35rem] max-w-[calc(100%-3rem)] text-[10px] leading-snug text-neutral-ink-muted">
            Porcentaje: Real 2026 respecto a Real 2025 del semestre (filtros aplicados). Anillo azul hasta 100%; oro = por encima.
          </p>
          <div className={`mt-20 grid flex-1 ${radialGridClass}`}>
            {showSem1Chart ? (
              <SemesterRealRadialCard
                title="1er semestre"
                subtitle="Ene — Jun"
                real2025={aggS1.real_2025}
                real2026={aggS1.real_2026}
                animKey={`s1-${aggS1.real_2025}-${aggS1.real_2026}`}
              />
            ) : null}
            {showSem2Chart ? (
              <SemesterRealRadialCard
                title="2do semestre"
                subtitle="Jul — Dic"
                real2025={aggS2.real_2025}
                real2026={aggS2.real_2026}
                animKey={`s2-${aggS2.real_2025}-${aggS2.real_2026}`}
              />
            ) : null}
            {!showSem1Chart && !showSem2Chart ? (
              <p className="col-span-full py-12 text-center text-sm text-neutral-ink-muted">
                No hay meses en el rango seleccionado para dibujar la comparativa.
              </p>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-6 border-t border-rimec-azul/10 pt-3 text-[10px] uppercase tracking-wider text-neutral-ink-muted">
            <span className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: COLOR_REAL_ANTERIOR }} />
              Avance hasta 100% (vs 2025)
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: COLOR_REAL_ACTUAL }} />
              Por encima del 100%
            </span>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-2xl border border-rimec-azul/15 bg-white p-6 backdrop-blur-md transition-all duration-500 hover:border-rimec-azul/25">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-rimec-azul/15 text-[10px] uppercase tracking-wider text-neutral-ink-muted">
              <th className="px-4 py-3 font-normal">Mes</th>
              <th className="px-4 py-3 text-right font-normal">Real 2025</th>
              <th className="px-4 py-3 text-right font-normal">Objetivo</th>
              <th className="px-4 py-3 text-right font-normal">Real 2026</th>
              <th className="px-4 py-3 text-right font-normal">Desvío %</th>
            </tr>
          </thead>
          <tbody>
            {mesesOrdenados.map((m) => (
              <tr key={m.mes} className="group border-b border-rimec-azul/10 transition-colors hover:bg-white">
                <td className="px-4 py-3 text-rimec-azul/80 transition-colors group-hover:text-rimec-azul">{m.mes}</td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-ink-muted">{fmtGs(m.real_2025)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-ink-muted">{fmtGs(m.objetivo)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-ink">{fmtGs(m.real_2026)}</td>
                <td
                  className={`px-4 py-3 text-right tabular-nums ${m.desvio_pct >= 0 ? "text-semantic-success" : "text-semantic-error"}`}
                >
                  {fmtPct(m.desvio_pct)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <SubtotalEvolucionRow
              subtitle="Sumatoria"
              label="1er semestre — Sub total"
              agg={aggS1}
              tone="s1"
            />
            <SubtotalEvolucionRow
              subtitle="Sumatoria"
              label="2do semestre — Sub total"
              agg={aggS2}
              tone="s2"
            />
            <SubtotalEvolucionRow
              subtitle="Sumatoria"
              label="Anual — Sub total"
              agg={aggAnual}
              tone="anual"
            />
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  type,
  highlight = false,
  progress,
}: {
  title: string;
  value: number | null;
  type: "currency" | "percent" | "number";
  highlight?: boolean;
  progress?: number;
}) {
  const isPos = value !== null && value >= 0;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-rimec-azul/15 bg-white p-6 backdrop-blur-md transition-all duration-500 group hover:bg-rimec-azul/5 ${
        highlight ? "ring-1 ring-rimec-azul/20 hover:ring-rimec-azul/35" : ""
      }`}
    >
      <h4 className="mb-2 font-sans text-xs uppercase tracking-widest text-neutral-ink-muted transition-colors group-hover:text-rimec-azul/80">
        {title}
      </h4>
      <div
        className={`font-serif text-3xl font-light tabular-nums ${
          type === "percent"
            ? isPos
              ? "text-semantic-success drop-shadow-[0_0_8px_rgba(74,222,128,0.5)]"
              : "text-semantic-error drop-shadow-[0_0_8px_rgba(140,59,59,0.35)]"
            : "text-neutral-ink"
        }`}
      >
        {type === "currency" ? fmtGs(value || 0) : type === "percent" ? fmtPct(value) : value || 0}
      </div>

      {progress !== undefined && (
        <div className="absolute bottom-0 left-0 h-1 w-full bg-rimec-azul/5">
          <div className="h-full bg-rimec-azul" style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
      )}

      <div className="pointer-events-none absolute -inset-10 rounded-full bg-white opacity-0 mix-blend-screen blur-2xl transition-opacity duration-700 group-hover:opacity-100" />
    </div>
  );
}
