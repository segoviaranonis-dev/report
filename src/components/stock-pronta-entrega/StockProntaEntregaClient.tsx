"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
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
import { EMPTY_OPERATIVA_FILTERS } from "@/lib/depositos/operativa-filters";
import { moleculeKeyFromDepRow } from "@/lib/retail/product-image-presence";
import {
  parsePctDescuento,
  savePeAsignacionDescuentoLocal,
} from "@/lib/stock-pronta-entrega/asignacion-descuento-local";
import {
  claveDiccionarioFromTipoIds,
  parsePeTipoSelected,
  tipoIdsFromClaveDiccionario,
} from "@/lib/stock-pronta-entrega/filtro-tipo-pe-diccionario";
import type { StockProntaEntregaResumen } from "@/lib/stock-pronta-entrega/queries-resumen";

type Props = {
  resumenInicial: StockProntaEntregaResumen;
};

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
  const [modoAsignacion, setModoAsignacion] = useState(false);
  const [pctDraft, setPctDraft] = useState("");
  const [asigBusy, setAsigBusy] = useState(false);
  const [asigErr, setAsigErr] = useState<string | null>(null);
  const [asigOk, setAsigOk] = useState<string | null>(null);

  const onFaltantesChange = useCallback((keys: Set<string>) => {
    setFaltantes(keys);
    if (keys.size === 0) setSoloSinImagen(false);
  }, []);

  const filtradasGrid = useMemo(() => {
    if (!soloSinImagen || faltantes.size === 0) return filtradas;
    return filtradas.filter((p) => faltantes.has(moleculeKeyFromDepRow(p)));
  }, [filtradas, soloSinImagen, faltantes]);

  const moleculasAsignacion = useMemo(() => {
    const keys = new Set<string>();
    for (const p of filtradas) keys.add(moleculeKeyFromDepRow(p));
    return keys;
  }, [filtradas]);

  const onToggleAsignacion = useCallback(() => {
    setModoAsignacion((v) => !v);
    setAsigErr(null);
    setAsigOk(null);
  }, []);

  const onAsignarDescuento = useCallback(() => {
    setAsigErr(null);
    setAsigOk(null);
    const pct = parsePctDescuento(pctDraft);
    if (pct === null) {
      setAsigErr("Porcentaje inválido (0–100, entero o decimal).");
      return;
    }
    if (moleculasAsignacion.size === 0) {
      setAsigErr("No hay moléculas en el filtro actual.");
      return;
    }
    setAsigBusy(true);
    try {
      savePeAsignacionDescuentoLocal({
        batch_label: batchLabel,
        pct,
        molecule_keys: [...moleculasAsignacion],
        assigned_at: new Date().toISOString(),
      });
      setAsigOk(
        `Asignado ${pct}% a ${moleculasAsignacion.size.toLocaleString("es-PY")} moléculas (sesión local).`,
      );
    } finally {
      setAsigBusy(false);
    }
  }, [batchLabel, moleculasAsignacion, pctDraft]);

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
        onToggleAsignacion={onToggleAsignacion}
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
              moleculas={moleculasAsignacion.size}
              pct={pctDraft}
              onPctChange={setPctDraft}
              onAsignar={onAsignarDescuento}
              onSalir={() => {
                setModoAsignacion(false);
                setAsigErr(null);
                setAsigOk(null);
              }}
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

          {!modoAsignacion ? (
            <GrillaPeImportadora
              productos={filtradasGrid}
              showVentas
              loteModo="pe-dual-ramo"
              showDiccionarioBadge
            />
          ) : null}
        </div>
      </div>
    </>
  );
}

function StockPeShell({ resumenInicial }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"operativa" | "articulos">("operativa");
  const { loading, err } = useStockPe();
  const onImportDone = useCallback(() => {
    router.refresh();
  }, [router]);

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
          {(["operativa", "articulos"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-semibold capitalize ${
                tab === t
                  ? "border-b-2 border-rimec-azul text-rimec-azul"
                  : "text-slate-500"
              }`}
            >
              {t === "operativa" ? "Operativa" : "Artículos"}
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
