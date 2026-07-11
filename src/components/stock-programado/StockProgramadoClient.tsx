"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { PanelControlGrillaStack } from "@/components/panel-control/PanelControlGrillaStack";
import { ProgramadoVentasVitales } from "@/components/stock-programado/ProgramadoVentasVitales";
import { TabArticulosProgramado } from "@/components/stock-programado/TabArticulosProgramado";
import {
  StockProgramadoProvider,
  useStockProgramado,
} from "@/components/stock-programado/StockProgramadoContext";
import { FiltroLlegadaMulti } from "@/components/stock-transito/FiltroLlegadaMulti";
import {
  buildLineaCasoMap,
  filterRowsByCasoActivo,
  type CasoBibliotecaLite,
} from "@/lib/depositos/caso-biblioteca";
import { resolveProgramadoVitales } from "@/lib/stock-programado/programado-vitales-canonicos";
import type { StockProgramadoResumen } from "@/lib/stock-programado/queries-resumen";

type Props = {
  resumenInicial: StockProgramadoResumen;
};

const fmtN = (n: number) => new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(n);

function ResumenKpiBar({ resumen }: { resumen: StockProgramadoResumen }) {
  return (
    <dl className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-amber-200/60 bg-amber-50/50 p-4 text-center text-sm sm:grid-cols-4">
      <div>
        <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">PP programado</dt>
        <dd className="font-serif text-lg font-semibold tabular-nums text-amber-950">{resumen.pedidos_pp}</dd>
      </div>
      <div>
        <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Inicial</dt>
        <dd className="font-serif text-lg font-semibold tabular-nums text-slate-900">{fmtN(resumen.pares_inicial)}</dd>
      </div>
      <div>
        <dt className="text-[10px] font-bold uppercase tracking-wide text-rose-700">Vendido</dt>
        <dd className="font-serif text-lg font-semibold tabular-nums text-rose-800">{fmtN(resumen.pares_vendidos)}</dd>
      </div>
      <div>
        <dt className="text-[10px] font-bold uppercase tracking-wide text-amber-800">Saldo</dt>
        <dd className="font-serif text-lg font-semibold tabular-nums text-amber-900">{fmtN(resumen.pares_saldo)}</dd>
      </div>
    </dl>
  );
}

function StockProgramadoOperativaTab({ resumen }: { resumen: StockProgramadoResumen }) {
  const {
    loading,
    filtros,
    setFiltros,
    opciones,
    cardsCount,
    totalPares,
    valorInventario,
    filtradas,
    quincenaIds,
    setQuincenaIds,
    rows,
  } = useStockProgramado();

  const [bibliotecaId, setBibliotecaId] = useState<number | null>(null);
  const [casoActivo, setCasoActivo] = useState<string | null>(null);
  const [lineaCasoMap, setLineaCasoMap] = useState<Map<string, string>>(() => new Map());

  const onCasosLoaded = useCallback((casos: CasoBibliotecaLite[]) => {
    setLineaCasoMap(buildLineaCasoMap(casos));
  }, []);

  const filtradasGrid = useMemo(
    () => filterRowsByCasoActivo(filtradas, casoActivo, lineaCasoMap),
    [filtradas, casoActivo, lineaCasoMap],
  );

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

  if (!loading && rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/40 px-4 py-10 text-center text-sm text-amber-950">
        Sin moléculas programado en PPD. Importá proforma en{" "}
        <Link href="/proceso-importacion/pedido-proveedor?ramo=programado" className="font-semibold underline">
          Pedido proveedor
        </Link>{" "}
        (ej. PP-16) para poblar la grilla.
      </div>
    );
  }

  return (
    <PanelControlGrillaStack
      bibliotecaIndicePath="/api/stock-programado/filtros-indice"
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
      productos={filtradasGrid}
      casoPorLinea={lineaCasoMap}
      grilla={{ showLlegada: true, showVentas: true, loteModo: "unitario" }}
      footer={
        <p className="text-center text-[10px] text-slate-400">
          Programado · PPD cat. 3 · filtro Llegada = FECHA DE EMBARQUE (quincena_arribo_id)
        </p>
      }
    />
  );
}

function StockProgramadoShell({ resumenInicial }: Props) {
  const [tab, setTab] = useState<"operativa" | "articulos">("operativa");
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
              {resumenInicial.pedidos_pp} PP · cabecera estándar + grilla · sin RIMEC Web
            </span>
          </div>
          <Link
            href="/proceso-importacion/pedido-proveedor?ramo=programado"
            className="text-xs font-semibold text-rimec-azul hover:underline"
          >
            Pedidos proveedor →
          </Link>
        </div>
        <div className="mx-auto flex max-w-7xl gap-2 border-t border-slate-100 px-4">
          {(["operativa", "articulos"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-semibold capitalize ${
                tab === t
                  ? "border-b-2 border-amber-600 text-amber-900"
                  : "text-slate-500"
              }`}
            >
              {t === "operativa" ? "Operativa" : "Artículos"}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-3">
        <ResumenKpiBar resumen={resumenInicial} />
        {err ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
        ) : null}
        {loading ? (
          <p className="text-slate-500">Cargando catálogo programado…</p>
        ) : (
          <>
            <div className={tab !== "operativa" ? "hidden" : undefined} aria-hidden={tab !== "operativa"}>
              <StockProgramadoOperativaTab resumen={resumenInicial} />
            </div>
            <div className={tab !== "articulos" ? "hidden" : undefined} aria-hidden={tab !== "articulos"}>
              <TabArticulosProgramado />
            </div>
          </>
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
