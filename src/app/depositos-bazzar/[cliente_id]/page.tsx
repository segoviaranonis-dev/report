"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import { DepositoFiltrosHeader } from "./components/DepositoFiltrosHeader";
import { DepositoTabs } from "./components/DepositoTabs";
import { TabAnalisis } from "./components/TabAnalisis";
import { TabOperativa } from "./components/TabOperativa";
import { TabFiltrosIndice } from "./components/TabFiltrosIndice";
import { VitalesStockDeposito } from "./components/VitalesStockDeposito";
import { ProductHeroFrame } from "@/components/product/ProductHeroFrame";
import { ProductThumbFrame } from "@/components/product/ProductThumbFrame";
import {
  productImageCandidatesForRow,
  productImageHeroCandidates,
} from "@/lib/retail/product-image";
import {
  EMPTY_DEPOSITO_FILTERS,
  applyDepositoFilters,
  type DepositoFilterState,
} from "@/lib/depositos/deposito-filters";
import {
  CATEGORIA_DEPOSITO_META,
  parseCategoriaDeposito,
  type CategoriaDeposito,
} from "@/lib/depositos/depositos-config";

type DepositoResponse = {
  configured: boolean;
  cliente_id: number;
  ente: string;
  tipo: string;
  productos: DepositoRow[];
  total: number;
  error?: string;
};

