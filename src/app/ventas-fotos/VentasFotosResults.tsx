"use client";

import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PillarBucket, VentaFotoRow, VentasFotosMarca, VentasFotosPillarStats } from "@/lib/ventas-fotos/types";
import { chartColorAt, RIMEC_RECHARTS_TOOLTIP } from "@/app/rimec/chart-theme";
import { ProductThumbFrame } from "@/components/product/ProductThumbFrame";
import { getImagenCandidatesFlatFirst } from "@/lib/ventas-fotos/parse-imagen";

const fmtInt = new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 });
const fmtPct = new Intl.NumberFormat("es-PY", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

type Props = {
  rows: VentaFotoRow[];
  pillarStats: VentasFotosPillarStats;
  cliente: { id: string; nombre: string } | null;
  marca: VentasFotosMarca | null;
  fechaInicio: string;
  fechaFin: string;
};

export function VentasFotosResults({ rows, pillarStats, cliente, marca, fechaInicio, fechaFin }: Props) {
  return (
    <>
      <HeaderSummary cliente={cliente} marca={marca} fechaInicio={fechaInicio} fechaFin={fechaFin} />
      <PillarStatsBlock stats={pillarStats} hasRows={rows.length > 0} />
      <VentasFotosTable rows={rows} />
    </>
  );
}

function HeaderSummary({
  cliente,
  marca,
  fechaInicio,
  fechaFin,
}: {
  cliente: { id: string; nombre: string } | null;
  marca: VentasFotosMarca | null;
  fechaInicio: string;
  fechaFin: string;
}) {
  return (
    <div className="mt-6 grid gap-3 border border-report-rule bg-report-paper2 p-4 text-sm md:grid-cols-4">
      <p>
        <span className="font-semibold text-report-navy">Cliente:</span>{" "}
        {cliente ? `${cliente.id} · ${cliente.nombre}` : "—"}
      </p>
      <p>
        <span className="font-semibold text-report-navy">Marca:</span> {marca?.descp_marca ?? "—"}
      </p>
      <p>
        <span className="font-semibold text-report-navy">Desde:</span> {fechaInicio || "—"}
      </p>
      <p>
        <span className="font-semibold text-report-navy">Hasta:</span> {fechaFin || "—"}
      </p>
    </div>
  );
}

function PillarStatsBlock({ stats, hasRows }: { stats: VentasFotosPillarStats; hasRows: boolean }) {
  const fmtMoney = new Intl.NumberFormat("es-PY", { style: "currency", currency: "PYG", minimumFractionDigits: 0 });

  if (!hasRows) {
    return (
      <div className="mt-6 rounded-xl border border-report-rule bg-white p-8 text-center text-sm text-report-muted shadow-sm">
        Aplicá filtros para ver las estadísticas por pilares.
      </div>
    );
  }

  return (
    <section className="mt-6 rounded-xl border border-report-rule bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-report-rule pb-3">
        <h2 className="font-serif text-xl font-bold text-report-navy">Estadísticas por pilares</h2>
        <ResumenCompacto stats={stats.resumen} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <ChartTablePane title="Género" buckets={stats.porGenero} chart="pie" />
        <ChartTablePane title="Categoría" buckets={stats.porCategoria} chart="bar" />
        <ChartTablePane title="Estilo" buckets={stats.porEstilo} chart="bar" />
        <ChartTablePane title="Tipo" buckets={stats.porTipo1} chart="bar" />
        <ChartTablePane title="Color" buckets={stats.porColor} chart="bar" topN={10} />
      </div>

      {stats.resumen.sinClasificar > 0 ? (
        <p className="mt-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          {stats.resumen.sinClasificar} fila{stats.resumen.sinClasificar === 1 ? "" : "s"} sin metadata de pilares.
        </p>
      ) : null}

      <p className="mt-3 text-[10px] uppercase tracking-wide text-report-muted">
        Total monto: <span className="font-semibold text-report-navy">{fmtMoney.format(stats.resumen.totalMonto)}</span>
      </p>
    </section>
  );
}

function ResumenCompacto({ stats }: { stats: VentasFotosPillarStats["resumen"] }) {
  const fmtMoney = new Intl.NumberFormat("es-PY", { style: "currency", currency: "PYG", minimumFractionDigits: 0 });
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
      <SummaryChip label="Pares" value={fmtInt.format(stats.totalPares)} />
      <SummaryChip label="Monto" value={fmtMoney.format(stats.totalMonto)} />
      <SummaryChip label="Artículos únicos" value={fmtInt.format(stats.articulosUnicos)} />
    </div>
  );
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-report-muted">{label}</span>
      <span className="font-semibold tabular-nums text-report-navy">{value}</span>
    </span>
  );
}

