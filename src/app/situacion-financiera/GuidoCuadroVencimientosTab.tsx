"use client";

import {
  CUADRO_CELDAS,
  CUADRO_COLUMNAS,
  CUADRO_FILAS,
} from "@/lib/situacion-financiera/demo-cuadro-cobros";

function fmt(n: number): string {
  if (!n) return "";
  return new Intl.NumberFormat("es-PY").format(Math.round(n));
}

function celda(fila: string, col: string): number {
  return (
    CUADRO_CELDAS.find((c) => c.fila === fila && c.col === col)?.gs ?? 0
  );
}

export function GuidoCuadroVencimientosTab() {
  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs text-slate-600">
        Versión Guido <strong>Cuadro de vencimientos</strong> (
        <code className="rounded bg-slate-100 px-1">
          cuadro_vencimientos_html.py
        </code>
        ). Pivote FILA (tipo cobro) × COLUMNAS (meses/buckets). Números demo
        escala AL — el HTML original filtra detalle al clic.
      </p>
      <div className="overflow-x-auto rounded border border-slate-300 bg-white">
        <table className="w-full min-w-[900px] border-collapse text-xs">
          <thead>
            <tr className="bg-[#0f3d3e] text-white">
              <th className="sticky left-0 border border-slate-400 bg-[#0f3d3e] px-2 py-2 text-left">
                Tipo cobro
              </th>
              {CUADRO_COLUMNAS.map((c) => (
                <th
                  key={c}
                  className="border border-slate-400 px-2 py-2 text-right whitespace-nowrap"
                >
                  {c}
                </th>
              ))}
              <th className="border border-slate-400 px-2 py-2 text-right">
                Total fila
              </th>
            </tr>
          </thead>
          <tbody>
            {CUADRO_FILAS.map((fila) => {
              let tot = 0;
              return (
                <tr key={fila} className="hover:bg-emerald-50/80">
                  <td className="sticky left-0 border border-slate-300 bg-slate-50 px-2 py-1.5 font-semibold">
                    {fila}
                  </td>
                  {CUADRO_COLUMNAS.map((col) => {
                    const v = celda(fila, col);
                    tot += v;
                    return (
                      <td
                        key={col}
                        className={`border border-slate-300 px-2 py-1.5 text-right tabular-nums ${
                          v < 0 ? "text-red-700" : v ? "text-slate-900" : "text-slate-300"
                        }`}
                      >
                        {fmt(v)}
                      </td>
                    );
                  })}
                  <td className="border border-slate-300 bg-slate-100 px-2 py-1.5 text-right font-semibold tabular-nums">
                    {fmt(tot)}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-slate-200 font-bold">
              <td className="sticky left-0 border border-slate-400 bg-slate-200 px-2 py-2">
                TOTAL
              </td>
              {CUADRO_COLUMNAS.map((col) => {
                const v = CUADRO_FILAS.reduce((s, f) => s + celda(f, col), 0);
                return (
                  <td
                    key={col}
                    className="border border-slate-400 px-2 py-2 text-right tabular-nums"
                  >
                    {fmt(v)}
                  </td>
                );
              })}
              <td className="border border-slate-400 px-2 py-2 text-right tabular-nums">
                {fmt(
                  CUADRO_CELDAS.reduce((s, c) => s + c.gs, 0)
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-500">
        Identidad Guido: saldo origen = Σ cuotas = cuadro + excluido. Próximo:
        cablear detalle auditable real del pipeline.
      </p>
    </div>
  );
}
