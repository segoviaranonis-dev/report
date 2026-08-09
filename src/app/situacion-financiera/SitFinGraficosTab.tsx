"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EXCEL_AL_0308 } from "@/lib/situacion-financiera/excel-al-0308";
import type { SfCorteResumen } from "@/lib/situacion-financiera/types";

const COLORS = ["#0f3d3e", "#1F4E79", "#C6A336", "#C00000", "#A9D08E", "#5B9BD5", "#7030A0"];

function fmtM(n: number): string {
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1)} mil M`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(0)} M`;
  return new Intl.NumberFormat("es-PY").format(Math.round(n));
}

function saldoDisponibleSeries() {
  return EXCEL_AL_0308.rows
    .filter((r) => r.kind === "total_yellow" && r.gs != null)
    .map((r) => {
      const m = (r.label || "").replace(/SALDO DISPONIBLE\s*/i, "").trim();
      return { mes: m || `fila ${r.r}`, gs: r.gs as number, usd: r.usd ?? 0 };
    });
}

function bancosSeries() {
  return EXCEL_AL_0308.rows
    .filter(
      (r) =>
        r.kind === "row" &&
        r.gs != null &&
        !!r.label &&
        /BANCO|BANCOOP/i.test(r.label) &&
        r.r <= 12
    )
    .map((r) => ({
      banco: (r.label || "")
        .replace(/^SALDO EN (USD\.|GS\.?\s*)/i, "")
        .trim(),
      gs: r.gs as number,
    }));
}

export function SitFinGraficosTab({ corte }: { corte: SfCorteResumen }) {
  const saldos = saldoDisponibleSeries();
  const bancos = bancosSeries();
  const cheques = corte.chequesPorMes.map((c) => ({
    mes: c.mesYm.slice(5),
    cheques: c.importeGs,
    pv: corte.pvProgPorMes.find((p) => p.mesYm === c.mesYm)?.importeGs ?? 0,
  }));
  const aging = corte.aging
    .filter((a) => a.importeGs > 0)
    .map((a) => ({ name: a.label.replace("Vencidos ", ""), value: a.importeGs }));

  return (
    <div className="mt-4 space-y-6">
      <p className="text-xs text-slate-600">
        Vista <strong>gráficos</strong> gerencial — saldo disponible del Excel AL,
        cheques/PV del pipeline, aging CxC y bancos. No reemplaza las pestañas
        Guido; las complementa.
      </p>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="font-serif text-base text-slate-900">
          Saldo disponible (Excel AL)
        </h3>
        <div className="mt-3 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={saldos}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={fmtM} tick={{ fontSize: 10 }} width={72} />
              <Tooltip
                formatter={(v) =>
                  typeof v === "number"
                    ? new Intl.NumberFormat("es-PY").format(Math.round(v))
                    : String(v ?? "")
                }
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="gs"
                name="Gs"
                stroke="#C6A336"
                strokeWidth={2.5}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="font-serif text-base text-slate-900">
            Cheques a vencer vs PV/PROG
          </h3>
          <div className="mt-3 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cheques}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={fmtM} tick={{ fontSize: 10 }} width={64} />
                <Tooltip
                  formatter={(v) =>
                    typeof v === "number"
                      ? new Intl.NumberFormat("es-PY").format(Math.round(v))
                      : String(v ?? "")
                  }
                />
                <Legend />
                <Bar dataKey="cheques" name="Cheques" fill="#0f3d3e" />
                <Bar dataKey="pv" name="PV/PROG" fill="#5B9BD5" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="font-serif text-base text-slate-900">Aging CxC</h3>
          <div className="mt-3 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={aging}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ name }) => name}
                >
                  {aging.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) =>
                    typeof v === "number"
                      ? new Intl.NumberFormat("es-PY").format(Math.round(v))
                      : String(v ?? "")
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="font-serif text-base text-slate-900">
          Saldos bancarios (Excel AL)
        </h3>
        <div className="mt-3 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bancos} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tickFormatter={fmtM} tick={{ fontSize: 10 }} />
              <YAxis
                type="category"
                dataKey="banco"
                width={140}
                tick={{ fontSize: 10 }}
              />
              <Tooltip
                formatter={(v) =>
                  typeof v === "number"
                    ? new Intl.NumberFormat("es-PY").format(Math.round(v))
                    : String(v ?? "")
                }
              />
              <Bar dataKey="gs" name="Gs" fill="#1F4E79" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