function ChartTablePane({
  title,
  buckets,
  chart,
  topN,
}: {
  title: string;
  buckets: PillarBucket[];
  chart: "pie" | "bar";
  topN?: number;
}) {
  const data = topN ? buckets.slice(0, topN) : buckets;

  if (!data.length) {
    return (
      <div className="rounded-lg border border-report-rule bg-report-paper2 p-4 text-xs text-report-muted">
        Sin datos para {title.toLowerCase()}.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-report-rule bg-report-paper2 p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-report-navy">{title}</h3>
        <span className="text-[10px] text-report-muted">
          {buckets.length} segmento{buckets.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-3 h-44 w-full">
        {chart === "pie" ? <PillarPie data={data} /> : <PillarBars data={data} />}
      </div>

      <PillarTable rows={data} />
      {topN && buckets.length > topN ? (
        <p className="mt-2 text-[10px] text-report-muted">Mostrando top {topN} de {buckets.length}.</p>
      ) : null}
    </div>
  );
}

function PillarPie({ data }: { data: PillarBucket[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="pares"
          nameKey="label"
          cx="40%"
          cy="50%"
          outerRadius={64}
          innerRadius={28}
          paddingAngle={1}
          stroke="#ffffff"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={chartColorAt(i)} />
          ))}
        </Pie>
        <Tooltip
          {...RIMEC_RECHARTS_TOOLTIP}
          formatter={(value, _name, ctx) => {
            const n = Number(value ?? 0);
            const bucket = ctx?.payload as PillarBucket | undefined;
            return [`${fmtInt.format(n)} pares · ${fmtPct.format(bucket?.pctPares ?? 0)} %`, bucket?.label ?? ""];
          }}
        />
        <Legend layout="vertical" align="right" verticalAlign="middle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function PillarBars({ data }: { data: PillarBucket[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
        <XAxis type="number" tick={{ fontSize: 10, fill: "#4a3f35" }} tickFormatter={(v) => fmtInt.format(v)} />
        <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: "#002B4E" }} width={90} interval={0} />
        <Tooltip
          cursor={{ fill: "rgba(0,43,78,0.05)" }}
          {...RIMEC_RECHARTS_TOOLTIP}
          formatter={(value, _name, ctx) => {
            const n = Number(value ?? 0);
            const bucket = ctx?.payload as PillarBucket | undefined;
            return [`${fmtInt.format(n)} pares · ${fmtPct.format(bucket?.pctPares ?? 0)} %`, bucket?.label ?? ""];
          }}
        />
        <Bar dataKey="pares" radius={[0, 3, 3, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={chartColorAt(i)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function PillarTable({ rows }: { rows: PillarBucket[] }) {
  const fmtMoney = new Intl.NumberFormat("es-PY", { style: "currency", currency: "PYG", minimumFractionDigits: 0 });
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-report-rule text-left text-[10px] uppercase tracking-wide text-report-muted">
            <th className="py-1.5 font-semibold">Segmento</th>
            <th className="py-1.5 text-right font-semibold">Pares</th>
            <th className="py-1.5 text-right font-semibold">Monto</th>
            <th className="py-1.5 text-right font-semibold">% Pares</th>
            <th className="py-1.5 text-right font-semibold">% Monto</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.label} className="border-b border-report-rule/40 last:border-0">
              <td className="py-1.5">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: chartColorAt(i) }} />
                  {r.label}
                </span>
              </td>
              <td className="py-1.5 text-right tabular-nums">{fmtInt.format(r.pares)}</td>
              <td className="py-1.5 text-right tabular-nums">{fmtMoney.format(r.monto)}</td>
              <td className="py-1.5 text-right tabular-nums">{fmtPct.format(r.pctPares)}%</td>
              <td className="py-1.5 text-right tabular-nums">{fmtPct.format(r.pctMonto)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VentasFotosTable({ rows }: { rows: VentaFotoRow[] }) {
  if (!rows.length) {
    return (
      <div className="mt-6 rounded border border-report-rule bg-white p-8 text-center text-sm text-report-muted">
        Sin filas para los filtros seleccionados.
      </div>
    );
  }

  return (
    <div className="mt-6 overflow-x-auto border border-report-rule bg-white shadow-sm">
      <table className="report-table min-w-[960px]">
        <thead>
          <tr>
            <th className="w-28">Imagen</th>
            <th>Fecha</th>
            <th>Referencia</th>
            <th>Categoría</th>
            <th className="text-right">Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const thumbCandidates = row.imagen_valid
              ? (() => {
                  const c = getImagenCandidatesFlatFirst(row.imagen);
                  return c.length > 0 ? c : [row.image_url];
                })()
              : [];
            return (
              <tr key={`${row.imagen}-${row.fecha}-${idx}`}>
                <td>
                  <div className="w-20 print:w-16">
                    {row.imagen_valid ? (
                      <ProductThumbFrame alt={row.imagen} candidates={thumbCandidates} size={80} />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded border border-slate-200 bg-slate-100 p-1 text-center text-[10px] text-slate-400">
                        {row.imagen_error || "Sin imagen"}
                      </div>
                    )}
                  </div>
                </td>
                <td className="tabular-nums">{row.fecha}</td>
                <td className="font-mono text-xs">{row.imagen || "—"}</td>
                <td className="text-xs">{row.descp_categoria || "—"}</td>
                <td className="text-right tabular-nums">{fmtInt.format(row.cantidad)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
