"use client";

import { useMemo, useState, Fragment } from "react";
import comparacion from "@/lib/situacion-financiera/comparacion-ago-vs-jul.json";
import { MolAccordionPanel } from "./MolAccordion";

function fmtGs(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(
    Math.round(n)
  );
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

type Fila = {
  concepto: string;
  label: string | null;
  julio_base_gs: number | null;
  agosto_nexus_gs: number | null;
  agosto_admin_gs: number | null;
  delta_gs_nexus_vs_jul: number | null;
  pct_nexus_vs_jul: number | null;
  pct_admin_ago_vs_jul: number | null;
  delta_nexus_vs_admin_ago: number | null;
  molKey: string | null;
  fuente_nexus: string | null;
  acordeon: boolean;
};

export function SitFinComparacionPanel() {
  const [activo, setActivo] = useState(false);
  const [openMol, setOpenMol] = useState<Record<string, boolean>>({});
  const data = comparacion as {
    titulo: string;
    ley: string;
    base: { mes: string; corte: string; archivo: string; tasaUsd: number };
    actual: {
      mes: string;
      corte_nexus: string;
      fuente: string;
      referencia_admin_ago: string;
    };
    resumen: {
      n_conceptos: number;
      con_pct_nexus_vs_jul: number;
      fidelidad_nexus_vs_admin_ago_ok: number;
      fidelidad_nexus_vs_admin_ago_total: number;
      fidelidad_pct: number | null;
    };
    filas: Fila[];
  };

  const filas = useMemo(() => data.filas || [], [data.filas]);

  return (
    <div className="rounded border border-slate-300 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-serif text-sm font-semibold text-[#1F4E79]">
            Comparación mes a mes
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-600">
            Base = Julio admin · Actual = Agosto Nexus · % = variación vs mes
            anterior
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActivo((v) => !v)}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
            activo
              ? "bg-[#1F4E79] text-white"
              : "border border-[#1F4E79] bg-sky-50 text-[#1F4E79] hover:bg-sky-100"
          }`}
        >
          {activo ? "Ocultar comparación" : "Activar comparación"}
        </button>
      </div>

      {activo ? (
        <div className="mt-3 space-y-3">
          <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-950">
            <strong>Info base · Julio {data.base.corte}</strong>
            <span className="mt-1 block">
              Archivo ratificado admin:{" "}
              <code className="rounded bg-white/80 px-1">{data.base.archivo}</code>
              · tasa {data.base.tasaUsd}. No se copia al molecular; sirve de
              referencia. Agosto Nexus: corte {data.actual.corte_nexus}.
            </span>
            <span className="mt-1 block text-amber-900/90">{data.ley}</span>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="rounded border bg-slate-50 px-2 py-1">
              Conceptos: <strong>{data.resumen.n_conceptos}</strong>
            </span>
            <span className="rounded border bg-sky-50 px-2 py-1">
              Con % Nexus vs Jul:{" "}
              <strong>{data.resumen.con_pct_nexus_vs_jul}</strong>
            </span>
            <span className="rounded border bg-violet-50 px-2 py-1">
              Fidelidad Nexus↔Admin Ago (sin parche):{" "}
              <strong>
                {data.resumen.fidelidad_nexus_vs_admin_ago_ok}/
                {data.resumen.fidelidad_nexus_vs_admin_ago_total}
              </strong>
              {data.resumen.fidelidad_pct != null
                ? ` (${data.resumen.fidelidad_pct}%)`
                : ""}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-[11px]">
              <thead>
                <tr className="bg-[#0f3d3e] text-white">
                  <th className="border border-slate-400 px-2 py-1.5 text-left">
                    Concepto
                  </th>
                  <th className="border border-slate-400 px-2 py-1.5 text-right">
                    Julio base Gs
                  </th>
                  <th className="border border-slate-400 px-2 py-1.5 text-right">
                    Agosto Nexus Gs
                  </th>
                  <th className="border border-slate-400 px-2 py-1.5 text-right">
                    Δ % vs Jul
                  </th>
                  <th className="border border-slate-400 px-2 py-1.5 text-right">
                    Admin Ago Gs
                  </th>
                  <th className="border border-slate-400 px-2 py-1.5 text-right">
                    Δ Nexus−Admin
                  </th>
                  <th className="border border-slate-400 px-2 py-1.5 text-center">
                    ▸
                  </th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => {
                  const open = !!(f.molKey && openMol[f.molKey]);
                  const pct = f.pct_nexus_vs_jul;
                  const pctCls =
                    pct == null
                      ? "text-slate-500"
                      : pct > 0
                        ? "text-emerald-800"
                        : pct < 0
                          ? "text-red-800"
                          : "text-slate-800";
                  return (
                    <Fragment key={f.concepto}>
                      <tr className="odd:bg-white even:bg-slate-50">
                        <td className="border border-slate-300 px-2 py-1 font-medium">
                          {f.label || f.concepto}
                          <span className="mt-0.5 block font-mono text-[9px] text-slate-500">
                            {f.concepto}
                            {f.molKey ? ` · ${f.molKey}` : ""}
                          </span>
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-right tabular-nums bg-amber-50/80">
                          {fmtGs(f.julio_base_gs)}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-right tabular-nums">
                          {fmtGs(f.agosto_nexus_gs)}
                        </td>
                        <td
                          className={`border border-slate-300 px-2 py-1 text-right tabular-nums font-semibold ${pctCls}`}
                        >
                          {fmtPct(f.pct_nexus_vs_jul)}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-right tabular-nums text-slate-600">
                          {fmtGs(f.agosto_admin_gs)}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-right tabular-nums text-slate-600">
                          {fmtGs(f.delta_nexus_vs_admin_ago)}
                        </td>
                        <td className="border border-slate-300 px-1 py-1 text-center">
                          {f.acordeon && f.molKey ? (
                            <button
                              type="button"
                              className="rounded px-1.5 py-0.5 text-sky-800 hover:bg-sky-100"
                              onClick={() =>
                                setOpenMol((p) => ({
                                  ...p,
                                  [f.molKey!]: !p[f.molKey!],
                                }))
                              }
                            >
                              {open ? "▾" : "▸"}
                            </button>
                          ) : (
                            "·"
                          )}
                        </td>
                      </tr>
                      {open && f.molKey ? (
                        <tr>
                          <MolAccordionPanel molKey={f.molKey} />
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
