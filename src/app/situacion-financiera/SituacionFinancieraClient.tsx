"use client";

import { useEffect, useState } from "react";
import type { SfCorteResumen, SfOrigen } from "@/lib/situacion-financiera/types";

function fmtGs(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("es-PY").format(Math.round(n));
}

function fmtUsd(gs: number | null | undefined, tasa: number): string {
  if (gs == null || !tasa) return "—";
  return new Intl.NumberFormat("es-PY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(gs / tasa);
}

const ORIGEN_STYLE: Record<
  SfOrigen,
  { bg: string; label: string; border: string }
> = {
  auto: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    label: "AUTO · verde Guido",
  },
  manual: {
    bg: "bg-orange-50",
    border: "border-orange-200",
    label: "MANUAL · naranja",
  },
  pendiente: {
    bg: "bg-violet-50",
    border: "border-violet-200",
    label: "PENDIENTE · lila",
  },
  calculado: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    label: "CALC · amarillo",
  },
};

export function SituacionFinancieraClient() {
  const [corte, setCorte] = useState<SfCorteResumen | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/situacion-financiera/corte", {
          cache: "no-store",
        });
        const json = await res.json();
        if (!alive) return;
        if (!json.ok) throw new Error(json.error || "Error corte");
        setCorte(json.corte);
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "Error");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <p className="mt-8 text-sm text-slate-500">Cargando corte Sit Fin…</p>
    );
  }
  if (err || !corte) {
    return (
      <p className="mt-8 text-sm text-red-600">
        No se pudo cargar el corte: {err || "sin datos"}
      </p>
    );
  }

  const tasa = corte.tasaUsd || 5970.96;

  return (
    <div className="mt-8 space-y-8">
      {/* Meta corte */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Objetivo Excel
            </p>
            <h2 className="mt-1 font-serif text-xl text-slate-900">
              SF AL {corte.fechaAl.split("-").reverse().join("-")}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{corte.fuente}</p>
          </div>
          <div className="text-right text-sm">
            <p>
              Tasa USD:{" "}
              <span className="font-semibold tabular-nums">
                {tasa.toLocaleString("es-PY", { maximumFractionDigits: 2 })}
              </span>
            </p>
            <p className="mt-1">
              Pipeline:{" "}
              <span
                className={
                  corte.estadoPipeline === "cerrado"
                    ? "font-semibold text-emerald-700"
                    : "font-semibold text-amber-700"
                }
              >
                {corte.estadoPipeline}
              </span>
              {" · "}
              variaciones {corte.nVariaciones}
            </p>
          </div>
        </div>
      </section>

      {/* Ciclo económico importadora */}
      <section>
        <h3 className="font-serif text-lg text-slate-900">
          Estructura económica · importadora
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Mismo fin que Guido: del TXT ERP al tablero de liquidez mes a mes.
        </p>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {corte.cicloEconomico.map((c, i) => (
            <li
              key={c.id}
              className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4"
            >
              <span className="text-xs font-bold text-rimec-azul">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="mt-1 font-semibold text-slate-900">{c.label}</p>
              <p className="mt-1 text-xs text-slate-600">{c.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Leyenda colores Guido */}
      <section className="flex flex-wrap gap-2 text-xs">
        {(Object.keys(ORIGEN_STYLE) as SfOrigen[]).map((k) => (
          <span
            key={k}
            className={`rounded-full border px-3 py-1 ${ORIGEN_STYLE[k].bg} ${ORIGEN_STYLE[k].border}`}
          >
            {ORIGEN_STYLE[k].label}
          </span>
        ))}
      </section>

      {/* Bloques mes */}
      {corte.bloques.map((b) => (
        <section
          key={b.mesYm}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="border-b border-slate-200 bg-[#0f3d3e] px-4 py-3 text-white">
            <h3 className="font-serif text-lg">{b.etiqueta}</h3>
            <p className="text-xs text-white/70">Previsión · hoja SIT FIN</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                  <th className="px-4 py-2">Concepto</th>
                  <th className="px-4 py-2 text-right">Importe Gs</th>
                  <th className="px-4 py-2 text-right">USD</th>
                  <th className="px-4 py-2">Origen</th>
                </tr>
              </thead>
              <tbody>
                {b.lineas.map((ln) => {
                  const st = ORIGEN_STYLE[ln.origen];
                  return (
                    <tr
                      key={ln.concepto}
                      className={`border-t border-slate-100 ${st.bg}`}
                      title={ln.nota || ""}
                    >
                      <td className="px-4 py-2.5 font-medium text-slate-900">
                        {ln.concepto}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right tabular-nums ${
                          (ln.importeGs ?? 0) < 0 ? "text-red-700" : ""
                        }`}
                      >
                        {fmtGs(ln.importeGs)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                        {fmtUsd(ln.importeGs, tasa)}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-600">
                        {st.label}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {/* Cheques + aging resumen */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="font-serif text-base text-slate-900">
            Cheques a vencer (AUTO)
          </h3>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {corte.chequesPorMes.map((r) => (
                <tr key={r.mesYm} className="border-t border-slate-100">
                  <td className="py-2 text-slate-700">{r.mesYm}</td>
                  <td className="py-2 text-right tabular-nums font-medium">
                    {fmtGs(r.importeGs)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="font-serif text-base text-slate-900">
            Aging CxC (AUTO)
          </h3>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {corte.aging.map((r) => (
                <tr key={r.key} className="border-t border-slate-100">
                  <td className="py-2 text-slate-700">{r.label}</td>
                  <td className="py-2 text-right tabular-nums font-medium">
                    {fmtGs(r.importeGs)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <p className="text-xs text-slate-500">
        Próximo: cablear cuadro de vencimientos + verdes Guido al peso del Excel
        `SF AL 03-08.xlsx`. Lilas (saldo clientes / mercadería / Luisito) salen del
        detalle auditable.
      </p>
    </div>
  );
}
