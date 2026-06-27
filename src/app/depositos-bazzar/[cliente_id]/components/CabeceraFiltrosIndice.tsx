"use client";

import type { CasoBibliotecaRow } from "@/lib/motor-precios/biblioteca-editor";
import type { BibliotecaRow } from "@/lib/motor-precios/queries";
import { formatIndiceGs, type CasoIndiceStats } from "@/lib/depositos/filtros-indice";

type Props = {
  bibliotecas: BibliotecaRow[];
  bibliotecaId: number | null;
  canonica: BibliotecaRow | null;
  casos: CasoBibliotecaRow[];
  casoStats: CasoIndiceStats[];
  casoActivoId: number | null;
  onBibliotecaChange: (id: number) => void;
  onCasoSelect: (casoId: number | null) => void;
  totalProductos: number;
  totalPares: number;
  loadingBiblioteca: boolean;
};

export function CabeceraFiltrosIndice({
  bibliotecas,
  bibliotecaId,
  canonica,
  casos,
  casoStats,
  casoActivoId,
  onBibliotecaChange,
  onCasoSelect,
  totalProductos,
  totalPares,
  loadingBiblioteca,
}: Props) {
  const statsMap = new Map(casoStats.map((s) => [s.caso_id, s]));
  const bibActiva = bibliotecas.find((b) => b.id === bibliotecaId);

  return (
    <div className="mx-auto max-w-7xl px-4">
      <details open className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <summary className="cursor-pointer list-none px-4 py-3 [&::-webkit-details-marker]:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-bazzar-naranja">
                Filtros por índice
              </p>
              <p className="text-sm font-semibold text-gray-800">
                Motor Precios · casos comerciales → stock depósito
              </p>
            </div>
            <div className="text-right text-sm text-gray-600">
              <span className="font-semibold text-bazzar-naranja">
                {totalProductos.toLocaleString("es-PY")} productos
              </span>
              {" · "}
              <span className="font-semibold text-gray-800">
                {Math.round(totalPares).toLocaleString("es-PY")} pares
              </span>
            </div>
          </div>
        </summary>

        <div className="space-y-4 border-t border-gray-100 px-4 pb-4 pt-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Biblioteca
            </label>
            <select
              value={bibliotecaId ?? ""}
              onChange={(e) => onBibliotecaChange(Number(e.target.value))}
              className="max-w-md rounded-lg border-2 border-bazzar-naranja/30 bg-white px-3 py-2 text-sm font-semibold text-gray-800 focus:border-bazzar-naranja focus:outline-none"
            >
              {bibliotecas.map((b) => (
                <option key={b.id} value={b.id}>
                  #{b.id} · {b.nombre} · {b.casos_count} casos · {b.lineas_count} líneas BCL
                  {b.canonica ? " · CANÓNICA" : ""}
                </option>
              ))}
            </select>
          </div>

          {canonica && bibActiva?.canonica && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              Canónica activa: #{canonica.id} · {canonica.nombre} · {canonica.casos_count} casos ·{" "}
              {canonica.lineas_count} líneas en matriz
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onCasoSelect(null)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                casoActivoId == null
                  ? "border-bazzar-naranja bg-bazzar-naranja text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Todos los casos
            </button>
          </div>

          {loadingBiblioteca ? (
            <div className="h-2 overflow-hidden rounded-full bg-gray-200">
              <div className="h-full w-2/5 animate-pulse bg-bazzar-naranja" />
            </div>
          ) : casos.length === 0 ? (
            <p className="text-sm text-gray-500">Esta biblioteca no tiene casos activos.</p>
          ) : (
            <div className="space-y-2">
              {casos.map((caso, idx) => {
                const st = statsMap.get(caso.id);
                const activo = casoActivoId === caso.id;
                return (
                  <details
                    key={caso.id}
                    open={activo || (casoActivoId == null && idx === 0)}
                    className={`overflow-hidden rounded-xl border-2 transition ${
                      activo ? "border-bazzar-naranja bg-bazzar-naranja/5" : "border-gray-200 bg-gray-50/50"
                    }`}
                  >
                    <summary className="cursor-pointer px-4 py-3 font-semibold text-gray-800 hover:bg-white/60">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          📁 {caso.nombre_caso} — {caso.lineas_count} línea(s) · índice{" "}
                          {formatIndiceGs(caso.indice_gs)}
                        </span>
                        <span className="text-xs font-normal text-gray-600">
                          {st
                            ? `${st.lineas_en_stock} líneas c/stock · ${Math.round(st.pares).toLocaleString("es-PY")} p`
                            : "—"}
                        </span>
                      </div>
                    </summary>
                    <div className="border-t border-gray-200 bg-white px-4 py-3">
                      <p className="mb-2 text-xs text-gray-500">
                        Dólar {caso.dolar_politica.toLocaleString("es-PY")} · Factor {caso.factor_conversion} ·{" "}
                        {caso.lineas_count} líneas asignadas en biblioteca
                      </p>
                      <button
                        type="button"
                        onClick={() => onCasoSelect(activo ? null : caso.id)}
                        className={`rounded-lg px-4 py-2 text-sm font-bold text-white transition ${
                          activo
                            ? "bg-gray-600 hover:bg-gray-700"
                            : "bg-bazzar-naranja hover:bg-bazzar-naranja-dark"
                        }`}
                      >
                        {activo ? "Quitar filtro" : "Filtrar stock por este caso"}
                      </button>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
