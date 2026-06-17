"use client";

import { useEffect, useState } from "react";
import type {
  AnalisisResponse,
  AnalisisNodo,
} from "@/app/api/depositos/[cliente_id]/analisis/route";
import { AnalisisExpandible } from "./AnalisisExpandible";

import type { CategoriaDeposito } from "@/lib/depositos/depositos-config";

type Props = {
  cliente_id: string;
  categoria?: CategoriaDeposito;
};

export function TabAnalisis({ cliente_id, categoria = "tienda" }: Props) {
  const [data, setData] = useState<AnalisisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [soloConSaldo, setSoloConSaldo] = useState(true);
  const [expandirTodo, setExpandirTodo] = useState(false);

  useEffect(() => {
    const loadAnalisis = async () => {
      try {
        const catQ = categoria === "tienda" ? "" : `?categoria=${categoria}`;
        const res = await fetch(`/api/depositos/${cliente_id}/analisis${catQ}`);
        const result: AnalisisResponse = await res.json();

        if (!result.configured) {
          setError("Base de datos no configurada");
          return;
        }

        if (result.error) {
          setError(result.error);
          return;
        }

        setData(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar análisis");
      } finally {
        setLoading(false);
      }
    };

    loadAnalisis();
  }, [cliente_id, categoria]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-xl font-semibold text-gray-700">
            Cargando análisis...
          </div>
          <div className="h-2 w-64 overflow-hidden rounded-full bg-gray-200">
            <div className="h-full w-3/5 animate-pulse bg-bazzar-naranja" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-4xl px-4">
        <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-8 text-center">
          <div className="mb-4 text-4xl">❌</div>
          <div className="mb-2 text-xl font-bold text-red-800">Error</div>
          <div className="text-red-700">{error || "Error desconocido"}</div>
        </div>
      </div>
    );
  }

  const { resumen, resumen_operativo, analisis_por_estilo, analisis_por_marca } = data;

  // Filtrar árboles si solo con saldo
  const resumenOperativoFiltrado = soloConSaldo
    ? resumen_operativo
        .map((nodo) => filtrarNodoConSaldo(nodo))
        .filter((n): n is AnalisisNodo => n !== null)
    : resumen_operativo;

  const analisisEstiloFiltrado = soloConSaldo
    ? analisis_por_estilo
        .map((nodo) => filtrarNodoConSaldo(nodo))
        .filter((n): n is AnalisisNodo => n !== null)
    : analisis_por_estilo;

  const analisisMarcaFiltrado = soloConSaldo
    ? analisis_por_marca
        .map((nodo) => filtrarNodoConSaldo(nodo))
        .filter((n): n is AnalisisNodo => n !== null)
    : analisis_por_marca;

  return (
    <div className="mx-auto max-w-6xl px-4">
      {/* Filtros y acciones */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            <input
              type="checkbox"
              checked={soloConSaldo}
              onChange={(e) => setSoloConSaldo(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-bazzar-naranja focus:ring-bazzar-naranja"
            />
            Solo con saldo &gt; 0
          </label>

          {!soloConSaldo && (resumenOperativoFiltrado.length > 0 || analisisEstiloFiltrado.length > 0 || analisisMarcaFiltrado.length > 0) && (
            <button
              type="button"
              onClick={() => setExpandirTodo(!expandirTodo)}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              {expandirTodo ? "Colapsar todo" : "Expandir todo"}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setSoloConSaldo(true)}
          className="text-xs font-semibold text-bazzar-naranja hover:underline"
        >
          Limpiar filtros
        </button>
      </div>

      {/* Cards de métricas */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {/* INICIAL */}
        <div className="rounded-2xl border border-bazzar-naranja/25 bg-gradient-to-br from-bazzar-naranja/10 to-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-bazzar-naranja">
            Inicial
          </div>
          <div className="mt-2 text-3xl font-bold text-bazzar-text-dark">
            {resumen.inicial.toLocaleString("es-PY")}
          </div>
          <div className="mt-1 text-xs text-bazzar-naranja">pares</div>
        </div>

        {/* VENDIDO */}
        <div className="rounded-2xl border border-semantic-success/20 bg-gradient-to-br from-semantic-success/10 to-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-semantic-success">
            Vendido
          </div>
          <div className="mt-2 text-3xl font-bold text-semantic-success">
            {resumen.vendido.toLocaleString("es-PY")}
          </div>
          <div className="mt-1 text-xs text-semantic-success">pares</div>
        </div>

        {/* SALDO */}
        <div className="rounded-2xl border border-bazzar-naranja/25 bg-gradient-to-br from-bazzar-naranja/10 to-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-bazzar-naranja-dark">
            Saldo
          </div>
          <div className="mt-2 text-3xl font-bold text-bazzar-text-dark">
            {resumen.saldo.toLocaleString("es-PY")}
          </div>
          <div className="mt-1 text-xs text-bazzar-naranja-dark">pares</div>
        </div>

        {/* % VENDIDO */}
        <div className="rounded-2xl border border-bazzar-naranja/25 bg-gradient-to-br from-bazzar-naranja/10 to-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-bazzar-naranja">
            % Vendido
          </div>
          <div className="mt-2 text-3xl font-bold text-bazzar-text-dark">
            {resumen.pct_vendido}%
          </div>
          <div className="mt-1 text-xs text-bazzar-naranja">rotación</div>
        </div>

        {/* SKUS */}
        <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-600">
            SKUs
          </div>
          <div className="mt-2 text-3xl font-bold text-gray-900">
            {resumen.total_skus.toLocaleString("es-PY")}
          </div>
          <div className="mt-1 text-xs text-gray-600">productos</div>
        </div>

        {/* MARCAS */}
        <div className="rounded-2xl border border-bazzar-naranja/25 bg-gradient-to-br from-bazzar-naranja/10 to-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-bazzar-naranja">
            Marcas
          </div>
          <div className="mt-2 text-3xl font-bold text-bazzar-text-dark">
            {resumen.total_marcas}
          </div>
          <div className="mt-1 text-xs text-bazzar-naranja">lo pp</div>
        </div>
      </div>

      {/* Nota explicativa */}
      <div className="mb-6 rounded-xl border border-bazzar-naranja/25 bg-bazzar-naranja/10 p-4 text-sm text-bazzar-text-dark">
        <div className="font-semibold">💡 Estructura de análisis:</div>
        <div className="mt-2 text-xs">
          Marque files con checkbox para armar reporte Estilo Sales Report — estructura de análisis.
        </div>
      </div>

      {/* 3 ACORDEONES CON DIFERENTES AGRUPACIONES */}
      <div className="space-y-6">
        {/* ACORDEÓN 1: Resumen operativo (Ente → Género → Marca → SKU) */}
        <details open className="group rounded-2xl border-2 border-bazzar-naranja/40 bg-white">
          <summary className="cursor-pointer rounded-xl bg-gradient-to-r from-bazzar-naranja/10 to-bazzar-naranja/20 px-6 py-4 font-bold text-bazzar-text-dark hover:from-bazzar-naranja/20 hover:to-bazzar-naranja/25">
            <span className="text-lg">1. Resumen operativo (Ente → Género → Marca → SKU)</span>
          </summary>
          <div className="space-y-3 p-4">
            {resumenOperativoFiltrado.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                <div className="mb-2 text-3xl">🔍</div>
                <div className="text-gray-600">No hay datos para mostrar</div>
              </div>
            ) : (
              resumenOperativoFiltrado.map((nodo: AnalisisNodo) => (
                <AnalisisExpandible key={nodo.key} nodo={nodo} />
              ))
            )}
          </div>
        </details>

        {/* ACORDEÓN 2: Análisis por Estilo */}
        <details className="group rounded-2xl border-2 border-bazzar-naranja/40 bg-white">
          <summary className="cursor-pointer rounded-xl bg-gradient-to-r from-bazzar-naranja/10 to-bazzar-naranja/20 px-6 py-4 font-bold text-bazzar-text-dark hover:from-bazzar-naranja/20 hover:to-bazzar-naranja/25">
            <span className="text-lg">2. Análisis por Ente → Estilo → Marca → SKU</span>
          </summary>
          <div className="space-y-3 p-4">
            {analisisEstiloFiltrado.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                <div className="mb-2 text-3xl">🔍</div>
                <div className="text-gray-600">No hay datos para mostrar</div>
              </div>
            ) : (
              analisisEstiloFiltrado.map((nodo: AnalisisNodo) => (
                <AnalisisExpandible key={nodo.key} nodo={nodo} />
              ))
            )}
          </div>
        </details>

        {/* ACORDEÓN 3: Análisis por Marca */}
        <details className="group rounded-2xl border-2 border-semantic-success/30 bg-white">
          <summary className="cursor-pointer rounded-xl bg-gradient-to-r from-semantic-success/10 to-semantic-success/15 px-6 py-4 font-bold text-semantic-success hover:from-semantic-success/15 hover:to-semantic-success/20">
            <span className="text-lg">3. Análisis por Ente → Marca → Estilo → SKU</span>
          </summary>
          <div className="space-y-3 p-4">
            {analisisMarcaFiltrado.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                <div className="mb-2 text-3xl">🔍</div>
                <div className="text-gray-600">No hay datos para mostrar</div>
              </div>
            ) : (
              analisisMarcaFiltrado.map((nodo: AnalisisNodo) => (
                <AnalisisExpandible key={nodo.key} nodo={nodo} />
              ))
            )}
          </div>
        </details>
      </div>

      {/* Botones de acción */}
      <div className="mt-8 flex justify-center gap-4">
        <button
          type="button"
          className="rounded-xl border-2 border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 hover:bg-gray-50"
        >
          Expandir todo
        </button>
        <button
          type="button"
          className="rounded-xl border-2 border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 hover:bg-gray-50"
        >
          Colapsar todo
        </button>
      </div>
    </div>
  );
}

// Helper: Filtrar nodo y sus hijos recursivamente
function filtrarNodoConSaldo(nodo: AnalisisNodo): AnalisisNodo | null {
  if (nodo.saldo <= 0) return null;

  const hijosFiltrados = nodo.hijos
    ?.map((h) => filtrarNodoConSaldo(h))
    .filter((h): h is AnalisisNodo => h !== null);

  return {
    ...nodo,
    hijos: hijosFiltrados,
  };
}
