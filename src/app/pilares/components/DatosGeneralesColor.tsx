"use client";

import type { ColoresResumen } from "@/lib/pilares/types";

const fmt = (n: number) => n.toLocaleString("es-PY");

interface Props {
  resumen: ColoresResumen | null;
  totalFiltrado: number;
  filasMostradas: number;
  sinTonoFiltro: boolean;
  loading: boolean;
  onFilterSinTono?: () => void;
  onFilterEtiqueta?: (etiqueta: string) => void;
}

export function DatosGeneralesColor({
  resumen,
  totalFiltrado,
  filasMostradas,
  sinTonoFiltro,
  loading,
  onFilterSinTono,
  onFilterEtiqueta,
}: Props) {
  return (
    <details open className="mb-6 rounded-xl border-2 border-rimec-azul/25 bg-card-bg shadow-sm">
      <summary className="cursor-pointer list-none px-5 py-4 marker:content-none">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-serif text-lg font-semibold text-rimec-azul-dark">Datos generales · color</span>
          {resumen && !loading && (
            <span className="text-sm text-neutral-600">
              {fmt(resumen.total)} colores · <strong>{fmt(resumen.sin_tono)}</strong> sin tono_canon
            </span>
          )}
        </div>
      </summary>

      <div className="space-y-4 border-t border-rimec-azul/10 px-5 pb-5 pt-4">
        {loading && <p className="text-sm text-neutral-500">Calculando…</p>}
        {!loading && resumen && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="Total BD" value={resumen.total} />
              <Kpi
                label="Con tono_canon"
                value={resumen.con_tono}
                hint="Única verdad filtro"
                highlight
              />
              <Kpi
                label="Sin tono_canon"
                value={resumen.sin_tono}
                hint="Pendientes admin"
                onClick={onFilterSinTono}
              />
              <Kpi
                label="Vista filtrada"
                value={totalFiltrado}
                hint={`Grilla: ${filasMostradas} filas${sinTonoFiltro ? " · solo vacíos" : ""}`}
              />
            </div>

            {resumen.por_etiqueta.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-rimec-azul/80">
                  Etiquetas canónicas (tono_canon)
                </h3>
                <div className="overflow-x-auto rounded-lg border border-rimec-azul/10">
                  <table className="min-w-full text-sm">
                    <thead className="bg-rimec-celeste-bg/30 text-xs uppercase text-rimec-azul-dark">
                      <tr>
                        <th className="px-3 py-2 text-left">Etiqueta filtro</th>
                        <th className="px-3 py-2 text-right">Colores</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumen.por_etiqueta.map((e) => (
                        <tr
                          key={e.etiqueta}
                          className="cursor-pointer border-t border-neutral-100 hover:bg-rimec-celeste-bg/30"
                          onClick={() => onFilterEtiqueta?.(e.etiqueta)}
                        >
                          <td className="px-3 py-2 font-medium">{e.etiqueta}</td>
                          <td className="px-3 py-2 text-right font-mono">{fmt(e.count)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </details>
  );
}

function Kpi({
  label,
  value,
  hint,
  highlight,
  onClick,
}: {
  label: string;
  value: number;
  hint?: string;
  highlight?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`rounded-lg border px-4 py-3 text-left ${
        highlight ? "border-rimec-azul bg-rimec-celeste-bg/40" : "border-neutral-200 bg-white"
      } ${onClick ? "cursor-pointer hover:border-rimec-azul/50" : ""}`}
    >
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 font-serif text-2xl font-semibold text-rimec-azul-dark">{fmt(value)}</p>
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
    </button>
  );
}
