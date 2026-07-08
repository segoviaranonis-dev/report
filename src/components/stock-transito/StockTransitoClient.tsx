"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { BibliotecaCasoBar } from "@/app/depositos-bazzar/components/operativa/BibliotecaCasoBar";
import { TrianguloHeaderDeposito } from "@/app/depositos-bazzar/components/operativa/TrianguloHeaderDeposito";
import { GrillaPeImportadora } from "@/components/stock-pronta-entrega/GrillaPeImportadora";
import { FiltroLlegadaMulti } from "@/components/stock-transito/FiltroLlegadaMulti";
import { TransitoVentasVitales } from "@/components/stock-transito/TransitoVentasVitales";
import { StockTransitoProvider, useStockTransito } from "@/components/stock-transito/StockTransitoContext";
import {
  buildLineaCasoMap,
  lookupCasoLinea,
  type CasoBibliotecaLite,
} from "@/lib/depositos/caso-biblioteca";
import type { StockTransitoResumen } from "@/lib/stock-transito/queries-resumen";
import { resolveTransitoVitales } from "@/lib/stock-transito/vitales-canonicos";
import { COLORES_ESTANDAR_DEFAULT } from "@/lib/pilares/colores-estandar";

type Props = {
  resumenInicial: StockTransitoResumen;
};

function StockTransitoOperativaTab({ resumen }: { resumen: StockTransitoResumen }) {
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
  } = useStockTransito();

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

  return (
    <div className="space-y-3">
      <BibliotecaCasoBar
        indiceApiPath="/api/stock-transito/filtros-indice"
        bibliotecaId={bibliotecaId}
        casoActivo={casoActivo}
        onBibliotecaChange={setBibliotecaId}
        onCasoChange={setCasoActivo}
        onCasosLoaded={onCasosLoaded}
      />
      <TrianguloHeaderDeposito
        filtros={filtros}
        onChange={setFiltros}
        opciones={opciones}
        tonoCatalog={COLORES_ESTANDAR_DEFAULT}
        totalProductos={cardsCount}
        totalPares={totalPares}
        valorInventario={valorInventario}
        gradaVariant="importadora"
        filtersDefaultOpen={false}
        hideVitalesHero
        hideProductosVital
        categoriaEnCabecera
        summaryLayout="vitales-first"
        summaryTrailing={
          <TransitoVentasVitales
            paresInicial={vitales.inicial}
            paresVendidos={vitales.vendidos}
            paresSaldo={vitales.saldo}
            valorInventario={valorInventario}
            modo={vitales.modo}
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
      />
      <GrillaPeImportadora
        productos={filtradasGrid}
        casoPorLinea={lineaCasoMap}
        showLlegada
        showVentas
      />
    </div>
  );
}

function StockTransitoShell({ resumenInicial }: Props) {
  const { loading, err } = useStockTransito();

  return (
    <div className="pb-8">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <Link href="/rimec?mundo=panel-control" className="text-sm text-rimec-azul hover:underline">
              ← Panel de Control
            </Link>
            <h1 className="font-serif text-lg font-semibold text-slate-900">
              Stock en Tránsito · Compra Previa
            </h1>
            <span className="text-xs text-slate-500">
              {resumenInicial.pedidos_pp} PP · estrategia ventas RIMEC Web
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-3">
        {err ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {err}
          </div>
        ) : null}
        {loading ? (
          <p className="text-slate-500">Cargando catálogo tránsito…</p>
        ) : (
          <StockTransitoOperativaTab resumen={resumenInicial} />
        )}
      </div>
    </div>
  );
}

export function StockTransitoClient({ resumenInicial }: Props) {
  return (
    <StockTransitoProvider>
      <StockTransitoShell resumenInicial={resumenInicial} />
    </StockTransitoProvider>
  );
}
