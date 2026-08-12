"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VitalesStockDeposito } from "@/app/depositos-bazzar/components/operativa/VitalesStockDeposito";
import { ReposicionFiltrosSidebar } from "@/components/herramienta-reposicion/ReposicionFiltrosSidebar";
import { SinImagenCabeceraChip } from "@/components/panel-control/SinImagenCabeceraChip";
import { PeImportSdrmButton } from "@/components/stock-pronta-entrega/PeImportSdrmButton";
import { PeAsignacionDescuentoPanel } from "@/components/stock-pronta-entrega/PeAsignacionDescuentoPanel";
import { PeDiccionarioWebControlBar } from "@/components/stock-pronta-entrega/PeDiccionarioWebControlBar";
import { DiccionarioPeBar } from "@/components/stock-pronta-entrega/DiccionarioPeBar";
import { GrillaPeImportadora } from "@/components/stock-pronta-entrega/GrillaPeImportadora";
import { PeVentasRegistroBar } from "@/components/stock-pronta-entrega/PeVentasRegistroBar";
import { StockPeProvider, useStockPe } from "@/components/stock-pronta-entrega/StockPeContext";
import { TabArticulosPe } from "@/components/stock-pronta-entrega/TabArticulosPe";
import { TabResumenAsignacionPe } from "@/components/stock-pronta-entrega/TabResumenAsignacionPe";
import {
  EMPTY_OPERATIVA_FILTERS,
  type OperativaFilterState,
} from "@/lib/depositos/operativa-filters";
import { moleculeKeyFromDepRow } from "@/lib/retail/product-image-presence";
import {
  NIVEL_DIOS_CATEGORIA,
  NIVEL_DIOS_ROL_ID,
} from "@/lib/auth/nivel-dios";
import {
  mapDescuentoPeLocal,
  moleculeKeyDescuentoPe,
  parsePctDescuento,
  savePeAsignacionDescuentoLocal,
} from "@/lib/stock-pronta-entrega/asignacion-descuento-local";
import {
  claveDiccionarioFromTipoIds,
  parsePeTipoSelected,
  tipoIdsFromClaveDiccionario,
} from "@/lib/stock-pronta-entrega/filtro-tipo-pe-diccionario";
import type { StockProntaEntregaResumen } from "@/lib/stock-pronta-entrega/queries-resumen";

async function readJsonResponse<T>(res: Response): Promise<{ json: T | null; err: string | null }> {
  const text = await res.text();
  if (!text.trim()) {
    return { json: null, err: `Respuesta vacía del servidor (HTTP ${res.status})` };
  }
  try {
    return { json: JSON.parse(text) as T, err: null };
  } catch {
    const preview = text.replace(/\s+/g, " ").slice(0, 100);
    return {
      json: null,
      err: `Respuesta no JSON (HTTP ${res.status}) — suele ser timeout Vercel. ${preview}`,
    };
  }
}

async function fetchDescuentosBd(batch: string): Promise<Map<string, number>> {
  try {
    const res = await fetch(
      `/api/stock-pronta-entrega/asignacion-descuento?batch=${encodeURIComponent(batch)}`,
      { cache: "no-store" },
    );
    const { json, err } = await readJsonResponse<{ ok?: boolean; descuentos?: Record<string, number> }>(res);
    if (err || !json?.ok || !json.descuentos) return new Map();
    return new Map(Object.entries(json.descuentos));
  } catch {
    return new Map();
  }
}

type Props = {
  resumenInicial: StockProntaEntregaResumen;
};

function fingerprintFiltros(
  filtros: OperativaFilterState,
  depositoLegal: string,
): string {
  return JSON.stringify({ f: filtros, d: depositoLegal });
}

