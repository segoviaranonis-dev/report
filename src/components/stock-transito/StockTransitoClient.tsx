"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { PanelControlGrillaStack } from "@/components/panel-control/PanelControlGrillaStack";
import { FiltroLlegadaMulti } from "@/components/stock-transito/FiltroLlegadaMulti";
import { TransitoVentasVitales } from "@/components/stock-transito/TransitoVentasVitales";
import { StockTransitoProvider, useStockTransito } from "@/components/stock-transito/StockTransitoContext";
import { TabArticulosTransito } from "@/components/stock-transito/TabArticulosTransito";
import {
  buildLineaCasoMap,
  lookupCasoLinea,
  type CasoBibliotecaLite,
} from "@/lib/depositos/caso-biblioteca";
import type { StockTransitoResumen } from "@/lib/stock-transito/queries-resumen";
import { resolveTransitoVitales } from "@/lib/stock-transito/vitales-canonicos";
import {
  filterTransitoRowsByVista,
  STOCK_TRANSITO_VISTA_META,
  type StockTransitoVista,
} from "@/lib/stock-transito/vista-transito";

type Props = {
  resumenInicial: StockTransitoResumen;
  vista: StockTransitoVista;
};

function StockTransitoOperativaTab({
  resumen,
  vista,
}: {
  resumen: StockTransitoResumen;
  vista: StockTransitoVista;
}) {
  const {
    filtros,
    setFiltros,
    opciones,
    cardsCount,
    totalPares,
    valorInventario,
    filtradas,
    quincenaIds,
    setQuincenaIds,
    ventasComprador,
  } = useStockTransito();

  const [bibliotecaId, setBibliotecaId] = useState<number | null>(null);
  const [casoActivo, setCasoActivo] = useState<string | null>(null);
  const [lineaCasoMap, setLineaCasoMap] = useState<Map<string, string>>(() => new Map());

  const onCasosLoaded = useCallback((casos: CasoBibliotecaLite[]) => {
    setLineaCasoMap(buildLineaCasoMap(casos));
  }, []);

  const filtradasCaso = useMemo(() => {
    if (!casoActivo || lineaCasoMap.size === 0) return filtradas;
    return filtradas.filter(
      (r) => lookupCasoLinea(lineaCasoMap, r.linea_codigo_proveedor) === casoActivo,
    );
  }, [filtradas, casoActivo, lineaCasoMap]);

  const filtradasGrid = useMemo(
    () => filterTransitoRowsByVista(filtradasCaso, vista),
    [filtradasCaso, vista],
  );

  const vitales = useMemo(
    () =>
      resolveTransitoVitales({
        resumen,
        quincenaIds,
        casoActivo,
        filtros,
        filtradas,
        filtradasCaso: filtradasGrid,
      }),
    [resumen, quincenaIds, casoActivo, filtros, filtradas, filtradasGrid],
  );

  const meta = STOCK_TRANSITO_VISTA_META[vista];
  const destaqueVitales = vista === "ventas" ? "vendido" : "saldo";

  return (
    <PanelControlGrillaStack
      bibliotecaIndicePath="/api/stock-transito/filtros-indice"
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
        <TransitoVentasVitales
          paresInicial={vitales.inicial}
          paresVendidos={vitales.vendidos}
          paresSaldo={vitales.saldo}
          valorInventario={valorInventario}
          modo={vitales.modo}
          destaque={destaqueVitales}
        />
      }
      extraFilters={
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2">
          <FiltroLlegadaMulti
            quincenas={resumen.por_quincena}
            selectedIds={quincenaIds}
            onChange={setQuincenaIds}
          />
        </div>
      }
      productos={filtradasGrid}
      casoPorLinea={lineaCasoMap}
      grilla={{
        showLlegada: true,
        showVentas: true,
        ventasPorMol: ventasComprador,
        loteModo: "unitario",
      }}
      footer={<p className="text-center text-[10px] text-slate-400">{meta.subtitle}</p>}
    />
  );
}

function StockTransitoShell({ resumenInicial, vista }: Props) {
  const [tab, setTab] = useState<"operativa" | "articulos">("operativa");
  const { loading, err } = useStockTransito();
  const meta = STOCK_TRANSITO_VISTA_META[vista];
  const showArticulosTab = vista === "disponible";

  return (
    <div className="pb-8">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <Link href="/rimec?mundo=panel-control" className="text-sm text-rimec-azul hover:underline">
              ← Panel de Control
            </Link>
            <Link href={meta.hubHref} className="text-sm text-slate-500 hover:text-rimec-azul hover:underline">
              Compra previa tránsito
            </Link>
            <h1 className="font-serif text-lg font-semibold text-slate-900">{meta.title}</h1>
            <span className="text-xs text-slate-500">
              {resumenInicial.pedidos_pp} PP · cabecera estándar + grilla productos
            </span>
          </div>
        </div>
        {showArticulosTab ? (
          <div className="mx-auto flex max-w-7xl gap-2 border-t border-slate-100 px-4">
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
        ) : null}
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-3">
        {err ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {err}
          </div>
        ) : null}
        {loading ? (
          <p className="text-slate-500">Cargando catálogo tránsito…</p>
        ) : showArticulosTab ? (
          <>
            <div className={tab !== "operativa" ? "hidden" : undefined} aria-hidden={tab !== "operativa"}>
              <StockTransitoOperativaTab resumen={resumenInicial} vista={vista} />
            </div>
            <div className={tab !== "articulos" ? "hidden" : undefined} aria-hidden={tab !== "articulos"}>
              <TabArticulosTransito />
            </div>
          </>
        ) : (
          <StockTransitoOperativaTab resumen={resumenInicial} vista={vista} />
        )}
      </div>
    </div>
  );
}

export function StockTransitoClient({ resumenInicial, vista }: Props) {
  return (
    <StockTransitoProvider>
      <StockTransitoShell resumenInicial={resumenInicial} vista={vista} />
    </StockTransitoProvider>
  );
}
