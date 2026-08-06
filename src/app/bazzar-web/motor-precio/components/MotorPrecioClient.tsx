"use client";

import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import { ReposicionFiltrosSidebar } from "@/components/herramienta-reposicion/ReposicionFiltrosSidebar";
import type { CatalogoPrecioRow, ReglaMarkup, SimularPrecioResult } from "@/lib/bazzar-web/motor-precio/types";
import {
  catalogoSkuKey,
  catalogoToDepositoRows,
} from "@/lib/bazzar-web/motor-precio/catalogo-filtro-siamese";
import {
  EMPTY_OPERATIVA_FILTERS,
  hayFiltrosActivos,
  type OperativaFilterState,
} from "@/lib/depositos/operativa-filters";
import {
  applyStockPeFilters,
  buildStockPeOpciones,
} from "@/lib/stock-pronta-entrega/stock-pe-filters";
import { DepositoProductThumb } from "@/app/depositos-bazzar/components/DepositoProductThumb";

const WEB_NAVY = "#1E3A5F";
const WEB_ORANGE = "#F97316";

type Tab = "reglas" | "catalogo" | "simular";

const fmt = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n)
    ? "—"
    : new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(n);

export function MotorPrecioClient() {
  const [tab, setTab] = useState<Tab>("catalogo");
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [reglas, setReglas] = useState<ReglaMarkup[]>([]);
  const [catalogo, setCatalogo] = useState<CatalogoPrecioRow[]>([]);
  const [metricas, setMetricas] = useState({ skus: 0, con_precio: 0, sin_precio: 0, pares: 0 });
  /** Cascada siamese 2.2.1.44 · mismo motor que Depósito Web / Stock PE */
  const [filtros, setFiltros] = useState<OperativaFilterState>(EMPTY_OPERATIVA_FILTERS);

  const [nuevoCaso, setNuevoCaso] = useState("");
  const [nuevoMarkup, setNuevoMarkup] = useState("50");
  const [nuevoDesc, setNuevoDesc] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editMarkup, setEditMarkup] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const [simLpn, setSimLpn] = useState("100000");
  const [simCaso, setSimCaso] = useState("DEFAULT");
  const [simResult, setSimResult] = useState<SimularPrecioResult | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [publicando, setPublicando] = useState(false);

  const loadReglas = useCallback(async () => {
    const res = await fetch("/api/bazzar-web/motor-precio/reglas");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al cargar reglas");
    if (data.configured === false) {
      setConfigured(false);
      setReglas([]);
      return;
    }
    setConfigured(true);
    setReglas(data.reglas ?? []);
  }, []);

  const loadCatalogo = useCallback(async () => {
    const res = await fetch("/api/bazzar-web/motor-precio/catalogo");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al cargar catálogo");
    if (data.configured === false) {
      setConfigured(false);
      setCatalogo([]);
      return;
    }
    setConfigured(true);
    setCatalogo(data.catalogo ?? []);
    setMetricas(data.metricas ?? { skus: 0, con_precio: 0, sin_precio: 0, pares: 0 });
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadReglas(), loadCatalogo()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }, [loadReglas, loadCatalogo]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtrosDeferred = useDeferredValue(filtros);
  const depositoRows = useMemo(() => catalogoToDepositoRows(catalogo), [catalogo]);
  const filtradasDep = useMemo(
    () => applyStockPeFilters(depositoRows, filtrosDeferred, ""),
    [depositoRows, filtrosDeferred],
  );
  const opciones = useMemo(
    () => buildStockPeOpciones(depositoRows, filtrosDeferred, ""),
    [depositoRows, filtrosDeferred],
  );
  const keysFiltradas = useMemo(() => {
    const s = new Set<string>();
    for (const r of filtradasDep) {
      s.add(
        `${r.linea_codigo_proveedor}|${r.referencia_codigo_proveedor}|${r.material_code ?? ""}`,
      );
    }
    return s;
  }, [filtradasDep]);

  const catalogoFiltrado = useMemo(() => {
    if (!hayFiltrosActivos(filtrosDeferred)) return catalogo;
    return catalogo.filter((r) => keysFiltradas.has(catalogoSkuKey(r)));
  }, [catalogo, filtrosDeferred, keysFiltradas]);

  const sinPrecioRows = useMemo(
    () => catalogoFiltrado.filter((r) => r.sin_precio),
    [catalogoFiltrado],
  );
  const conPrecioRows = useMemo(
    () => catalogoFiltrado.filter((r) => !r.sin_precio),
    [catalogoFiltrado],
  );
  const metricasVista = useMemo(
    () => ({
      skus: catalogoFiltrado.length,
      con_precio: conPrecioRows.length,
      sin_precio: sinPrecioRows.length,
      pares: catalogoFiltrado.reduce((s, r) => s + (r.stock_pares || 0), 0),
    }),
    [catalogoFiltrado, conPrecioRows.length, sinPrecioRows.length],
  );

  async function crearRegla(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/bazzar-web/motor-precio/reglas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caso_codigo: nuevoCaso,
          markup_pct: Number(nuevoMarkup),
          descripcion: nuevoDesc,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "No se pudo crear");
      setSuccess(`Regla creada para caso ${nuevoCaso.toUpperCase()}`);
      setNuevoCaso("");
      setNuevoDesc("");
      await loadReglas();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear");
    }
  }

  async function guardarEdicion(id: number) {
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/bazzar-web/motor-precio/reglas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, markup_pct: Number(editMarkup), descripcion: editDesc }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "No se pudo editar");
      setEditId(null);
      setSuccess("Regla actualizada");
      await loadReglas();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al editar");
    }
  }

  async function toggleActivo(regla: ReglaMarkup) {
    setError(null);
    try {
      const res = await fetch("/api/bazzar-web/motor-precio/reglas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: regla.id, activo: !regla.activo }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "No se pudo cambiar estado");
      await loadReglas();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cambiar estado");
    }
  }

  async function simular(e: React.FormEvent) {
    e.preventDefault();
    setSimLoading(true);
    setError(null);
    setSimResult(null);
    try {
      const res = await fetch("/api/bazzar-web/motor-precio/simular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lpn: Number(simLpn), caso: simCaso }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al simular");
      setSimResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al simular");
    } finally {
      setSimLoading(false);
    }
  }

  async function publicar() {
    if (!confirm("¿Publicar precios WEB calculados a lista activa? Cierra vigencias anteriores por combinación.")) {
      return;
    }
    setPublicando(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/bazzar-web/motor-precio/publicar", { method: "POST" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "No se pudo publicar");
      setSuccess(`Publicados: ${data.publicados} · Omitidos: ${data.omitidos}`);
      await loadCatalogo();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al publicar");
    } finally {
      setPublicando(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "catalogo", label: "Guardián catálogo" },
    { id: "reglas", label: "Reglas markup" },
    { id: "simular", label: "Simulador" },
  ];

  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusGlobalHeader maxWidthClass="max-w-[1600px]" />

      <main className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6">
        <header className="mb-6">
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-800">
            ← Inicio
          </Link>
          <h1 className="mt-2 font-serif text-2xl font-light" style={{ color: WEB_NAVY }}>
            Motor de precio
          </h1>
          <p className="text-sm text-slate-600">
            Guardián del precio de venta WEB — LPN RIMEC × markup del caso (DPE:{" "}
            <strong>NORMAL</strong> / PROMO / LIQ). Filtros cascada siameses{" "}
            <strong>2.2.1.44</strong> · hermano Depósito Web / Stock PE.
          </p>
        </header>

        {!configured && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            DATABASE_URL no configurada — módulo en modo documentación.
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {success}
          </div>
        )}

        <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                tab === t.id ? "text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
              style={tab === t.id ? { backgroundColor: WEB_NAVY } : undefined}
            >
              {t.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => refresh()}
            disabled={loading}
            className="ml-auto rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            {loading ? "Cargando…" : "Actualizar"}
          </button>
        </div>

        {tab === "catalogo" && (
          <section>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  label: hayFiltrosActivos(filtros) ? "SKUs filtrados" : "SKUs (L+R+Mat)",
                  value: metricasVista.skus,
                },
                { label: "Con precio", value: metricasVista.con_precio },
                { label: "Sin LPN/caso", value: metricasVista.sin_precio },
                { label: "Pares stock", value: metricasVista.pares },
              ].map((m) => (
                <div key={m.label} className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{m.label}</p>
                  <p className="mt-1 text-2xl font-semibold" style={{ color: WEB_NAVY }}>
                    {fmt(m.value)}
                  </p>
                </div>
              ))}
            </div>
            {hayFiltrosActivos(filtros) && (
              <p className="mb-3 text-xs text-slate-500">
                Universo ALM_WEB: {metricas.skus} SKUs · cascada acota facetas (replace, no universo)
              </p>
            )}

            <div className="mb-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={publicar}
                disabled={publicando || !configured}
                className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: WEB_ORANGE }}
              >
                {publicando ? "Publicando…" : "Publicar precios WEB"}
              </button>
              <span className="text-xs text-slate-500">
                Escribe en lista_precio WEB · fn_precio_venta_web(LPN, caso)
              </span>
            </div>

            <div className="flex w-full min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:gap-3">
              {/* Ancho = contenido (rails o bloques abiertos) · no reserva 28rem fijos */}
              <aside className="w-auto max-w-full shrink-0 self-start lg:sticky lg:top-4">
                <ReposicionFiltrosSidebar
                  variant="pe"
                  filtros={filtros}
                  onChange={setFiltros}
                  opciones={opciones}
                  emptyFilters={EMPTY_OPERATIVA_FILTERS}
                />
              </aside>
              <div className="min-w-0 flex-1 overflow-hidden">
                {sinPrecioRows.length > 0 && (
                  <div className="mb-6 w-full">
                    <h2 className="mb-2 text-sm font-semibold text-amber-800">
                      Sin precio calculable ({sinPrecioRows.length})
                    </h2>
                    <CatalogoTable rows={sinPrecioRows} highlight="warn" />
                  </div>
                )}

                <h2 className="mb-2 text-sm font-semibold text-slate-700">
                  Catálogo con precio ({conPrecioRows.length})
                </h2>
                <CatalogoTable
                  rows={conPrecioRows.length ? conPrecioRows : catalogoFiltrado}
                  highlight="ok"
                />
              </div>
            </div>
          </section>
        )}

        {tab === "reglas" && (
          <section className="space-y-6">
            <form onSubmit={crearRegla} className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold" style={{ color: WEB_NAVY }}>
                Nueva regla markup
              </h2>
              <div className="flex flex-wrap gap-3">
                <input
                  required
                  placeholder="Caso (ej. DEFAULT)"
                  value={nuevoCaso}
                  onChange={(e) => setNuevoCaso(e.target.value)}
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  required
                  type="number"
                  min={0}
                  max={200}
                  placeholder="Markup %"
                  value={nuevoMarkup}
                  onChange={(e) => setNuevoMarkup(e.target.value)}
                  className="w-28 rounded border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  placeholder="Descripción"
                  value={nuevoDesc}
                  onChange={(e) => setNuevoDesc(e.target.value)}
                  className="min-w-[200px] flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={!configured}
                  className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: WEB_ORANGE }}
                >
                  Crear
                </button>
              </div>
            </form>

            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Caso</th>
                    <th className="px-3 py-2">Markup %</th>
                    <th className="px-3 py-2">Descripción</th>
                    <th className="px-3 py-2">Activo</th>
                    <th className="px-3 py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {reglas.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="px-3 py-2 font-mono text-xs">{r.caso_codigo}</td>
                      <td className="px-3 py-2">
                        {editId === r.id ? (
                          <input
                            type="number"
                            value={editMarkup}
                            onChange={(e) => setEditMarkup(e.target.value)}
                            className="w-20 rounded border px-2 py-1 text-sm"
                          />
                        ) : (
                          `${r.markup_pct}%`
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {editId === r.id ? (
                          <input
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            className="w-full rounded border px-2 py-1 text-sm"
                          />
                        ) : (
                          r.descripcion || "—"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded px-2 py-0.5 text-xs ${
                            r.activo ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {r.activo ? "Sí" : "No"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          {editId === r.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => guardarEdicion(r.id)}
                                className="text-xs text-emerald-700 hover:underline"
                              >
                                Guardar
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditId(null)}
                                className="text-xs text-slate-500 hover:underline"
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditId(r.id);
                                  setEditMarkup(String(r.markup_pct));
                                  setEditDesc(r.descripcion ?? "");
                                }}
                                className="text-xs hover:underline"
                                style={{ color: WEB_NAVY }}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleActivo(r)}
                                className="text-xs text-slate-600 hover:underline"
                              >
                                {r.activo ? "Desactivar" : "Activar"}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!reglas.length && !loading && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                        Sin reglas — crea DEFAULT con 50% para empezar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "simular" && (
          <section className="max-w-lg">
            <form onSubmit={simular} className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold" style={{ color: WEB_NAVY }}>
                fn_precio_venta_web(LPN, caso)
              </h2>
              <div className="space-y-3">
                <label className="block text-sm">
                  <span className="text-slate-600">LPN RIMEC</span>
                  <input
                    required
                    type="number"
                    min={1}
                    value={simLpn}
                    onChange={(e) => setSimLpn(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-slate-600">Caso comercial</span>
                  <input
                    required
                    value={simCaso}
                    onChange={(e) => setSimCaso(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm"
                  />
                </label>
                <button
                  type="submit"
                  disabled={simLoading || !configured}
                  className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: WEB_ORANGE }}
                >
                  {simLoading ? "Calculando…" : "Simular"}
                </button>
              </div>
            </form>

            {simResult && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-600">
                  LPN {fmt(simResult.lpn)} · caso {simResult.caso} · markup{" "}
                  {simResult.markup_pct != null ? `${simResult.markup_pct}%` : "sin regla"}
                </p>
                <p className="mt-2 text-3xl font-semibold" style={{ color: WEB_NAVY }}>
                  ${fmt(simResult.precio_web)}
                </p>
              </div>
            )}
          </section>
        )}
      </main>

      <ReportFooter />
    </div>
  );
}