export default function DepositoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const cliente_id = params.cliente_id as string;

  const [activeTab, setActiveTab] = useState<
    "analisis" | "operativa" | "filtros-indice" | "articulos"
  >("operativa");
  const [imagenExpandida, setImagenExpandida] = useState<{
    nombre: string;
    linea: string;
    ref: string;
    material: string;
    color: string;
  } | null>(null);
  const [productos, setProductos] = useState<DepositoRow[]>([]);
  const [limitePorMarca, setLimitePorMarca] = useState<30 | 50 | 100 | 'all'>(30);
  const [filtros, setFiltros] = useState<DepositoFilterState>(EMPTY_DEPOSITO_FILTERS);
  const [filtrosData, setFiltrosData] = useState<{
    generos: Array<{ id: number; label: string }>;
    marcas: Array<{ id: number; label: string }>;
    estilos: Array<{ id: number; label: string }>;
    tipoV2: Array<{ id: number; label: string }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ente, setEnte] = useState("");
  const [tipo, setTipo] = useState("");
  const [preview, setPreview] = useState<{
    total_registros: number;
    total_pares: number;
    por_tipo_v2: Array<{ tipo_v2_id: number; tipo: string; registros: string; pares: string }>;
  } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [categoria, setCategoria] = useState<CategoriaDeposito>("tienda");
  const [operativaStats, setOperativaStats] = useState<{ productos: number; pares: number } | null>(
    null,
  );
  const [indiceStats, setIndiceStats] = useState<{ productos: number; pares: number } | null>(null);

  const meta = CATEGORIA_DEPOSITO_META[categoria];
  const esTienda = categoria === "tienda";
  const catQuery = categoria === "tienda" ? "" : `&categoria=${categoria}`;
  const backHref = categoria === "tienda" ? "/depositos-bazzar" : `/depositos-bazzar?categoria=${categoria}`;

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setCategoria(parseCategoriaDeposito(sp.get("categoria")));
    const tab = sp.get("tab");
    if (
      tab === "analisis" ||
      tab === "operativa" ||
      tab === "filtros-indice" ||
      tab === "articulos"
    ) {
      setActiveTab(tab);
    }
  }, []);

  const handleTabChange = (id: string) => {
    const tab = id as "analisis" | "operativa" | "filtros-indice" | "articulos";
    setActiveTab(tab);
    const sp = new URLSearchParams(window.location.search);
    sp.set("tab", tab);
    router.replace(`?${sp.toString()}`, { scroll: false });
  };

  useEffect(() => {
    const loadProductos = async () => {
      try {
        const res = await fetch(`/api/depositos/${cliente_id}?limit=${limitePorMarca}${catQuery}`);
        const data: DepositoResponse = await res.json();

        if (!data.configured) {
          setError("Base de datos no configurada");
          return;
        }

        if (data.error) {
          setError(data.error);
          return;
        }

        setProductos(data.productos);
        setEnte(data.ente);
        setTipo(data.tipo);
        setError(null);

        // Cargar filtros si hay productos
        if (data.productos.length > 0) {
          const filtrosRes = await fetch(`/api/depositos/${cliente_id}/filtros${catQuery.replace("&", "?")}`);
          const filtrosData = await filtrosRes.json();
          if (filtrosData.configured && !filtrosData.error) {
            setFiltrosData(filtrosData);
          }
        } else if (esTienda) {
          // Si no hay productos en tienda, cargar preview sync
          const previewRes = await fetch(`/api/depositos/preview/${cliente_id}`);
          const previewData = await previewRes.json();
          if (previewData.preview) {
            setPreview(previewData.preview);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar productos");
      } finally {
        setLoading(false);
      }
    };

    loadProductos();
  }, [cliente_id, limitePorMarca, catQuery, esTienda]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/depositos/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cliente_id: parseInt(cliente_id) }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Error al sincronizar");
      }

      // Recargar página
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 text-xl font-semibold text-gray-700">
            Cargando depósito...
          </div>
          <div className="h-2 w-64 overflow-hidden rounded-full bg-gray-200">
            <div className="h-full w-3/5 animate-pulse bg-bazzar-naranja" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-8 text-center">
          <div className="mb-4 text-4xl">❌</div>
          <div className="mb-2 text-xl font-bold text-red-800">Error</div>
          <div className="text-red-700">{error}</div>
          <button
            onClick={() => router.push(backHref)}
            className="mt-4 rounded-xl bg-red-600 px-6 py-2 text-white hover:bg-red-700"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  // Si no hay productos, mostrar estado vacío con preview
  if (productos.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow">
          <div className="mx-auto max-w-6xl px-4 py-4">
            <button
              onClick={() => router.push(backHref)}
              className="mb-2 text-sm font-semibold text-bazzar-naranja hover:text-bazzar-naranja-dark"
            >
              ← Volver a Depósitos
            </button>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-2xl">
                🏪
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">
                  Depósito {ente} · {tipo} · {meta.label}
                </h1>
                <p className="text-sm text-gray-600">Cliente ID: {cliente_id}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Estado Vacío con Preview */}
        <div className="mx-auto max-w-4xl px-4 py-12">
          <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
            <div className="mb-6 text-6xl">📦</div>
            <h2 className="mb-4 text-2xl font-bold text-gray-800">
              Depósito Vacío
            </h2>
            <p className="mb-8 text-gray-600">
              {esTienda
                ? "Este depósito aún no tiene stock sincronizado."
                : `Depósito ${meta.label} vacío · ETL pendiente.`}
            </p>

            {preview && esTienda && (
              <div className="mb-8 rounded-xl bg-bazzar-naranja/10 p-6">
                <h3 className="mb-4 text-lg font-semibold text-bazzar-text-dark">
                  📊 Disponible para Sincronizar:
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg bg-white p-4">
                    <div className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                      Total Registros
                    </div>
                    <div className="text-3xl font-bold text-bazzar-naranja">
                      {preview.total_registros.toLocaleString("es-PY")}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white p-4">
                    <div className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                      Total Pares
                    </div>
                    <div className="text-3xl font-bold text-semantic-success">
                      {Math.round(preview.total_pares).toLocaleString("es-PY")}
                    </div>
                  </div>
                </div>

                {preview.por_tipo_v2.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="text-sm font-semibold text-gray-700">Por tipo de producto:</div>
                    {preview.por_tipo_v2.map((t: any, i: number) => (
                      <div key={i} className="flex items-center justify-between rounded-lg bg-white px-4 py-2 text-sm">
                        <span className="font-medium text-gray-700">{t.tipo}</span>
                        <div className="flex gap-4">
                          <span className="text-gray-600">
                            {parseInt(t.registros).toLocaleString("es-PY")} registros
                          </span>
                          <span className="font-semibold text-bazzar-naranja">
                            {Math.round(parseFloat(t.pares)).toLocaleString("es-PY")} pares
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {esTienda && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className={`rounded-xl px-8 py-4 text-lg font-bold text-white transition-all ${
                syncing
                  ? "cursor-not-allowed bg-gray-400"
                  : "bg-gradient-to-r from-bazzar-naranja to-bazzar-naranja-dark hover:from-bazzar-naranja-dark hover:to-bazzar-naranja-dark"
              }`}
            >
              {syncing ? "Sincronizando..." : "⚡ Sincronizar Ahora"}
            </button>
            )}

            {esTienda ? (
            <p className="mt-4 text-sm text-gray-500">
              Se cargarán los registros desde registro_st_vt_rc_reposicion
            </p>
            ) : (
            <p className="mt-4 text-sm text-gray-500">
              Vista consulta · sync solo en depósito TIENDA
            </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const productosFiltrados = applyDepositoFilters(productos, filtros);
  const totalPares = productosFiltrados.reduce((sum, p) => sum + p.cantidad, 0);

  // Agrupar por linea + ref + material + color
  const productosAgrupados = productosFiltrados.reduce((acc, p) => {
    const key = `${p.linea_codigo_proveedor}-${p.referencia_codigo_proveedor}-${p.material_code}-${p.color_code}`;
    if (!acc[key]) {
      acc[key] = { ...p, gradas: [p.grada], cantidad_total: p.cantidad };
    } else {
      acc[key].gradas.push(p.grada);
      acc[key].cantidad_total += p.cantidad;
    }
    return acc;
  }, {} as Record<string, DepositoRow & { gradas: string[]; cantidad_total: number }>);

  const productosArray = Object.values(productosAgrupados);

  // Agrupar por marca para acordeones
  const productosPorMarca = productosArray.reduce((acc, p) => {
    const marca = p.marca || "(sin marca)";
    if (!acc[marca]) {
      acc[marca] = [];
    }
    acc[marca].push(p);
    return acc;
  }, {} as Record<string, typeof productosArray>);

  // Ordenar marcas por total de pares (descendente)
  const marcasOrdenadas = Object.entries(productosPorMarca)
    .map(([marca, productos]) => ({
      marca,
      productos: productos.sort((a, b) => b.cantidad_total - a.cantidad_total),
      totalPares: productos.reduce((sum, p) => sum + p.cantidad_total, 0),
    }))
    .sort((a, b) => b.totalPares - a.totalPares);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header con botón volver */}
      <div className="bg-white shadow">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <button
            onClick={() => router.push(backHref)}
            className="mb-2 text-sm font-semibold text-bazzar-naranja hover:text-bazzar-naranja-dark"
          >
            ← Volver a Depósitos
          </button>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-bazzar-naranja/15 text-2xl">
              🏪
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Depósito {ente} · {tipo} · {meta.label}
              </h1>
              <p className="text-sm text-gray-600">Cliente ID: {cliente_id}</p>
              {activeTab === "operativa" && operativaStats && (
                <div className="mt-3 max-w-xl">
                  <VitalesStockDeposito
                    productos={operativaStats.productos}
                    pares={operativaStats.pares}
                    variant="hero"
                  />
                </div>
              )}
              {activeTab === "filtros-indice" && indiceStats && (
                <div className="mt-3 max-w-xl">
                  <VitalesStockDeposito
                    productos={indiceStats.productos}
                    pares={indiceStats.pares}
                    variant="hero"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <DepositoTabs
        tabs={[
          { id: "analisis", label: "Análisis", icon: "📊" },
          { id: "operativa", label: "Operativa", icon: "👟" },
          { id: "filtros-indice", label: "Filtros por índice", icon: "📑" },
          { id: "articulos", label: "Artículos", icon: "📋" },
        ]}
        activeTab={activeTab}
        onChange={handleTabChange}
      >
        {activeTab === "analisis" && <TabAnalisis cliente_id={cliente_id} categoria={categoria} />}

        {activeTab === "operativa" && (
          <TabOperativa
            cliente_id={cliente_id}
            categoria={categoria}
            onStatsChange={setOperativaStats}
            onExpandImage={(p) =>
              p.imagen_nombre &&
              setImagenExpandida({
                nombre: p.imagen_nombre,
                linea: p.linea_codigo_proveedor,
                ref: p.referencia_codigo_proveedor,
                material: p.material_code,
                color: p.color_code,
              })
            }
          />
        )}

        {activeTab === "filtros-indice" && (
          <TabFiltrosIndice
            cliente_id={cliente_id}
            categoria={categoria}
            onStatsChange={setIndiceStats}
            onExpandImage={(p) =>
              p.imagen_nombre &&
              setImagenExpandida({
                nombre: p.imagen_nombre,
                linea: p.linea_codigo_proveedor,
                ref: p.referencia_codigo_proveedor,
                material: p.material_code,
                color: p.color_code,
              })
            }
          />
        )}

        {activeTab === "articulos" && (
          <>
            {/* Filtros */}
            <div className="pb-6">
              <DepositoFiltrosHeader
                filtros={filtros}
                onChange={setFiltros}
                filtrosData={filtrosData}
                ente={ente}
                tipo={tipo}
                totalProductos={productosArray.length}
                totalPares={Math.round(totalPares)}
              />
            </div>

            {/* Acordeones por marca - TOP N productos */}
            <div className="mx-auto max-w-6xl px-4 pb-12">
              {/* Selector de límite y mensaje informativo */}
              <div className="mb-4 flex flex-col gap-3 rounded-xl bg-bazzar-naranja/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm font-semibold text-bazzar-text-dark">
                  📊 Mostrando {limitePorMarca === 'all' ? 'TODOS los' : `TOP ${limitePorMarca}`} productos por marca · {marcasOrdenadas.length} marcas · {productosArray.length} productos
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-bazzar-naranja-dark">
                    Productos por marca:
                  </label>
                  <select
                    value={limitePorMarca}
                    onChange={(e) => setLimitePorMarca(e.target.value as 30 | 50 | 100 | 'all')}
                    className="rounded-lg border-2 border-bazzar-naranja/40 bg-white px-3 py-1.5 text-sm font-semibold text-bazzar-text-dark transition-all hover:border-bazzar-naranja/70 focus:border-bazzar-naranja focus:outline-none focus:ring-2 focus:ring-bazzar-naranja/20"
                  >
                    <option value="30">TOP 30</option>
                    <option value="50">TOP 50</option>
                    <option value="100">TOP 100</option>
                    <option value="all">TODOS</option>
                  </select>
                </div>
              </div>

              {marcasOrdenadas.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
                  <div className="mb-2 text-4xl">🔍</div>
                  <div className="text-gray-600">No hay productos que coincidan con los filtros</div>
                </div>
              ) : (
                <div className="space-y-4">
                  {marcasOrdenadas.map(({ marca, productos, totalPares: totalMarca }, idx) => (
                    <details
                      key={marca}
                      open={idx === 0}
                      className="group overflow-hidden rounded-2xl border-2 border-gray-200 bg-white shadow transition-all hover:border-bazzar-naranja/40"
                    >
                      <summary className="cursor-pointer bg-gradient-to-r from-gray-50 to-white px-6 py-4 font-bold text-gray-800 hover:from-bazzar-naranja/10 hover:to-white">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-3">
                            <span className="text-2xl">🏷️</span>
                            <span className="text-lg">{marca}</span>
                            <span className="rounded-full bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-700">
                              {productos.length} productos
                            </span>
                          </span>
                          <span className="text-bazzar-naranja">{Math.round(totalMarca)} pares</span>
                        </div>
                      </summary>

                      <div className="overflow-x-auto">
                        <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Imagen
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Línea
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Referencia
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Material
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Color
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Grada
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Estilo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Pares
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {productos.map((p, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-2 py-3">
                        {p.imagen_nombre ? (
                          <ProductThumbFrame
                            alt={`${p.linea_codigo_proveedor}-${p.referencia_codigo_proveedor}`}
                            candidates={productImageCandidatesForRow(
                              p.linea_codigo_proveedor,
                              p.referencia_codigo_proveedor,
                              p.material_code,
                              p.color_code,
                              p.imagen_nombre,
                              "thumb",
                            )}
                            size={56}
                            onClick={() =>
                              setImagenExpandida({
                                nombre: p.imagen_nombre!,
                                linea: p.linea_codigo_proveedor,
                                ref: p.referencia_codigo_proveedor,
                                material: p.material_code,
                                color: p.color_code,
                              })
                            }
                          />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gray-100 text-gray-400 ring-1 ring-gray-200">
                            <span className="text-lg">📷</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {p.linea_codigo_proveedor}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {p.referencia_codigo_proveedor}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {p.material_code}
                        {p.descp_material && (
                          <div className="text-xs text-gray-500">{p.descp_material}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {p.color_code}
                        {p.descp_color && (
                          <div className="text-xs text-gray-500">{p.descp_color}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {p.gradas.join(", ")}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{p.estilo}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            p.tipo_v2_id === 1
                              ? "bg-bazzar-naranja/15 text-bazzar-text-dark"
                              : "bg-semantic-success/15 text-semantic-success"
                          }`}
                        >
                          {p.tipo_v2}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                        {Math.round(p.cantidad_total)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
    </div>
  )}
</div>
          </>
        )}
      </DepositoTabs>

      {/* Modal de imagen expandida */}
      {imagenExpandida && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setImagenExpandida(null)}
        >
          <div
            className="relative flex max-h-[90vh] max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Botón cerrar */}
            <button
              type="button"
              onClick={() => setImagenExpandida(null)}
              className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition-all hover:bg-red-600"
              aria-label="Cerrar"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Título */}
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="text-base font-semibold text-gray-800">
                {imagenExpandida.linea}-{imagenExpandida.ref}
              </h3>
            </div>

            {/* Imagen completa - contenedor que se adapta */}
            <div className="relative flex-1 overflow-auto bg-gray-50 p-6">
              <ProductHeroFrame
                alt={`${imagenExpandida.linea}-${imagenExpandida.ref}`}
                candidates={productImageHeroCandidates(
                  imagenExpandida.linea,
                  imagenExpandida.ref,
                  imagenExpandida.material,
                  imagenExpandida.color,
                  imagenExpandida.nombre,
                )}
              />
            </div>

            {/* Hint de cierre */}
            <div className="border-t border-gray-200 px-6 py-3 text-center text-xs text-gray-500">
              Haz clic fuera de la imagen para cerrar
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
