"use client";

import type { LineasResumen, PilaresMaestras } from "@/lib/pilares/types";

const fmt = (n: number) => n.toLocaleString("es-PY");

interface DatosGeneralesLineasProps {
  resumen: LineasResumen | null;
  maestras?: PilaresMaestras;
  /** Total con filtros activos (COUNT en BD, misma query que la grilla). */
  totalFiltrado: number;
  /** Filas renderizadas (limit paginación). */
  filasMostradas: number;
  filtroMarca: string;
  filtroGenero: string;
  loading: boolean;
  onSelectMarca?: (marca: string) => void;
}

export function DatosGeneralesLineas({
  resumen,
  maestras,
  totalFiltrado,
  filasMostradas,
  filtroMarca,
  filtroGenero,
  loading,
  onSelectMarca,
}: DatosGeneralesLineasProps) {
  const hayFiltro = Boolean(filtroMarca || filtroGenero);
  const sumaMarcas = resumen?.por_marca.reduce((a, m) => a + m.lineas, 0) ?? 0;
  const sumaGeneros = resumen?.por_genero.reduce((a, g) => a + g.lineas, 0) ?? 0;
  const cuadraMarcas = resumen ? sumaMarcas === resumen.total : true;
  const cuadraGeneros = resumen ? sumaGeneros === resumen.total : true;

  const lineasPorMarca = new Map(
    resumen?.por_marca.filter((m) => m.marca !== "— Sin marca —").map((m) => [m.marca, m.lineas]) ?? [],
  );

  const catalogoMarcas =
    maestras?.marcas
      .map((m) => ({
        id: m.id,
        label: m.label,
        lineas: lineasPorMarca.get(m.label) ?? 0,
      }))
      .sort((a, b) => b.lineas - a.lineas || a.label.localeCompare(b.label, "es")) ?? [];

  const generoPorMarcaAgrupado = (() => {
    if (!resumen) return [];
    const map = new Map<string, { genero: string; lineas: number }[]>();
    for (const row of resumen.genero_por_marca) {
      const list = map.get(row.marca) ?? [];
      list.push({ genero: row.genero, lineas: row.lineas });
      map.set(row.marca, list);
    }
    return Array.from(map.entries())
      .map(([marca, generos]) => ({
        marca,
        total: generos.reduce((a, g) => a + g.lineas, 0),
        generos: generos.sort((a, b) => b.lineas - a.lineas),
      }))
      .sort((a, b) => b.total - a.total);
  })();

  return (
    <details
      open
      className="mb-6 rounded-xl border-2 border-rimec-azul/25 bg-card-bg shadow-sm"
    >
      <summary className="cursor-pointer list-none px-5 py-4 marker:content-none">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-serif text-lg font-semibold text-rimec-azul-dark">Datos generales</span>
          {resumen && !loading && (
            <span className="text-sm text-neutral-600">
              {fmt(resumen.total)} líneas activas en BD
              {hayFiltro && (
                <>
                  {" "}
                  · filtro: <strong>{fmt(totalFiltrado)}</strong>
                </>
              )}
            </span>
          )}
        </div>
      </summary>

      <div className="space-y-6 border-t border-rimec-azul/10 px-5 pb-5 pt-4">
        {loading && <p className="text-sm text-neutral-500">Calculando contadores…</p>}

        {!loading && resumen && (
          <>
            {/* Vista filtrada vs global */}
            <section>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-rimec-azul/80">
                Contadores de la vista
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Kpi label="Total BD (proveedor)" value={resumen.total} />
                <Kpi
                  label="Con filtro aplicado"
                  value={totalFiltrado}
                  hint={
                    hayFiltro
                      ? `${filtroMarca === "__null__" ? "sin marca" : filtroMarca || "todas marcas"} · ${filtroGenero === "__null__" ? "género vacío" : filtroGenero || "todos géneros"}`
                      : "Sin filtros — coincide con total BD"
                  }
                  highlight={hayFiltro}
                />
                <Kpi label="Filas en grilla (máx. 500)" value={filasMostradas} hint="Paginación visual" />
                <Kpi
                  label="Sin marca / sin género"
                  value={`${fmt(resumen.sin_marca)} / ${fmt(resumen.sin_genero)}`}
                  hint="Pendientes de enriquecer"
                />
              </div>
            </section>

            {/* Totales globales */}
            <section>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-rimec-azul/80">
                Resumen global
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Kpi label="Marcas distintas" value={resumen.marcas_distintas} />
                <Kpi label="Géneros distintos" value={resumen.generos_distintos} />
                <Kpi
                  label="Suma por marca"
                  value={sumaMarcas}
                  hint={cuadraMarcas ? "✓ cuadra con total" : "⚠ no cuadra"}
                  ok={cuadraMarcas}
                />
                <Kpi
                  label="Suma por género"
                  value={sumaGeneros}
                  hint={cuadraGeneros ? "✓ cuadra con total" : "⚠ no cuadra"}
                  ok={cuadraGeneros}
                />
              </div>
            </section>

            {/* Catálogo marca_v2 — origen filtros header */}
            {catalogoMarcas.length > 0 && (
              <section>
                <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-rimec-azul/80">
                  Catálogo marcas registradas (marca_v2)
                </h3>
                <p className="mb-2 text-xs text-neutral-500">
                  Marcas del tipo activo vía <code className="text-[10px]">marca_tipo_v2</code>. Asigná en la grilla →
                  alimenta chips header Tablet/RIMEC.
                </p>
                <ContadorTable
                  headers={["Marca", "Líneas pilares", "Estado"]}
                  rows={catalogoMarcas.map((m) => [
                    m.label,
                    fmt(m.lineas),
                    m.lineas > 0 ? "En pilares" : "Sin asignar",
                  ])}
                  onRowClick={(marca) => onSelectMarca?.(marca)}
                />
              </section>
            )}

            {/* Líneas por marca */}
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-rimec-azul/80">
                Líneas por marca
              </h3>
              <ContadorTable
                headers={["Marca", "Líneas", "%"]}
                rows={resumen.por_marca.map((m) => [
                  m.marca,
                  fmt(m.lineas),
                  resumen.total ? `${((100 * m.lineas) / resumen.total).toFixed(1)}%` : "—",
                ])}
                onRowClick={(marca) => {
                  if (marca.startsWith("—") || !onSelectMarca) return;
                  onSelectMarca(marca);
                }}
              />
            </section>

            {/* Géneros por marca */}
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-rimec-azul/80">
                Géneros por marca
              </h3>
              <div className="space-y-4">
                {generoPorMarcaAgrupado.map((block) => (
                  <div
                    key={block.marca}
                    className="rounded-lg border border-rimec-azul/10 bg-rimec-celeste-bg/20 p-3"
                  >
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                      <button
                        type="button"
                        className="font-semibold text-rimec-azul hover:underline"
                        onClick={() =>
                          !block.marca.startsWith("—") && onSelectMarca?.(block.marca)
                        }
                      >
                        {block.marca}
                      </button>
                      <span className="text-sm text-neutral-600">
                        {fmt(block.total)} líneas · suma géneros {fmt(block.generos.reduce((a, g) => a + g.lineas, 0))}
                        {block.total === block.generos.reduce((a, g) => a + g.lineas, 0) ? " ✓" : " ⚠"}
                      </span>
                    </div>
                    <table className="w-full text-sm">
                      <tbody>
                        {block.generos.map((g) => (
                          <tr key={`${block.marca}-${g.genero}`} className="border-t border-rimec-azul/5">
                            <td className="py-1 pr-4 text-neutral-700">{g.genero}</td>
                            <td className="py-1 text-right font-mono font-semibold">{fmt(g.lineas)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </section>

            {/* Líneas por género (global) */}
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-rimec-azul/80">
                Líneas por género (todas las marcas)
              </h3>
              <ContadorTable
                headers={["Género", "Líneas", "%"]}
                rows={resumen.por_genero.map((g) => [
                  g.genero,
                  fmt(g.lineas),
                  resumen.total ? `${((100 * g.lineas) / resumen.total).toFixed(1)}%` : "—",
                ])}
              />
            </section>
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
  ok,
}: {
  label: string;
  value: number | string;
  hint?: string;
  highlight?: boolean;
  ok?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        highlight ? "border-rimec-azul bg-rimec-celeste-bg/40" : "border-neutral-200 bg-white"
      }`}
    >
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 font-serif text-2xl font-semibold text-rimec-azul-dark">
        {typeof value === "number" ? fmt(value) : value}
      </p>
      {hint && (
        <p className={`mt-1 text-xs ${ok === false ? "text-amber-700" : "text-neutral-500"}`}>{hint}</p>
      )}
    </div>
  );
}

function ContadorTable({
  headers,
  rows,
  onRowClick,
}: {
  headers: string[];
  rows: string[][];
  onRowClick?: (firstCol: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-rimec-azul/10">
      <table className="min-w-full text-sm">
        <thead className="bg-rimec-celeste-bg/30 text-xs uppercase text-rimec-azul-dark">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 text-left last:text-right">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={`border-t border-neutral-100 ${onRowClick ? "cursor-pointer hover:bg-rimec-celeste-bg/30" : ""}`}
              onClick={() => onRowClick?.(row[0])}
            >
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`px-3 py-2 ${j > 0 ? "text-right font-mono" : "font-medium text-neutral-800"}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