function CatalogoTable({
  rows,
  highlight,
}: {
  rows: CatalogoPrecioRow[];
  highlight: "ok" | "warn";
}) {
  if (!rows.length) {
    return <p className="text-sm text-slate-500">Sin filas.</p>;
  }

  return (
    <div className="w-full max-w-full overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[720px] table-auto text-left text-sm">
        <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-2 py-2 w-12" aria-label="Foto" />
            <th className="px-3 py-2">Línea</th>
            <th className="px-3 py-2">Ref</th>
            <th className="px-3 py-2">Material</th>
            <th className="px-3 py-2">Stock</th>
            <th className="px-3 py-2">LPN</th>
            <th className="px-3 py-2">Caso</th>
            <th className="px-3 py-2">Markup</th>
            <th className="px-3 py-2">Calculado</th>
            <th className="px-3 py-2">Publicado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            // Identidad = L+R+código material (GROUP BY catálogo · 2.5.1.5).
            // No usar descripción: dos códigos pueden compartir texto (ej. PELICA) → same key React.
            const key = `${r.linea}-${r.referencia}-${r.material_codigo ?? r.material}-${idx}`;
            const diff =
              r.precio_web_calculado != null &&
              r.precio_web_publicado != null &&
              r.precio_web_calculado !== r.precio_web_publicado;
            return (
              <tr
                key={key}
                className={`border-b border-slate-100 ${highlight === "warn" ? "bg-amber-50/50" : ""}`}
              >
                <td className="px-2 py-2 align-middle">
                  {/* NIIF + Ley Universal 2.01.04.021 · marco contain · códigos proveedor */}
                  <div
                    className="relative h-10 w-10 shrink-0 overflow-hidden rounded border border-rimec-azul/30 bg-white shadow-sm"
                    title={
                      r.tipo_v2_id === 2
                        ? `${r.linea}_${r.imagen_color_excel ?? r.color_codigo ?? "?"}`
                        : `${r.linea}-${r.referencia}-${r.material_codigo ?? "?"}-${r.color_codigo ?? "?"}`
                    }
                  >
                    <DepositoProductThumb
                      linea={r.linea}
                      referencia={r.referencia}
                      material={r.material_codigo ?? ""}
                      color={r.color_codigo ?? ""}
                      imagenNombre={r.imagen_nombre}
                      size={40}
                      variant="frame"
                      imageCtx={{
                        tipoV2Id: r.tipo_v2_id,
                        protocol: r.tipo_v2_id === 2 ? "638" : "654",
                        imagenColorExcel: r.imagen_color_excel,
                      }}
                    />
                  </div>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{r.linea}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.referencia}</td>
                <td className="px-3 py-2 max-w-[140px] truncate">{r.material}</td>
                <td className="px-3 py-2">{r.stock_pares}</td>
                <td className="px-3 py-2">{fmt(r.lpn)}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.caso_precio ?? "—"}</td>
                <td className="px-3 py-2">{r.markup_pct != null ? `${r.markup_pct}%` : "—"}</td>
                <td className="px-3 py-2 font-medium">{fmt(r.precio_web_calculado)}</td>
                <td className={`px-3 py-2 ${diff ? "text-amber-700 font-medium" : ""}`}>
                  {fmt(r.precio_web_publicado)}
                  {diff && " ≠"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
