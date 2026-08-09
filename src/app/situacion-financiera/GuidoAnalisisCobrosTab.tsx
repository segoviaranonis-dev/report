"use client";

import {
  COBROS_MESES,
  COBROS_PIVOTE,
} from "@/lib/situacion-financiera/demo-cuadro-cobros";

function fmt(n: number): string {
  return new Intl.NumberFormat("es-PY").format(Math.round(n));
}

function mesEtiqueta(ym: string): string {
  const [y, m] = ym.split("-");
  const n = [
    "",
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];
  return `${n[Number(m)]} ${y}`;
}

export function GuidoAnalisisCobrosTab() {
  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs text-slate-600">
        Versión Guido <strong>Análisis de cobros</strong> (
        <code className="rounded bg-slate-100 px-1">analisis_cobros.py</code>
        ). Pivote métricas × meses — previsto vs cobrado / líquido.
      </p>
      <div className="overflow-x-auto rounded border border-slate-300 bg-white">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="bg-indigo-900 text-white">
              <th className="border border-slate-400 px-3 py-2 text-left">
                Métrica
              </th>
              {COBROS_MESES.map((m) => (
                <th
                  key={m}
                  className="border border-slate-400 px-3 py-2 text-right"
                >
                  {mesEtiqueta(m)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COBROS_PIVOTE.map((fila, i) => (
              <tr
                key={fila.metrica}
                className={i === 0 ? "bg-emerald-50 font-semibold" : ""}
              >
                <td className="border border-slate-300 px-3 py-2">
                  {fila.metrica}
                </td>
                {COBROS_MESES.map((m) => (
                  <td
                    key={m}
                    className="border border-slate-300 px-3 py-2 text-right tabular-nums"
                  >
                    {fmt(fila.porMes[m] ?? 0)}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="bg-amber-50 font-bold">
              <td className="border border-slate-300 px-3 py-2">
                Gap previsto − cobrado
              </td>
              {COBROS_MESES.map((m) => {
                const prev = COBROS_PIVOTE[0].porMes[m] ?? 0;
                const cob = COBROS_PIVOTE[1].porMes[m] ?? 0;
                const gap = prev - cob;
                return (
                  <td
                    key={m}
                    className={`border border-slate-300 px-3 py-2 text-right tabular-nums ${
                      gap > 0 ? "text-amber-800" : "text-emerald-800"
                    }`}
                  >
                    {fmt(gap)}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
