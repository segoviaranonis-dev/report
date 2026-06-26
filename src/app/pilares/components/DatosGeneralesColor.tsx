"use client";

import type { ColoresResumen } from "@/lib/pilares/types";
import type { ColorAdminFilters } from "./ColorAdminClient";

const fmt = (n: number) => n.toLocaleString("es-PY");

export type ColorAdminFilterKey = "sinNombre" | "conNombre" | "sinTono" | "conTono";

interface Props {
  resumen: ColoresResumen | null;
  totalFiltrado: number;
  filasMostradas: number;
  filters: ColorAdminFilters;
  loading: boolean;
  onToggleFilter: (key: ColorAdminFilterKey) => void;
  onToggleEtiqueta: (etiqueta: string) => void;
}

function filterHint(filters: ColorAdminFilters): string {
  const parts: string[] = [];
  if (filters.sinNombre) parts.push("sin desc.");
  if (filters.conNombre) parts.push("con desc.");
  if (filters.sinTono) parts.push("sin tono");
  if (filters.conTono) parts.push("con tono");
  if (filters.etiquetas.length) parts.push(`etiq. ${filters.etiquetas.join(" + ")}`);
  return parts.length ? parts.join(" · ") : "sin filtro";
}

function isEtiquetaActive(filters: ColorAdminFilters, etiqueta: string): boolean {
  return filters.etiquetas.some((e) => e.toLowerCase() === etiqueta.toLowerCase());
}

export function DatosGeneralesColor({
  resumen,
  totalFiltrado,
  filasMostradas,
  filters,
  loading,
  onToggleFilter,
  onToggleEtiqueta,
}: Props) {
  const hayFiltro = filterHint(filters) !== "sin filtro";

  return (
    <details open className="mb-6 rounded-xl border-2 border-rimec-azul/25 bg-card-bg shadow-sm">
      <summary className="cursor-pointer list-none px-5 py-4 marker:content-none">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-serif text-lg font-semibold text-rimec-azul-dark">Datos generales · color</span>
          {resumen && !loading && (
            <span className="text-sm text-neutral-600">
              {fmt(resumen.total)} colores · <strong>{fmt(resumen.sin_nombre)}</strong> sin descripción ·{" "}
              <strong>{fmt(resumen.sin_tono)}</strong> sin tono_canon
            </span>
          )}
        </div>
      </summary>

      <div className="space-y-4 border-t border-rimec-azul/10 px-5 pb-5 pt-4">
        <p className="text-xs text-neutral-500">
          Clic en KPI o etiquetas = multiselect combinable (ej. sin descripción + sin tono · Blanco + Negro).
        </p>

        {loading && <p className="text-sm text-neutral-500">Calculando…</p>}
        {!loading && resumen && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Kpi label="Total BD" value={resumen.total} />
              <Kpi
                label="Con descripción"
                value={resumen.con_nombre}
                hint="Multiselect · combinable"
                active={filters.conNombre}
                onClick={() => onToggleFilter("conNombre")}
              />
              <Kpi
                label="Sin descripción"
                value={resumen.sin_nombre}
                hint="Multiselect · combinable"
                active={filters.sinNombre}
                onClick={() => onToggleFilter("sinNombre")}
              />
              <Kpi
                label="Con tono_canon"
                value={resumen.con_tono}
                hint="Etiqueta filtro ES"
                highlight
                active={filters.conTono}
                onClick={() => onToggleFilter("conTono")}
              />
              <Kpi
                label="Sin tono_canon"
                value={resumen.sin_tono}
                hint="Multiselect · combinable"
                active={filters.sinTono}
                onClick={() => onToggleFilter("sinTono")}
              />
            </div>

            <Kpi
              label="Vista filtrada"
              value={hayFiltro ? totalFiltrado : resumen.total}
              hint={
                hayFiltro
                  ? `Grilla: ${filasMostradas} filas · ${filterHint(filters)}`
                  : `Sin filtros · grilla muestra hasta ${filasMostradas} filas`
              }
              active={hayFiltro}
            />

            {filters.etiquetas.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {filters.etiquetas.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => onToggleEtiqueta(e)}
                    className="inline-flex items-center gap-1 rounded-full border border-rimec-azul bg-rimec-celeste-bg px-3 py-1 text-xs font-semibold text-rimec-azul-dark"
                  >
                    {e}
                    <span className="text-rimec-azul/60">×</span>
                  </button>
                ))}
              </div>
            )}

            {resumen.por_etiqueta.length > 0 && (
              <details className="rounded-xl border border-rimec-azul/15 bg-white/60">
                <summary className="cursor-pointer list-none px-4 py-3 marker:content-none">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-rimec-azul/80">
                      Etiquetas canónicas (tono_canon) · multiselect
                    </span>
                    <span className="text-xs text-neutral-500">
                      {filters.etiquetas.length
                        ? `${filters.etiquetas.length} seleccionada(s)`
                        : "Clic filas para agrupar"}
                    </span>
                  </div>
                </summary>
                <div className="border-t border-rimec-azul/10 px-2 pb-2 pt-1">
                  <div className="overflow-x-auto rounded-lg">
                    <table className="min-w-full text-sm">
                      <thead className="bg-rimec-celeste-bg/30 text-xs uppercase text-rimec-azul-dark">
                        <tr>
                          <th className="px-3 py-2 text-left">Etiqueta filtro</th>
                          <th className="px-3 py-2 text-right">Colores</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resumen.por_etiqueta.map((e) => {
                          const active = isEtiquetaActive(filters, e.etiqueta);
                          return (
                            <tr
                              key={e.etiqueta}
                              role="button"
                              tabIndex={0}
                              onClick={() => onToggleEtiqueta(e.etiqueta)}
                              onKeyDown={(ev) => {
                                if (ev.key === "Enter" || ev.key === " ") {
                                  ev.preventDefault();
                                  onToggleEtiqueta(e.etiqueta);
                                }
                              }}
                              className={`cursor-pointer border-t border-neutral-100 transition ${
                                active
                                  ? "bg-rimec-celeste-bg ring-1 ring-inset ring-rimec-azul/40"
                                  : "hover:bg-rimec-celeste-bg/30"
                              }`}
                            >
                              <td className="px-3 py-2 font-medium">
                                {e.etiqueta}
                                {active ? (
                                  <span className="ml-2 text-[10px] font-bold uppercase text-rimec-azul">
                                    activo
                                  </span>
                                ) : null}
                              </td>
                              <td className="px-3 py-2 text-right font-mono">{fmt(e.count)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </details>
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
  active,
  onClick,
}: {
  label: string;
  value: number;
  hint?: string;
  highlight?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`rounded-lg border px-4 py-3 text-left transition ${
        active
          ? "border-rimec-azul bg-rimec-celeste-bg ring-2 ring-rimec-azul/30"
          : highlight
            ? "border-rimec-azul bg-rimec-celeste-bg/40"
            : "border-neutral-200 bg-white"
      } ${onClick ? "cursor-pointer hover:border-rimec-azul/50" : ""}`}
    >
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 font-serif text-2xl font-semibold text-rimec-azul-dark">{fmt(value)}</p>
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
      {active && <p className="mt-1 text-[10px] font-bold uppercase text-rimec-azul">Filtro activo</p>}
    </button>
  );
}
