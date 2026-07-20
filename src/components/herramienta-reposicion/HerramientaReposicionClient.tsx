"use client";

import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNiifDelayedLoader } from "@/hooks/useNiifDelayedLoader";
import { useOrdenReposicionConAnimacion } from "@/hooks/useOrdenReposicionConAnimacion";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { RimecCargandoPantalla } from "@/components/report/RimecCargandoPantalla";
import { ReportFooter } from "@/components/report/ReportFooter";
import { EjecutarProtocoloImportacionPreciosButton } from "@/components/motor-precios/EjecutarProtocoloImportacionPreciosButton";
import { SinImagenCabeceraChip } from "@/components/panel-control/SinImagenCabeceraChip";
import { ReposicionFiltrosSidebar } from "@/components/herramienta-reposicion/ReposicionFiltrosSidebar";
import { ReposicionGrilla } from "@/components/herramienta-reposicion/ReposicionGrilla";
import { ImportarPpAbiertoButton } from "@/components/herramienta-reposicion/ImportarPpAbiertoButton";
import { FiltroTonoOperativa } from "@/app/depositos-bazzar/components/operativa/FiltroTonoOperativa";
import { moleculeKeyVentas } from "@/lib/clientes/etiqueta-comprador";
import type { ReposicionArticulo } from "@/lib/herramienta-reposicion/merge-reposicion";
import { reposicionArticuloToDepositoRow } from "@/lib/herramienta-reposicion/reposicion-a-deposito-row";
import {
  applyOperativaFilters,
  buildOperativaOpciones,
  EMPTY_OPERATIVA_FILTERS,
  stampFamiliaPilares,
  type OperativaFilterState,
} from "@/lib/depositos/operativa-filters";
import { moleculeKeyImagen } from "@/lib/retail/product-image-presence";
import {
  buildNivelAmMap,
  type NivelAm,
} from "@/lib/herramienta-reposicion/nivel-am";
import {
  ORDEN_COMPRA_PREVIA,
  ORDEN_LINEA_REF_AZ,
  ORDEN_PROGRAMADO,
  ORDEN_PP_ABIERTO,
  ORDEN_STOCK_PE,
  ORDEN_TRANSITO_CP,
  esOrdenPorMetrica,
  etiquetaOrdenModo,
  ordenarArticulosReposicion,
  ranksOrdenReposicion,
  sumaMetricaOrden,
  type OrdenReposicionModo,
} from "@/lib/herramienta-reposicion/orden-compra-previa";
import { TIPO_V2_CALZADO } from "@/lib/retail/product-image-protocol";

/** Inicio Director: Calzado (tipo_v2=1) + orden A→Z línea.referencia */
const REPOSICION_FILTROS_INICIAL: OperativaFilterState = {
  ...EMPTY_OPERATIVA_FILTERS,
  tipoV2Ids: [TIPO_V2_CALZADO],
};
import {
  borrarCacheReposicionCliente,
  guardarCacheReposicionCliente,
  leerCacheReposicionCliente,
} from "@/lib/herramienta-reposicion/cache-cliente";
import {
  auditarIntegridadReposicion,
  auditarIntegridadVista,
  kpisDesdeArticulos,
  paresStockDesdeArticulo,
  paresTotalesAmDesdeArticulo,
  valorInventarioDesdeArticulos,
} from "@/lib/herramienta-reposicion/totales-reposicion";

function fmt(n: number) {
  return Math.trunc(n).toLocaleString("es-PY");
}

