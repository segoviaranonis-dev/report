"use client";

import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalisisNodo } from "@/app/api/depositos/[cliente_id]/analisis/route";
import { RIMEC_RECHARTS_TOOLTIP } from "@/app/rimec/chart-theme";
import {
  BAZZAR_CHART_COLORS,
  buildEstiloMarcaChart,
  buildGeneroChart,
  buildMarcaEstiloChart,
  fmtInt,
} from "./analisis-chart-utils";

type Props = {
  resumenOperativo: AnalisisNodo[];
  analisisPorEstilo: AnalisisNodo[];
  analisisPorMarca: AnalisisNodo[];
  soloConSaldo: boolean;
};

function fmtParesTooltip(value: unknown, name: unknown): [string, string] {
  const n = typeof value === "number" ? value : Number(value);
  return [`${fmtInt(Number.isFinite(n) ? n : 0)} pares`, String(name ?? "")];
}

function ChartCard({
  index,
  title,
  subtitle,
  children,
  footer,
}: {
  index: number;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border-2 border-bazzar-naranja/25 bg-white shadow-md">
      <div className="border-b border-bazzar-naranja/15 bg-gradient-to-r from-bazzar-naranja/15 via-white to-semantic-success/10 px-6 py-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-bazzar-naranja text-sm font-bold text-white shadow-sm">
            {index}
          </span>
          <div>
            <h3 className="font-serif text-lg font-semibold text-bazzar-text-dark">{title}</h3>
            <p className="mt-0.5 text-xs font-medium uppercase tracking-wider text-gray-500">
              {subtitle}
            </p>
          </div>
        </div>
      </div>
      <div className="p-6">{children}</div>
      {footer && (
        <div className="border-t border-gray-100 bg-gray-50/80 px-6 py-4">{footer}</div>
      )}
    </section>
  );
}

