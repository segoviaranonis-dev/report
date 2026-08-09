"use client";

import type { SfCorteResumen, SfOrigen } from "@/lib/situacion-financiera/types";

function fmtGs(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("es-PY").format(Math.round(n));
}

const ROLE: Record<
  SfOrigen,
  { bg: string; border: string; label: string; tip: string }
> = {
  auto: {
    bg: "bg-emerald-100",
    border: "border-emerald-400",
    label: "VERDE",
    tip: "AUTO del cuadro / aging",
  },
  manual: {
    bg: "bg-orange-100",
    border: "border-orange-400",
    label: "NARANJA",
    tip: "MANUAL (bancos/gastos)",
  },
  pendiente: {
    bg: "bg-violet-100",
    border: "border-violet-400",
    label: "LILA",
    tip: "PENDIENTE (detalle auditable)",
  },
  calculado: {
    bg: "bg-amber-100",
    border: "border-amber-400",
    label: "AMARILLO",
    tip: "CALCULADO (saldo disponible)",
  },
};

export function GuidoHtmlRolesTab({ corte }: { corte: SfCorteResumen }) {
  const tasa = corte.tasaUsd || 5970.96;

  return (
    <div className="mt-4 space-y-4">
      <p className="text-xs text-slate-600">
        Versión Guido <strong>HTML v1 · roles de color</strong> (
        <code className="rounded bg-slate-100 px-1">
          informe_situacion_financiera.py
        </code>
        ). Misma idea: el color dice quién manda el número.
      </p>
      <div className="flex flex-wrap gap-2 text-xs">
        {(Object.keys(ROLE) as SfOrigen[]).map((k) => (
          <span
            key={k}
            className={`rounded border px-2 py-1 ${ROLE[k].bg} ${ROLE[k].border}`}
          >
            {ROLE[k].label} · {ROLE[k].tip}
          </span>
        ))}
      </div>
      <p className="text-sm text-slate-700">
        Tasa demo:{" "}
        <span className="font-semibold tabular-nums">
          {tasa.toLocaleString("es-PY", { maximumFractionDigits: 2 })}
        </span>{" "}
        · corte {corte.fechaAl}
      </p>

      {corte.bloques.map((b) => (
        <section
          key={b.mesYm}
          className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm"
        >
          <div className="bg-slate-700 px-3 py-2 text-sm font-semibold text-white">
            {b.etiqueta}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 text-left text-xs uppercase text-slate-600">
                <th className="px-3 py-2">Concepto</th>
                <th className="px-3 py-2 text-right">Gs</th>
                <th className="px-3 py-2">Rol</th>
              </tr>
            </thead>
            <tbody>
              {b.lineas.map((ln) => {
                const r = ROLE[ln.origen];
                return (
                  <tr
                    key={ln.concepto}
                    className={`border-t border-slate-200 ${r.bg}`}
                    title={ln.nota || r.tip}
                  >
                    <td className="px-3 py-2 font-medium">{ln.concepto}</td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${
                        (ln.importeGs ?? 0) < 0 ? "text-red-700" : ""
                      }`}
                    >
                      {fmtGs(ln.importeGs)}
                    </td>
                    <td className="px-3 py-2 text-xs font-semibold">{r.label}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-amber-400 bg-amber-100 font-bold">
                <td className="px-3 py-2">SALDO DISPONIBLE (calc)</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmtGs(b.saldoDisponibleGs)}
                </td>
                <td className="px-3 py-2 text-xs">AMARILLO</td>
              </tr>
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