export function HerramientaReposicionClient() {
  const [articulos, setArticulos] = useState<ReposicionArticulo[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [soloConStock, setSoloConStock] = useState(false);
  const [filtros, setFiltros] = useState<OperativaFilterState>(REPOSICION_FILTROS_INICIAL);
  const [qDebounced, setQDebounced] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(filtros.q), 280);
    return () => window.clearTimeout(t);
  }, [filtros.q]);

  const filtrosCompute = useMemo(
    () => ({ ...filtros, q: qDebounced }),
    [filtros, qDebounced],
  );
  const filtrosDeferred = useDeferredValue(filtrosCompute);
  /** Director: inicio con todas las tarjetas desplegadas · Compactar opcional */
  const [expandAll, setExpandAll] = useState(true);
  const [soloSinImagen, setSoloSinImagen] = useState(false);
  const [faltantes, setFaltantes] = useState<Set<string>>(() => new Set());
  const [filtroNivel, setFiltroNivel] = useState<NivelAm | "all">("all");
  /** Solo tarjetas con pill PP abierto (proforma importada). */
  const [filtroSoloPpAbierto, setFiltroSoloPpAbierto] = useState(false);
  /** Orden: A→Z línea.referencia preestablecido · KPIs opcionales */
  const { ordenModo, ordenUi, ordenando, etiquetaOrden, pedirOrden } =
    useOrdenReposicionConAnimacion(ORDEN_LINEA_REF_AZ);

  /** Nivel AM fijado al cargar API — no recalcular con filtros operativos. */
  const nivelesPorKey = useMemo(() => buildNivelAmMap(articulos), [articulos]);

  const conteoNiveles = useMemo(() => {
    const c = { n1: 0, n2: 0, n3: 0, n0: 0 };
    for (const n of nivelesPorKey.values()) {
      if (n === 1) c.n1 += 1;
      else if (n === 2) c.n2 += 1;
      else if (n === 3) c.n3 += 1;
      else c.n0 += 1;
    }
    return c;
  }, [nivelesPorKey]);

  const load = useCallback(async (opts?: { fresh?: boolean }) => {
    const fresh = opts?.fresh === true;
    if (fresh) borrarCacheReposicionCliente();

    if (!fresh) {
      const cached = leerCacheReposicionCliente();
      if (cached?.length) {
        setArticulos(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }
    } else {
      setLoading(true);
    }

    setErr(null);
    try {
      const qs = fresh ? "?fresh=1" : "";
      const res = await fetch(`/api/herramienta-reposicion${qs}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Error al cargar");
      const next = (data.articulos ?? []) as ReposicionArticulo[];
      setArticulos(next);
      guardarCacheReposicionCliente(next);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
      if (!leerCacheReposicionCliente()?.length) setArticulos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onFaltantesChange = useCallback((keys: Set<string>) => {
    setFaltantes(keys);
    if (keys.size === 0) setSoloSinImagen(false);
  }, []);

  const baseArticulos = useMemo(() => {
    if (!soloConStock) return articulos;
    return articulos.filter((a) => a.totales.peDisponible + a.totales.cpDisponible + a.totales.ppAbierto > 0);
  }, [articulos, soloConStock]);

  const asRows = useMemo(
    () => stampFamiliaPilares(baseArticulos.map(reposicionArticuloToDepositoRow)),
    [baseArticulos],
  );

  const opciones = useMemo(
    () => buildOperativaOpciones(asRows, filtrosDeferred),
    [asRows, filtrosDeferred],
  );

  const filtradasRows = useMemo(
    () =>
      applyOperativaFilters(asRows, filtrosDeferred, undefined, {
        incluirVendidoSinSaldo: true,
      }),
    [asRows, filtrosDeferred],
  );

  const filtrados = useMemo(() => {
    const byKey = new Map(baseArticulos.map((a) => [a.key, a]));
    let list = filtradasRows
      .map((r) =>
        byKey.get(
          moleculeKeyVentas(
            r.linea_codigo_proveedor,
            r.referencia_codigo_proveedor,
            r.material_code,
            r.color_code,
          ),
        ),
      )
      .filter((a): a is ReposicionArticulo => !!a);

    if (soloSinImagen && faltantes.size > 0) {
      list = list.filter((a) =>
        faltantes.has(
          moleculeKeyImagen({
            linea: a.linea,
            referencia: a.referencia,
            material: a.material,
            color: a.color,
            tipo_v2_id: a.tipo_v2_id,
            imagen_nombre: a.imagen_nombre,
            imagen_color_excel: a.imagen_color_excel,
          }),
        ),
      );
    }
    return list;
  }, [baseArticulos, filtradasRows, soloSinImagen, faltantes]);

  const filtradosOrdenados = useMemo(() => {
    let list = filtrados;
    if (filtroSoloPpAbierto) {
      list = list.filter((a) => a.totales.ppAbierto > 0);
    }
    if (filtroNivel !== "all") {
      list = list.filter((a) => (nivelesPorKey.get(a.key) ?? 0) === filtroNivel);
    }
    return ordenarArticulosReposicion(list, ordenModo, nivelesPorKey);
  }, [filtrados, filtroSoloPpAbierto, filtroNivel, nivelesPorKey, ordenModo]);

  const ranksPorKey = useMemo(
    () => ranksOrdenReposicion(filtradosOrdenados),
    [filtradosOrdenados],
  );

  const cardsCount = filtradosOrdenados.length;

  /** KPIs cabecera = suma de tarjetas visibles (misma lista que la grilla). */
  const kpisVista = useMemo(
    () => kpisDesdeArticulos(filtradosOrdenados),
    [filtradosOrdenados],
  );

  const kpisHolding = useMemo(() => kpisDesdeArticulos(articulos), [articulos]);

  const hayFiltroActivo =
    filtradosOrdenados.length !== articulos.length ||
    soloConStock ||
    soloSinImagen ||
    filtroNivel !== "all" ||
    filtroSoloPpAbierto;

  const totalParesStock = useMemo(
    () => filtradosOrdenados.reduce((s, a) => s + paresStockDesdeArticulo(a), 0),
    [filtradosOrdenados],
  );

  const totalParesAm = useMemo(
    () => filtradosOrdenados.reduce((s, a) => s + paresTotalesAmDesdeArticulo(a), 0),
    [filtradosOrdenados],
  );

  const valorInventario = useMemo(
    () => valorInventarioDesdeArticulos(filtradosOrdenados),
    [filtradosOrdenados],
  );

  const issuesIntegridad = useMemo(
    () => auditarIntegridadReposicion(articulos),
    [articulos],
  );

  const showCargaNiif = useNiifDelayedLoader(loading);

  const integridadVistaOk = useMemo(
    () => auditarIntegridadVista(kpisVista, filtradosOrdenados),
    [kpisVista, filtradosOrdenados],
  );

  /** Σ métrica del orden activo = KPI visible · tolerancia 0 */
  const sumaOrdenVista = useMemo(() => {
    if (!esOrdenPorMetrica(ordenModo)) return 0;
    return sumaMetricaOrden(filtradosOrdenados, ordenModo);
  }, [filtradosOrdenados, ordenModo]);

  const kpiOrdenActivo = useMemo(() => {
    if (ordenModo === ORDEN_STOCK_PE) return kpisVista.peDisponible;
    if (ordenModo === ORDEN_TRANSITO_CP) return kpisVista.cpDisponible;
    if (ordenModo === ORDEN_COMPRA_PREVIA) return kpisVista.cpVendido;
    if (ordenModo === ORDEN_PROGRAMADO) return kpisVista.programado;
    if (ordenModo === ORDEN_PP_ABIERTO) return kpisVista.ppAbierto;
    return 0;
  }, [ordenModo, kpisVista]);

  const sumLineaStockOk =
    totalParesStock === kpisVista.peDisponible + kpisVista.cpDisponible + kpisVista.ppAbierto;
  const sumLineaAmOk =
    totalParesAm ===
    kpisVista.peDisponible +
      kpisVista.cpDisponible +
      kpisVista.cpVendido +
      kpisVista.programado +
      kpisVista.ppAbierto;

  const toggleFiltroPpAbierto = useCallback(() => {
    setFiltroSoloPpAbierto((prev) => {
      const next = !prev;
      if (next) pedirOrden(ORDEN_PP_ABIERTO);
      return next;
    });
  }, [pedirOrden]);

  const rowsParaChip = filtradasRows;

  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusGlobalHeader active="home" />
      <main className="w-full max-w-none px-0 py-6">
        <div className="flex flex-wrap items-start justify-between gap-3 px-3 sm:px-4">
          <div>
            <Link
              href="/rimec?mundo=panel-control"
              className="text-sm font-semibold text-rimec-azul hover:underline"
            >
              ← Panel de Control Alejandro Magno
            </Link>
            <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-rimec-azul">
              Alejandro Magno · culminación · 2.3.1.20
            </p>
            <h1 className="mt-1 font-serif text-3xl font-bold text-rimec-azul-dark sm:text-4xl">
              Herramienta de reposición!!!
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-neutral-700">
              Filtros al margen · catálogo a ancho completo · familias Material/Color.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <EjecutarProtocoloImportacionPreciosButton variant="compact" />
            <ImportarPpAbiertoButton onImported={() => void load({ fresh: true })} />
            <button
              type="button"
              onClick={() => void load({ fresh: true })}
              className="rounded-lg border border-rimec-azul bg-rimec-azul/5 px-4 py-2 text-xs font-bold text-rimec-azul-dark hover:bg-rimec-azul/10"
            >
              Actualizar
            </button>
          </div>
        </div>

        {loading && !showCargaNiif ? (
          <div className="mt-8 h-24" aria-hidden />
        ) : null}

        {showCargaNiif ? (
          <RimecCargandoPantalla
            className="mt-8"
            mensaje="Cargando reposición Alejandro Magno…"
            subtitulo="Aguarde unos segundos, por favor."
            etapas={[
              "Leyendo stock Pronta Entrega…",
              "Combinando CP y programado…",
              "Calculando niveles N1 · N2 · N3…",
              "Preparando tarjetas de reposición…",
            ]}
          />
        ) : (
          <>
            <div className="mt-6 space-y-2 px-3 sm:px-4">
              {hayFiltroActivo ? (
                <p className="text-[11px] font-semibold text-amber-800">
                  Totales de cabecera ={" "}
                  <strong>{filtradosOrdenados.length.toLocaleString("es-PY")}</strong> tarjetas visibles
                  (holding: {articulos.length.toLocaleString("es-PY")} moléculas)
                  {filtroSoloPpAbierto ? (
                    <>
                      {" "}
                      · <strong className="text-indigo-800">Filtro PP abierto</strong>: solo moléculas con
                      proforma ({fmt(kpisVista.ppAbierto)} pares)
                    </>
                  ) : null}
                </p>
              ) : (
                <p className="text-[11px] font-semibold text-emerald-800">
                  Integridad vista: cada KPI = suma exacta de las {articulos.length.toLocaleString("es-PY")}{" "}
                  tarjetas
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                {(
                  [
                    { l: "Moléculas", v: kpisVista.moleculas, c: "text-rimec-azul-dark", mode: null as OrdenReposicionModo | null, hint: "", display: "num" as const },
                    {
                      l: "A→Z",
                      v: 0,
                      c: "text-violet-800",
                      mode: ORDEN_LINEA_REF_AZ as OrdenReposicionModo,
                      hint: "Orden A→Z · línea.referencia menor → mayor (preestablecido)",
                      display: "az" as const,
                    },
                    {
                      l: "En stock (PE)",
                      v: kpisVista.peDisponible,
                      c: "text-emerald-800",
                      mode: ORDEN_STOCK_PE as OrdenReposicionModo,
                      hint: "Ordenamiento por En stock (PE) · #1 = más pares PE",
                      display: "num" as const,
                    },
                    {
                      l: "En tránsito (CP disp.)",
                      v: kpisVista.cpDisponible,
                      c: "text-rimec-azul",
                      mode: ORDEN_TRANSITO_CP as OrdenReposicionModo,
                      hint: "Ordenamiento por En tránsito · #1 = más pares CP disponibles",
                      display: "num" as const,
                    },
                    {
                      l: "PP abierto",
                      v: filtroSoloPpAbierto ? kpisVista.ppAbierto : kpisHolding.ppAbierto,
                      c: "text-indigo-800",
                      mode: ORDEN_PP_ABIERTO as OrdenReposicionModo,
                      hint: "Clic: solo tarjetas con PP abierto (proforma) · orden por pares PP",
                      display: "num" as const,
                      filtraPp: true as const,
                    },
                    {
                      l: "Vendido (CP)",
                      v: kpisVista.cpVendido,
                      c: "text-emerald-700",
                      mode: ORDEN_COMPRA_PREVIA as OrdenReposicionModo,
                      hint: "Ordenamiento por compra previa · #1 = más pares vendidos CP",
                      display: "num" as const,
                    },
                    {
                      l: "Programado",
                      v: kpisVista.programado,
                      c: "text-amber-900",
                      mode: ORDEN_PROGRAMADO as OrdenReposicionModo,
                      hint: "Ordenamiento por programado · #1 = mayor cantidad programada",
                      display: "num" as const,
                    },
                  ] as const
                ).map((k) => {
                  const clickable = k.mode != null;
                  const encendidoPp = "filtraPp" in k && k.filtraPp && filtroSoloPpAbierto;
                  const encendido = encendidoPp || (clickable && ordenUi === k.mode);
                  const base =
                    "rounded-xl border-2 px-3 py-2.5 text-left transition duration-150 w-full";
                  const cls = encendido
                    ? encendidoPp
                      ? `${base} border-indigo-500 bg-indigo-50 ring-2 ring-indigo-300 ${ordenando ? "scale-[0.98]" : ""}`
                      : `${base} border-violet-500 bg-violet-50 ring-2 ring-violet-300 ${ordenando ? "scale-[0.98]" : ""}`
                    : clickable
                      ? `${base} border-neutral-200 bg-white hover:border-violet-300 hover:bg-violet-50/40 active:scale-[0.98]`
                      : `${base} border-neutral-200 bg-white`;
                  if (!clickable) {
                    return (
                      <div key={k.l} className={cls}>
                        <p className="text-[10px] font-bold uppercase text-neutral-500">{k.l}</p>
                        <p className={`font-serif text-2xl font-semibold tabular-nums ${k.c}`}>{fmt(k.v)}</p>
                      </div>
                    );
                  }
                  const modoOrden = k.mode as OrdenReposicionModo;
                  const onKpiClick =
                    "filtraPp" in k && k.filtraPp ? toggleFiltroPpAbierto : () => pedirOrden(modoOrden);
                  return (
                    <button
                      key={k.l}
                      type="button"
                      title={k.hint}
                      aria-pressed={encendido}
                      aria-busy={ordenando && encendido}
                      disabled={ordenando}
                      onClick={onKpiClick}
                      className={`${cls} disabled:cursor-wait`}
                    >
                      <p className="text-[10px] font-bold uppercase text-neutral-500">
                        {k.l}
                        {encendidoPp
                          ? " · filtro ON"
                          : encendido
                            ? ordenando
                              ? " · ordenando…"
                              : " · orden ON"
                            : ""}
                      </p>
                      {k.display === "az" ? (
                        <p className={`font-serif text-2xl font-semibold ${k.c}`}>
                          línea.ref
                        </p>
                      ) : (
                        <p className={`font-serif text-2xl font-semibold tabular-nums ${k.c}`}>{fmt(k.v)}</p>
                      )}
                    </button>
                  );
                })}
              </div>
              {(esOrdenPorMetrica(ordenUi) || ordenUi === ORDEN_LINEA_REF_AZ) && (
                <p className="text-[11px] font-semibold text-violet-900">
                  {ordenando ? `⏳ ${etiquetaOrden}` : etiquetaOrdenModo(ordenModo)}
                  {!ordenando &&
                    esOrdenPorMetrica(ordenModo) &&
                    (sumaOrdenVista === kpiOrdenActivo
                      ? ` · Σ tarjetas ${fmt(sumaOrdenVista)} = KPI ✓`
                      : ` · ⚠ Σ ${fmt(sumaOrdenVista)} ≠ KPI ${fmt(kpiOrdenActivo)}`)}
                </p>
              )}
              <p className="text-[10px] tabular-nums text-slate-500">
                Σ stock {fmt(totalParesStock)} p (PE {fmt(kpisVista.peDisponible)} + CP{" "}
                {fmt(kpisVista.cpDisponible)} + PP {fmt(kpisVista.ppAbierto)}) · Σ AM {fmt(totalParesAm)} p
                {hayFiltroActivo
                  ? ` · Holding PE ${fmt(kpisHolding.peDisponible)} · CP ${fmt(kpisHolding.cpDisponible)} · PP ${fmt(kpisHolding.ppAbierto)} · Vend. ${fmt(kpisHolding.cpVendido)} · Prog. ${fmt(kpisHolding.programado)}`
                  : null}
              </p>
              {!integridadVistaOk || !sumLineaStockOk || !sumLineaAmOk ? (
                <p className="text-[11px] font-bold text-red-700">
                  ⚠ Cabecera ≠ suma molecular de tarjetas visibles — revisar integridad
                </p>
              ) : null}

              {/* Tono canónico — círculos de color (mantener · Director 2026-07-16) */}
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
                <FiltroTonoOperativa
                  tonos={filtros.tonos}
                  sinTono={filtros.sinTono}
                  onChange={(p) =>
                    setFiltros((prev) => ({
                      ...prev,
                      ...p,
                    }))
                  }
                />
              </div>
            </div>

            {issuesIntegridad.length > 0 && (
              <div className="mt-4 rounded-lg border-2 border-red-400 bg-red-50 px-4 py-3 text-sm text-red-900">
                <p className="font-bold">⚠ Integridad tarjeta ≠ buckets ({issuesIntegridad.length} casos)</p>
                <ul className="mt-2 max-h-32 overflow-y-auto text-xs font-mono">
                  {issuesIntegridad.slice(0, 8).map((i) => (
                    <li key={`${i.key}-${i.campo}`}>
                      {i.linea}.{i.referencia} · {i.campo}: totales {i.enTotales} ≠ pills {i.enBuckets}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {err && (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {err}
              </p>
            )}

            <div className="mt-6 flex w-full flex-col gap-3 lg:flex-row lg:items-start lg:gap-2">
              {/* Margen izquierdo de pantalla · filtros pegados al borde */}
              <div className="w-full shrink-0 pl-1 pr-1 lg:sticky lg:top-2 lg:w-auto lg:max-w-[32rem] lg:max-h-[calc(100vh-1rem)] lg:overflow-y-auto lg:pl-1 lg:pr-0">
                <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm lg:hidden" open>
                  <summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-rimec-azul [&::-webkit-details-marker]:hidden">
                    ▾ Filtros · dimensiones + molécula
                  </summary>
                  <div className="border-t border-slate-100 p-2">
                    <ReposicionFiltrosSidebar
                      filtros={filtros}
                      onChange={setFiltros}
                      opciones={opciones}
                      emptyFilters={REPOSICION_FILTROS_INICIAL}
                      soloConStock={soloConStock}
                      onSoloConStockChange={setSoloConStock}
                      trailing={
                        <SinImagenCabeceraChip
                          productos={rowsParaChip}
                          soloSinImagen={soloSinImagen}
                          onSoloSinImagenChange={setSoloSinImagen}
                          onFaltantesChange={onFaltantesChange}
                        />
                      }
                    />
                  </div>
                </details>
                <div className="hidden lg:block">
                  <ReposicionFiltrosSidebar
                    filtros={filtros}
                    onChange={setFiltros}
                    opciones={opciones}
                    emptyFilters={REPOSICION_FILTROS_INICIAL}
                    soloConStock={soloConStock}
                    onSoloConStockChange={setSoloConStock}
                    trailing={
                      <SinImagenCabeceraChip
                        productos={rowsParaChip}
                        soloSinImagen={soloSinImagen}
                        onSoloSinImagenChange={setSoloSinImagen}
                        onFaltantesChange={onFaltantesChange}
                      />
                    }
                  />
                </div>
              </div>

              <div
                className={`relative min-h-[12rem] min-w-0 flex-1 pr-2 sm:pr-3 ${ordenando ? "pointer-events-none opacity-70" : ""}`}
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs text-slate-500">
                      {filtradosOrdenados.length.toLocaleString("es-PY")} /{" "}
                      {articulos.length.toLocaleString("es-PY")} artículos · sidebar multi-select
                      {cardsCount > 0
                        ? ` · ${totalParesStock.toLocaleString("es-PY")} p · Gs ${valorInventario.toLocaleString("es-PY")}`
                        : ""}
                      {expandAll ? " · tarjetas extendidas" : " · tarjetas compactas"}
                      {ordenando ? " · ordenando…" : ""}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {(
                        [
                          { id: "all" as const, label: "Todos niveles", count: articulos.length },
                          { id: 1 as const, label: "N1", count: conteoNiveles.n1 },
                          { id: 2 as const, label: "N2", count: conteoNiveles.n2 },
                          { id: 3 as const, label: "N3", count: conteoNiveles.n3 },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={String(opt.id)}
                          type="button"
                          onClick={() => setFiltroNivel(opt.id)}
                          disabled={ordenando}
                          className={`rounded-lg border px-2 py-1 text-[10px] font-bold tabular-nums transition ${
                            filtroNivel === opt.id
                              ? "border-rimec-azul bg-rimec-azul text-white"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {opt.label} ({opt.count.toLocaleString("es-PY")})
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandAll((v) => !v)}
                    aria-pressed={expandAll}
                    disabled={ordenando}
                    className={`min-h-[40px] rounded-xl border px-4 text-xs font-bold transition ${
                      expandAll
                        ? "border-bazzar-naranja bg-bazzar-naranja text-white"
                        : "border-bazzar-naranja/40 bg-white text-bazzar-naranja-dark hover:bg-orange-50"
                    }`}
                  >
                    {expandAll ? "▾ Compactar tarjetas" : "▸ Extender todos los datos"}
                  </button>
                </div>

                <ReposicionGrilla
                  articulos={filtradosOrdenados}
                  expandAll={expandAll}
                  ordenModo={ordenModo}
                  nivelesPorKey={nivelesPorKey}
                  ranksPorKey={ranksPorKey}
                />
                {!filtradosOrdenados.length && (
                  <p className="mt-8 text-neutral-600">No hay artículos con esos filtros.</p>
                )}
              </div>
            </div>
          </>
        )}
      </main>
      <ReportFooter note="Herramienta de reposición · Alejandro Magno · PE + CP + PP abierto + PROGRAMADO" />
    </div>
  );
}
