"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { BibliotecaCasoBar } from "@/app/depositos-bazzar/components/operativa/BibliotecaCasoBar";
import { TrianguloHeaderDeposito } from "@/app/depositos-bazzar/components/operativa/TrianguloHeaderDeposito";
import { GrillaPeImportadora } from "@/components/stock-pronta-entrega/GrillaPeImportadora";
import { ProgramadoVentasVitales } from "@/components/stock-programado/ProgramadoVentasVitales";
import {
  StockProgramadoProvider,
  useStockProgramado,
} from "@/components/stock-programado/StockProgramadoContext";
import { FiltroLlegadaMulti } from "@/components/stock-transito/FiltroLlegadaMulti";
import {
  buildLineaCasoMap,
  lookupCasoLinea,
  type CasoBibliotecaLite,
} from "@/lib/depositos/caso-biblioteca";
import { resolveProgramadoVitales } from "@/lib/stock-programado/programado-vitales-canonicos";
import type { StockProgramadoResumen } from "@/lib/stock-programado/queries-resumen";
import { COLORES_ESTANDAR_DEFAULT } from "@/lib/pilares/colores-estandar";

type Props = {
  resumenInicial: StockProgramadoResumen;
};

function StockProgramadoOperativaTab({ resumen }: { resumen: StockProgramadoResumen }) {
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
  } = useStockProgramado();

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
      resolveProgramadoVitales({
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
        indiceApiPath="/api/stock-programado/filtros-indice"
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
          <ProgramadoVentasVitales
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

function StockProgramadoShell({ resumenInicial }: Props) {
  const { loading, err } = useStockProgramado();

  return (
    <div className="pb-8">
      <div className="border-b border-amber-200/60 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <Link href="/rimec?mundo=panel-control" className="text-sm text-rimec-azul hover:underline">
              ← Panel de Control
            </Link>
            <span className="inline-block rounded bg-amber-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              Programado
            </span>
            <h1 className="font-serif text-lg font-semibold text-amber-950">Stock Programado</h1>
            <span className="text-xs text-slate-500">
              {resumenInicial.pedidos_pp} PP · sin catálogo RIMEC Web
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
          <p className="text-slate-500">Cargando catálogo programado…</p>
        ) : (
          <StockProgramadoOperativaTab resumen={resumenInicial} />
        )}
      </div>
    </div>
  );
}

export function StockProgramadoClient({ resumenInicial }: Props) {
  return (
    <StockProgramadoProvider>
      <StockProgramadoShell resumenInicial={resumenInicial} />
    </StockProgramadoProvider>
  );
}
