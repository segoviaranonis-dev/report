"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { VENTA_VISUAL } from "@/lib/nexus/venta-visual";
import type { CompraPreviaEstadisticasDetalle } from "@/lib/panel-control/compra-previa-canonical";

const fmtN = (n: number) => new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number | null) => (n == null ? "—" : `${n.toFixed(1)}%`);

const PP_COLORS = ["#1e40af", "#0ea5e9", "#6366f1", "#8b5cf6", "#14b8a6", "#f97316"];

type Props = {
  /** KPI servidor (hub) — debe coincidir con kpi API tras carga */
  resumenInicial?: {
    pares_inicial: number;
    pares_vendidos: number;
    pares_saldo: number;
    pedidos_pp: number;
    moleculas: number;
  };
};

export function CpEstadisticasTab({ resumenInicial }: Props) {
  const [data, setData] = useState<CompraPreviaEstadisticasDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/rimec/panel-control/estadisticas-cp", { credentials: "include" });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "Error al cargar estadísticas");
      setData(j as CompraPreviaEstadisticasDetalle);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const kpi = data?.kpi;
  const integridadOk = useMemo(() => {
    if (!kpi || !resumenInicial) return null;
    return (
      kpi.pares_inicial === resumenInicial.pares_inicial &&
      kpi.pares_vendidos === resumenInicial.pares_vendidos &&
      kpi.pares_saldo === resumenInicial.pares_saldo &&
      kpi.pedidos_abiertos === resumenInicial.pedidos_pp &&
      kpi.moleculas === resumenInicial.moleculas
    );
  }, [kpi, resumenInicial]);

  const chartPp = useMemo(
    () =>
      (data?.por_pp ?? []).map((p) => ({
        name: p.numero_proforma?.trim() || p.numero_registro,
        vendido: p.pares_vendidos,
        saldo: p.pares_saldo,
        pct: p.pct_ejecucion ?? 0,
        pp: p.numero_registro,
      })),
    [data?.por_pp],
  );

  const chartMarca = useMemo(
    () =>
      (data?.por_marca ?? []).map((m) => ({
        name: m.marca,
        value: m.pares_inicial,
        vendido: m.pares_vendidos,
        pct: m.pct_ejecucion ?? 0,
      })),
    [data?.por_marca],
  );

  const pieEjecucion = useMemo(() => {
    if (!kpi) return [];
    return [
      { name: "Vendido", value: kpi.pares_vendidos, fill: "#16a34a" },
      { name: "Saldo", value: kpi.pares_saldo, fill: "#1e40af" },
    ];
  }, [kpi]);

  if (loading && !data) {
    return <p className="font-serif text-sm text-slate-500">Cargando estadísticas CP…</p>;
  }

  if (err) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {err}
        <button type="button" onClick={() => void load()} className="ml-3 underline">
          Reintentar
        </button>
      </div>
    );
  }

  if (!kpi) return null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-600">
          Fuente canónica · molécula 5 pilares · <code className="text-[10px]">pares_vendidos</code> · PP sin stock
          omitidos
        </p>
        {integridadOk != null ? (
          <span
            className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${
              integridadOk
                ? "border border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border border-amber-300 bg-amber-50 text-amber-900"
            }`}
          >
            {integridadOk ? "Integridad 100% · hub = API" : "Revisar paridad hub/API"}
          </span>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCell label="Inicial" value={fmtN(kpi.pares_inicial)} />
        <KpiCell label="Vendido" value={fmtN(kpi.pares_vendidos)} accent="venta" />
        <KpiCell label="Saldo" value={fmtN(kpi.pares_saldo)} accent="azul" />
        <KpiCell label="Ejecución" value={fmtPct(kpi.pct_ejecucion)} />
        <KpiCell label="PP activos" value={String(kpi.pedidos_abiertos)} />
        <KpiCell label="Productos" value={fmtN(kpi.moleculas)} />
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-serif text-lg font-semibold text-slate-900">Ejecución global</h3>
          <p className="mt-1 text-xs text-slate-500">Vendido vs saldo · paridad :3001/estadisticas</p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieEjecucion}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={78}
                  paddingAngle={2}
                >
                  {pieEjecucion.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${fmtN(Number(v ?? 0))} p`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-serif text-lg font-semibold text-slate-900">Ejecución por PP</h3>
          <p className="mt-1 text-xs text-slate-500">Sin PP vacíos (0005 · 0011 · 0013)</p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartPp} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => fmtN(Number(v))} />
                <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(v, name) => [
                    `${fmtN(Number(v ?? 0))} p`,
                    name === "vendido" ? "Vendido" : "Saldo",
                  ]}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as { pp?: string; pct?: number } | undefined;
                    return row?.pp ? `${row.pp} · ${fmtPct(row.pct ?? null)}` : "";
                  }}
                />
                <Bar dataKey="vendido" stackId="a" fill="#16a34a" name="Vendido" />
                <Bar dataKey="saldo" stackId="a" fill="#1e40af" name="Saldo" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-serif text-lg font-semibold text-slate-900">Por marca</h3>
        <p className="mt-1 text-xs text-slate-500">Pares inicial · % ejecución</p>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartMarca} margin={{ bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-28} textAnchor="end" height={64} tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v) => fmtN(Number(v))} />
              <Tooltip
                formatter={(v, _n, item) => {
                  const row = item.payload as { pct?: number; vendido?: number };
                  return [
                    `${fmtN(Number(v ?? 0))} p · vendido ${fmtN(row.vendido ?? 0)} · ${fmtPct(row.pct ?? null)}`,
                    "Inicial",
                  ];
                }}
              />
              <Bar dataKey="value" name="Inicial">
                {chartMarca.map((_, i) => (
                  <Cell key={i} fill={PP_COLORS[i % PP_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">PP</th>
              <th className="px-3 py-2 text-left">Proforma</th>
              <th className="px-3 py-2 text-right">Inicial</th>
              <th className="px-3 py-2 text-right">Vendido</th>
              <th className="px-3 py-2 text-right">Saldo</th>
              <th className="px-3 py-2 text-right">Ejecución</th>
            </tr>
          </thead>
          <tbody>
            {(data?.por_pp ?? []).map((p) => (
              <tr key={p.pp_id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-mono text-xs">{p.numero_registro}</td>
                <td className="px-3 py-2">{p.numero_proforma?.trim() || "Sin proforma"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtN(p.pares_inicial)}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${VENTA_VISUAL.label}`}>
                  {fmtN(p.pares_vendidos)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-rimec-azul">{fmtN(p.pares_saldo)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtPct(p.pct_ejecucion)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function KpiCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "venta" | "azul";
}) {
  const valueCls =
    accent === "venta" ? VENTA_VISUAL.valueStrong : accent === "azul" ? "text-rimec-azul" : "text-slate-900";
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-center">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-1 font-serif text-lg font-semibold tabular-nums ${valueCls}`}>{value}</dd>
    </div>
  );
}
