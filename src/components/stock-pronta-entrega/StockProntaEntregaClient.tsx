"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { PanelControlGrillaStack } from "@/components/panel-control/PanelControlGrillaStack";
import { PeVentasRegistroBar } from "@/components/stock-pronta-entrega/PeVentasRegistroBar";
import { StockPeProvider, useStockPe } from "@/components/stock-pronta-entrega/StockPeContext";
import { TabArticulosPe } from "@/components/stock-pronta-entrega/TabArticulosPe";
import {
  buildLineaCasoMap,
  lookupCasoLinea,
  type CasoBibliotecaLite,
} from "@/lib/depositos/caso-biblioteca";
import type { StockProntaEntregaResumen } from "@/lib/stock-pronta-entrega/queries-resumen";
import { RIMEC_SDRM_DEPOSIT_MAP } from "@/lib/deposito-rimec/rimec-csv-sdrm";

type Props = {
  resumenInicial: StockProntaEntregaResumen;
};

function DepositoLegalRow({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
      <span className="w-20 shrink-0 pt-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
        Depósito
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onChange("")}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold font-mono ${
            !value
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-gray-300 bg-white text-gray-700"
          }`}
        >
          Todos
        </button>
        {RIMEC_SDRM_DEPOSIT_MAP.map((d) => (
          <button
            key={d.csvColumn}
            type="button"
            onClick={() => onChange(value === d.csvColumn ? "" : d.csvColumn)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold font-mono ${
              value === d.csvColumn
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-gray-300 bg-white text-gray-700"
            }`}
          >
            {d.csvColumn}
          </button>
        ))}
      </div>
    </div>
  );
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

  const [bibliotecaId, setBibliotecaId] = useState<number | null>(null);
  const [casoActivo, setCasoActivo] = useState<string | null>(null);
  const [lineaCasoMap, setLineaCasoMap] = useState<Map<string, string>>(() => new Map());

  const onCasosLoaded = useCallback((casos: CasoBibliotecaLite[]) => {
    setLineaCasoMap(buildLineaCasoMap(casos));
  }, []);

  const filtradasGrid = useMemo(() => {
    if (!casoActivo || lineaCasoMap.size === 0) return filtradas;
    return filtradas.filter(
      (r) => lookupCasoLinea(lineaCasoMap, r.linea_codigo_proveedor) === casoActivo,
    );
  }, [filtradas, casoActivo, lineaCasoMap]);

  return (
    <PanelControlGrillaStack
      bibliotecaIndicePath="/api/stock-pronta-entrega/filtros-indice"
      bibliotecaId={bibliotecaId}
      casoActivo={casoActivo}
      onBibliotecaChange={setBibliotecaId}
      onCasoChange={setCasoActivo}
      onCasosLoaded={onCasosLoaded}
      filtros={filtros}
      onFiltrosChange={setFiltros}
      opciones={opciones}
      cardsCount={cardsCount}
      totalPares={totalPares}
      valorInventario={valorInventario}
      summaryTrailing={
        <PeVentasRegistroBar
          batchLabel={batchLabel}
          calzadoPares={calzadoPares}
          confeccionesPares={confeccionesPares}
          calzadoGs={calzadoGs}
          confeccionesGs={confeccionesGs}
        />
      }
      extraFilters={
        <DepositoLegalRow value={depositoLegal} onChange={setDepositoLegal} />
      }
      productos={filtradasGrid}
      casoPorLinea={lineaCasoMap}
      grilla={{ showVentas: true, loteModo: "pe-dual-ramo" }}
    />
  );
}

function StockPeShell({ resumenInicial }: Props) {
  const [tab, setTab] = useState<"operativa" | "articulos">("operativa");
  const { loading, err } = useStockPe();

  return (
    <div className="pb-8">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <Link href="/rimec?mundo=panel-control" className="text-sm text-rimec-azul hover:underline">
              ← Panel de Control
            </Link>
            <h1 className="font-serif text-lg font-semibold text-slate-900">Stock Pronta Entrega</h1>
            <span className="text-xs text-slate-500">batch {resumenInicial.batch_label}</span>
          </div>
        </div>
        <div className="mx-auto flex max-w-7xl gap-2 border-t border-slate-100 px-4">
          {(["operativa", "articulos"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-semibold capitalize ${
                tab === t
                  ? "border-b-2 border-bazzar-naranja text-bazzar-naranja-dark"
                  : "text-slate-500"
              }`}
            >
              {t === "operativa" ? "Operativa" : "Artículos"}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-3">
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