function CantidadesTable({
  rows,
}: {
  rows: { label: string; value: number; pct: number }[];
}) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">
            <th className="pb-2 pr-4">Segmento</th>
            <th className="pb-2 pr-4 text-right">Pares</th>
            <th className="pb-2 text-right">%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-gray-100 last:border-0">
              <td className="py-2 pr-4 font-medium text-gray-800">{r.label}</td>
              <td className="py-2 pr-4 text-right font-semibold tabular-nums text-bazzar-text-dark">
                {fmtInt(r.value)}
              </td>
              <td className="py-2 text-right tabular-nums text-gray-600">
                {r.pct.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AnalisisGraficos({
  resumenOperativo,
  analisisPorEstilo,
  analisisPorMarca,
  soloConSaldo,
}: Props) {
  const genero = buildGeneroChart(resumenOperativo, soloConSaldo);
  const estiloMarca = buildEstiloMarcaChart(analisisPorEstilo, soloConSaldo);
  const marcaEstilo = buildMarcaEstiloChart(analisisPorMarca, soloConSaldo);

  const generoColor = (name: string) => {
    if (name === "Damas") return "#ec4899";
    if (name === "Caballeros") return "#002B4E";
    return BAZZAR_CHART_COLORS[2];
  };

  return (
    <div className="space-y-8">
      {/* Gráfico 1 — Ente · Género (Damas / Caballeros) */}
      <ChartCard
        index={1}
        title={`${genero.ente} · por género`}
        subtitle="Ente → Damas y Caballeros"
        footer={
          <CantidadesTable
            rows={genero.slices.map((s) => ({
              label: s.name,
              value: s.value,
              pct: s.pct,
            }))}
          />
        }
      >
        {genero.slices.length === 0 ? (
          <EmptyChart />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_280px] lg:items-center">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={genero.slices}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={72}
                    outerRadius={118}
                    paddingAngle={3}
                    stroke="#fff"
                    strokeWidth={2}
                  >
                    {genero.slices.map((entry) => (
                      <Cell key={entry.name} fill={generoColor(entry.name)} />
                    ))}
                  </Pie>
                  <Tooltip {...RIMEC_RECHARTS_TOOLTIP} formatter={fmtParesTooltip} />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    formatter={(value) => (
                      <span className="text-sm font-medium text-gray-700">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-3">
              {genero.slices.map((s) => (
                <div
                  key={s.name}
                  className="rounded-xl border border-gray-100 bg-gradient-to-br from-white to-gray-50 p-4 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: generoColor(s.name) }}
                    />
                    <span className="text-sm font-semibold text-gray-800">{s.name}</span>
                  </div>
                  <div className="mt-2 text-2xl font-bold text-bazzar-text-dark">
                    {fmtInt(s.value)}{" "}
                    <span className="text-sm font-normal text-gray-500">pares</span>
                  </div>
                  <div className="mt-1 text-xs font-medium text-bazzar-naranja">
                    {s.pct.toFixed(1)}% del stock
                  </div>
                </div>
              ))}
              <div className="rounded-xl border-2 border-dashed border-bazzar-naranja/30 bg-bazzar-naranja/5 p-3 text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Total ente
                </div>
                <div className="text-xl font-bold text-bazzar-text-dark">
                  {fmtInt(genero.total)} pares
                </div>
              </div>
            </div>
          </div>
        )}
      </ChartCard>

      {/* Gráfico 2 — Ente → Estilo → Marca */}
      <ChartCard
        index={2}
        title={`${estiloMarca.ente} · estilo y marca`}
        subtitle="Ente → Estilo → MARCA"
        footer={
          <CantidadesTable
            rows={estiloMarca.rows.map((r) => ({
              label: r.label,
              value: r.total,
              pct: estiloMarca.rows.reduce((a, x) => a + x.total, 0) > 0
                ? (r.total / estiloMarca.rows.reduce((a, x) => a + x.total, 0)) * 100
                : 0,
            }))}
          />
        }
      >
        {estiloMarca.rows.length === 0 ? (
          <EmptyChart />
        ) : (
          <div className="h-[340px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={estiloMarca.rows}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickFormatter={(v) => fmtInt(Number(v))}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={120}
                  tick={{ fontSize: 11, fill: "#1e293b", fontWeight: 500 }}
                />
                <Tooltip {...RIMEC_RECHARTS_TOOLTIP} formatter={fmtParesTooltip} />
                <Legend iconType="square" wrapperStyle={{ fontSize: 11 }} />
                {estiloMarca.seriesKeys.map((key, i) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    stackId="a"
                    fill={BAZZAR_CHART_COLORS[i % BAZZAR_CHART_COLORS.length]}
                    radius={i === estiloMarca.seriesKeys.length - 1 ? [0, 4, 4, 0] : undefined}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      {/* Gráfico 3 — Ente → Marca → Estilo */}
      <ChartCard
        index={3}
        title={`${marcaEstilo.ente} · marca y estilo`}
        subtitle="Ente → MARCA → Estilo"
        footer={
          <CantidadesTable
            rows={marcaEstilo.rows.map((r) => ({
              label: r.label,
              value: r.total,
              pct: marcaEstilo.rows.reduce((a, x) => a + x.total, 0) > 0
                ? (r.total / marcaEstilo.rows.reduce((a, x) => a + x.total, 0)) * 100
                : 0,
            }))}
          />
        }
      >
        {marcaEstilo.rows.length === 0 ? (
          <EmptyChart />
        ) : (
          <div className="h-[340px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={marcaEstilo.rows}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickFormatter={(v) => fmtInt(Number(v))}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={100}
                  tick={{ fontSize: 11, fill: "#1e293b", fontWeight: 600 }}
                />
                <Tooltip {...RIMEC_RECHARTS_TOOLTIP} formatter={fmtParesTooltip} />
                <Legend iconType="square" wrapperStyle={{ fontSize: 11 }} />
                {marcaEstilo.seriesKeys.map((key, i) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    stackId="b"
                    fill={BAZZAR_CHART_COLORS[(i + 2) % BAZZAR_CHART_COLORS.length]}
                    radius={i === marcaEstilo.seriesKeys.length - 1 ? [0, 4, 4, 0] : undefined}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center">
      <span className="mb-2 text-3xl">📊</span>
      <p className="text-sm text-gray-600">Sin datos para este gráfico</p>
    </div>
  );
}