function StockPeOperativaTab({ batchLabel }: { batchLabel: string }) {
  const {
    filtros,
    setFiltros,
    opciones,
    cardsCount,
    totalPares,
    valorInventario,
    calzadoPares,
    confeccionesPares,
    calzadoGs,
    confeccionesGs,
    filtradas,
    depositoLegal,
    setDepositoLegal,
  } = useStockPe();

  const peTipoSelected = useMemo(
    () => parsePeTipoSelected(filtros.tipoGrupos),
    [filtros.tipoGrupos],
  );
  const diccionarioActivo = useMemo(
    () => claveDiccionarioFromTipoIds(peTipoSelected),
    [peTipoSelected],
  );

  const onDiccionarioChange = useCallback(
    (clave: string | null) => {
      setFiltros((prev) => ({
        ...prev,
        tipoGrupos: tipoIdsFromClaveDiccionario(clave) as typeof prev.tipoGrupos,
        cadenaComercial: null,
      }));
    },
    [setFiltros],
  );

  const [soloSinImagen, setSoloSinImagen] = useState(false);
  const [faltantes, setFaltantes] = useState<Set<string>>(() => new Set());
  /** Asignar % descuento · solo DIOS (ADMIN ve stock, no dicta) */
  const [puedeAsignarDescuento, setPuedeAsignarDescuento] = useState(false);
  const [modoAsignacion, setModoAsignacion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const rol = Number(data?.user?.rol_id);
        const cat = String(data?.user?.categoria || data?.user?.role || "")
          .toUpperCase()
          .trim();
        setPuedeAsignarDescuento(rol === NIVEL_DIOS_ROL_ID && cat === NIVEL_DIOS_CATEGORIA);
      })
      .catch(() => {
        if (!cancelled) setPuedeAsignarDescuento(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  /** Área vacía hasta que el usuario cambia filtros (carga intencional). */
  const [areaCargada, setAreaCargada] = useState(false);
  const baselineFpRef = useRef<string | null>(null);
  const [pctDraft, setPctDraft] = useState("");
  const [asigBusy, setAsigBusy] = useState(false);
  const [asigErr, setAsigErr] = useState<string | null>(null);
  const [asigOk, setAsigOk] = useState<string | null>(null);
  const [descuentoPctPorMol, setDescuentoPctPorMol] = useState<Map<string, number>>(
    () => new Map(),
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const fromBd = await fetchDescuentosBd(batchLabel);
      if (cancelled) return;
      if (fromBd.size > 0) {
        setDescuentoPctPorMol(fromBd);
        return;
      }
      setDescuentoPctPorMol(mapDescuentoPeLocal(batchLabel));
    })();
    return () => {
      cancelled = true;
    };
  }, [batchLabel]);

  const onFaltantesChange = useCallback((keys: Set<string>) => {
    setFaltantes(keys);
    if (keys.size === 0) setSoloSinImagen(false);
  }, []);

  const filtradasGrid = useMemo(() => {
    if (!soloSinImagen || faltantes.size === 0) return filtradas;
    return filtradas.filter((p) => faltantes.has(moleculeKeyFromDepRow(p)));
  }, [filtradas, soloSinImagen, faltantes]);

  const filtrosFp = useMemo(
    () => fingerprintFiltros(filtros, depositoLegal),
    [filtros, depositoLegal],
  );

  /** Entrar al modo: vaciar área + reset tipo diccionario (fuerza carga manual). */
  const entrarModoAsignacion = useCallback(() => {
    setAsigErr(null);
    setAsigOk(null);
    setPctDraft("");
    setAreaCargada(false);
    baselineFpRef.current = null;
    setFiltros((prev) => ({
      ...prev,
      tipoGrupos: [],
      cadenaComercial: null,
    }));
    setModoAsignacion(true);
  }, [setFiltros]);

  const salirModoAsignacion = useCallback(() => {
    setModoAsignacion(false);
    setAreaCargada(false);
    baselineFpRef.current = null;
    setAsigErr(null);
    setAsigOk(null);
  }, []);

  const vaciarArea = useCallback(() => {
    setAreaCargada(false);
    baselineFpRef.current = filtrosFp;
    setAsigErr(null);
    setAsigOk(null);
  }, [filtrosFp]);

  const onToggleAsignacion = useCallback(() => {
    if (modoAsignacion) salirModoAsignacion();
    else entrarModoAsignacion();
  }, [entrarModoAsignacion, modoAsignacion, salirModoAsignacion]);

  // Baseline tras reset · cualquier cambio de filtro puebla el área.
  useEffect(() => {
    if (!modoAsignacion) return;
    if (baselineFpRef.current === null) {
      baselineFpRef.current = filtrosFp;
      return;
    }
    if (filtrosFp !== baselineFpRef.current) {
      setAreaCargada(true);
    }
  }, [modoAsignacion, filtrosFp]);

  const productosArea = modoAsignacion
    ? areaCargada
      ? filtradasGrid
      : []
    : filtradasGrid;

  const moleculasArea = useMemo(() => {
    if (!modoAsignacion || !areaCargada) return new Set<string>();
    const keys = new Set<string>();
    for (const p of filtradasGrid) keys.add(moleculeKeyDescuentoPe(p));
    return keys;
  }, [modoAsignacion, areaCargada, filtradasGrid]);

  const onAsignarDescuento = useCallback(() => {
    setAsigErr(null);
    setAsigOk(null);
    const pct = parsePctDescuento(pctDraft);
    if (pct === null) {
      setAsigErr("Porcentaje inválido (0–100, entero o decimal).");
      return;
    }
    if (!areaCargada || moleculasArea.size === 0) {
      setAsigErr("Área vacía · elegí filtros para cargar calzados antes de asignar.");
      return;
    }
    setAsigBusy(true);
    void (async () => {
      try {
        const keys = [...moleculasArea];
        savePeAsignacionDescuentoLocal({
          batch_label: batchLabel,
          pct,
          molecule_keys: keys,
          assigned_at: new Date().toISOString(),
        });
        const res = await fetch("/api/stock-pronta-entrega/asignacion-descuento", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batch: batchLabel, pct, molecule_keys: keys }),
        });
        const { json, err: parseErr } = await readJsonResponse<{
          ok?: boolean;
          error?: string;
          upserted?: number;
        }>(res);
        if (parseErr) {
          const fromBd = await fetchDescuentosBd(batchLabel);
          if (fromBd.size > 0) {
            setDescuentoPctPorMol(fromBd);
            setAsigOk(
              `Descuento ${pct}% guardado en BD (${fromBd.size.toLocaleString("es-PY")} moléculas) — el servidor tardó pero persistió.`,
            );
            return;
          }
          setAsigErr(parseErr);
          setDescuentoPctPorMol(mapDescuentoPeLocal(batchLabel));
          return;
        }
        if (!res.ok || !json?.ok) {
          setAsigErr(json?.error ?? "No se pudo guardar en BD (queda en sesión local).");
          setDescuentoPctPorMol(mapDescuentoPeLocal(batchLabel));
          return;
        }
        const fromBd = await fetchDescuentosBd(batchLabel);
        setDescuentoPctPorMol(fromBd.size > 0 ? fromBd : mapDescuentoPeLocal(batchLabel));
        setAsigOk(
          `Asignado ${pct}% a ${(json.upserted ?? keys.length).toLocaleString("es-PY")} moléculas · guardado en BD.`,
        );
      } catch (e) {
        setAsigErr(e instanceof Error ? e.message : "Error de red al guardar");
        setDescuentoPctPorMol(mapDescuentoPeLocal(batchLabel));
      } finally {
        setAsigBusy(false);
      }
    })();
  }, [areaCargada, batchLabel, moleculasArea, pctDraft]);

  const sidebar = (
    <ReposicionFiltrosSidebar
      variant="pe"
      filtros={filtros}
      onChange={setFiltros}
      opciones={opciones}
      emptyFilters={EMPTY_OPERATIVA_FILTERS}
      depositoLegal={depositoLegal}
      onDepositoLegalChange={setDepositoLegal}
    />
  );

  return (
    <>
      <PeDiccionarioWebControlBar
        batchLabel={batchLabel}
        modoAsignacion={modoAsignacion}
        onToggleAsignacion={puedeAsignarDescuento ? onToggleAsignacion : undefined}
      />

      <div className="mt-3 flex w-full flex-col gap-3 lg:flex-row lg:items-start lg:gap-2">
        <div className="w-full shrink-0 self-start pl-1 pr-1 lg:sticky lg:top-2 lg:w-auto lg:max-w-[32rem] lg:pl-1 lg:pr-0">
          <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm lg:hidden" open>
            <summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-rimec-azul [&::-webkit-details-marker]:hidden">
              ▾ Filtros · dimensiones + molécula
            </summary>
            <div className="border-t border-slate-100 p-2">{sidebar}</div>
          </details>
          <div className="hidden lg:block">{sidebar}</div>
        </div>

        <div className="min-w-0 flex-1 space-y-3 pr-1 sm:pr-2">
          {modoAsignacion ? (
            <PeAsignacionDescuentoPanel
              moleculas={moleculasArea.size}
              areaCargada={areaCargada}
              pct={pctDraft}
              onPctChange={setPctDraft}
              onAsignar={onAsignarDescuento}
              onSalir={salirModoAsignacion}
              onVaciarArea={vaciarArea}
              busy={asigBusy}
              err={asigErr}
              okMsg={asigOk}
            />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
              <VitalesStockDeposito
                productos={cardsCount}
                pares={totalPares}
                valorInventario={valorInventario}
                variant="prominent"
              />
              <div className="flex flex-wrap items-center gap-2">
                <SinImagenCabeceraChip
                  productos={filtradas}
                  soloSinImagen={soloSinImagen}
                  onSoloSinImagenChange={setSoloSinImagen}
                  onFaltantesChange={onFaltantesChange}
                />
                <PeVentasRegistroBar
                  batchLabel={batchLabel}
                  calzadoPares={calzadoPares}
                  confeccionesPares={confeccionesPares}
                  calzadoGs={calzadoGs}
                  confeccionesGs={confeccionesGs}
                />
              </div>
            </div>
          )}

          <DiccionarioPeBar
            rows={filtradas}
            claveActiva={diccionarioActivo}
            onClaveChange={onDiccionarioChange}
          />

          {modoAsignacion && !areaCargada ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
              <p className="text-sm font-semibold text-slate-800">Área de trabajo vacía</p>
              <p className="mt-2 text-xs text-slate-600">
                Elegí una combinación de filtros (ej. LIQUIDACION · marca · estilo) para cargar
                calzados acá. Luego asigná el % a ese grupo.
              </p>
            </div>
          ) : (
            <GrillaPeImportadora
              productos={productosArea}
              showVentas={!modoAsignacion}
              loteModo="pe-dual-ramo"
              showDiccionarioBadge
              descuentoPctPorMol={descuentoPctPorMol}
            />
          )}
        </div>
      </div>
    </>
  );
}

