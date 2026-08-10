"use client";

import { useMemo, useState, Fragment } from "react";
import comparacion from "@/lib/situacion-financiera/comparacion-ago-vs-jul.json";
import { MolAccordionPanel } from "./MolAccordion";

function fmtUsd(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("es-PY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

type Fila = {
  concepto: string;
  label: string | null;
  julio_base_usd?: number | null;
  agosto_sitfin_usd?: number | null;
  agosto_nexus_gs: number | null;
  pct_usd_sitfin_vs_jul?: number | null;
  pct_nexus_vs_jul: number | null;
  delta_usd_sitfin_vs_jul?: number | null;
  molKey: string | null;
  acordeon: boolean;
};

export function SitFinComparacionPanel() {
  const [activo, setActivo] = useState(false);
  const [openMol, setOpenMol] = useState<Record<string, boolean>>({});
  const data = comparacion as {
    titulo: string;
    ley: string;
    isla?: boolean;
    comparacion?: {
      modo: string;
      meses: string[];
      tasa_julio: number;
      tasa_agosto: number;
    };
    base: { mes: string; corte: string; archivo: string; tasaUsd: number };
    actual: {
      mes: string;
      corte_nexus?: string;
      corte_sitfin?: string;
      fuente: string;
      referencia_admin_ago: string;
      tasaUsd?: number;
    };
    resumen: {
      n_conceptos: number;
      con_pct_usd?: number;
      con_pct_nexus_vs_jul: number;
      n_pares_usd?: number;
      fidelidad_pct: number | null;
    };
    filas: Fila[];
  };

  /** Solo Julio ↔ Agosto con USD (isla). */
  const filas = useMemo(
    () =>
      (data.filas || []).filter(
        (f) => f.julio_base_usd != null || f.agosto_sitfin_usd != null
      ),
    [data.filas]
  );

  const tasaJul = data.comparacion?.tasa_julio ?? data.base.tasaUsd;
  const tasaAgo =
    data.comparacion?.tasa_agosto ?? data.actual.tasaUsd ?? 5970.96;

  return (
    <div className="rounded border border-slate-300 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-serif text-sm font-semibold text-[#1F4E79]">
            Comparación Julio ↔ Agosto · USD
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-600">
            Solo campos <strong>Julio</strong> y <strong>Agosto</strong> ·{" "}
            <strong>USD vs USD</strong> + % · isla SF blindada
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
            <strong>
              USD predeterminado · Jul tasa {tasaJul} · Ago tasa {tasaAgo}
            </strong>
            <span className="mt-1 block">
              Base Julio {data.base.corte} (
              <code className="rounded bg-white/80 px-1">{data.base.archivo}</code>
              ) vs Agosto Sit Fin isla (
              {data.actual.corte_sitfin || data.actual.corte_nexus}). Comparación{" "}
              <strong>solo USD ↔ USD y %</strong> — no mezcla otros meses ni
              resultados Nexus.
            </span>
            <span className="mt-1 block text-amber-900/90">{data.ley}</span>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="rounded border bg-slate-50 px-2 py-1">
              Conceptos Jul↔Ago: <strong>{filas.length}</strong>
            </span>
            <span className="rounded border bg-sky-50 px-2 py-1">
              Pares USD:{" "}
              <strong>{data.resumen.n_pares_usd ?? data.resumen.con_pct_usd}</strong>
            </span>
            <span className="rounded border bg-emerald-50 px-2 py-1">
              Modo: <strong>USD vs USD + %</strong>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-[11px]">
              <thead>
                <tr className="bg-[#0f3d3e] text-white">
                  <th className="border border-slate-400 px-2 py-1.5 text-left">
                    Concepto
                  </th>
                  <th className="border border-slate-400 px-2 py-1.5 text-right">
                    Julio USD
                  </th>
                  <th className="border border-slate-400 px-2 py-1.5 text-right">
                    Agosto USD
                  </th>
                  <th className="border border-slate-400 px-2 py-1.5 text-right">
                    Δ USD
                  </th>
                  <th className="border border-slate-400 px-2 py-1.5 text-right">
                    Δ %
                  </th>
                  <th className="border border-slate-400 px-2 py-1.5 text-center">
                    ▸
                  </th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => {
                  const open = !!(f.molKey && openMol[f.molKey]);
                  const pct =
                    f.pct_usd_sitfin_vs_jul ?? f.pct_nexus_vs_jul ?? null;
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
                          </span>
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-right tabular-nums bg-amber-50/80">
                          {fmtUsd(f.julio_base_usd)}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-right tabular-nums">
                          {fmtUsd(f.agosto_sitfin_usd)}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-right tabular-nums">
                          {fmtUsd(f.delta_usd_sitfin_vs_jul)}
                        </td>
                        <td
                          className={`border border-slate-300 px-2 py-1 text-right tabular-nums font-semibold ${pctCls}`}
                        >
                          {fmtPct(pct)}
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