function StockPeShell({ resumenInicial }: Props) {
  const [tab, setTab] = useState<"operativa" | "articulos" | "resumen-asignacion">("operativa");
  const { loading, err } = useStockPe();
  const onImportDone = useCallback(() => {
    // Refresco completo liviano: router.refresh() del PE es pesado y parece “colgado”.
    window.setTimeout(() => {
      window.location.assign("/stock-pronta-entrega");
    }, 800);
  }, []);

  return (
    <div className="pb-8">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2 px-4 py-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <Link href="/rimec?mundo=panel-control" className="text-sm text-rimec-azul hover:underline">
              ← Panel de Control
            </Link>
            <h1 className="font-serif text-lg font-semibold uppercase tracking-wide text-slate-900">
              STOCK PRONTA ENTREGA
            </h1>
            <span className="text-xs text-slate-500">batch {resumenInicial.batch_label}</span>
          </div>
          <PeImportSdrmButton onDone={onImportDone} />
        </div>
        <div className="mx-auto flex max-w-[1600px] gap-2 border-t border-slate-100 px-4">
          {(
            [
              ["operativa", "Operativa"],
              ["articulos", "Artículos"],
              ["resumen-asignacion", "Resumen asignación"],
            ] as const
          ).map(([t, label]) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-semibold ${
                tab === t
                  ? "border-b-2 border-rimec-azul text-rimec-azul"
                  : "text-slate-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-2 pt-3 sm:px-4">
        {err ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {err}
          </div>
        ) : null}
        {loading ? (
          <p className="text-slate-500">Cargando catálogo…</p>
        ) : (
          <>
            <div className={tab !== "operativa" ? "hidden" : undefined} aria-hidden={tab !== "operativa"}>
              <StockPeOperativaTab batchLabel={resumenInicial.batch_label} />
            </div>
            <div className={tab !== "articulos" ? "hidden" : undefined} aria-hidden={tab !== "articulos"}>
              <TabArticulosPe />
            </div>
            <div
              className={tab !== "resumen-asignacion" ? "hidden" : undefined}
              aria-hidden={tab !== "resumen-asignacion"}
            >
              <TabResumenAsignacionPe batchLabel={resumenInicial.batch_label} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function StockProntaEntregaClient({ resumenInicial }: Props) {
  return (
    <StockPeProvider>
      <StockPeShell resumenInicial={resumenInicial} />
    </StockPeProvider>
  );
}
