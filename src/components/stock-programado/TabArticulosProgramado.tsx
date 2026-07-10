"use client";

import { DepositoChartSection } from "@/app/depositos-bazzar/components/DepositoChartSection";
import { EstiloTonoDrillSection } from "@/app/depositos-bazzar/components/EstiloTonoDrillSection";
import { FiltrosArticulosBarView } from "@/app/depositos-bazzar/components/FiltrosArticulosBar";
import { GradaChartSection } from "@/app/depositos-bazzar/components/GradaChartSection";
import { MarcaEstiloDrillSection } from "@/app/depositos-bazzar/components/MarcaEstiloDrillSection";
import { useStockProgramado } from "@/components/stock-programado/StockProgramadoContext";

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-amber-200/80 bg-white p-3 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wide text-amber-900/70">{label}</p>
      <p className="mt-1 text-lg font-black tabular-nums text-amber-950">{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p> : null}
    </div>
  );
}

/** Tab Artículos · paridad PE/CP · agregados pilares sobre vista filtrada. */
export function TabArticulosProgramado() {
  const {
    loading,
    err,
    drill,
    estiloMarcaDrill,
    porMarca,
    porEstilo,
    porTono,
    porGrada,
    totalPares,
    totalInicial,
    totalVendidos,
    tonoCatalog,
    filtros,
    setFiltros,
    opciones,
    cardsCount,
  } = useStockProgramado();

  if (loading || err) return null;

  const ente = "Programado · Alejandro Magno";

  return (
    <div className="space-y-4 pb-6">
      <FiltrosArticulosBarView
        tonoCatalog={tonoCatalog}
        filtros={filtros}
        setFiltros={setFiltros}
        opciones={opciones}
        totalPares={totalPares}
        cardsCount={cardsCount}
      />

      <p className="text-xs text-slate-600">
        Vista filtrada ·{" "}
        <span className="font-bold tabular-nums text-amber-900">
          {totalPares.toLocaleString("es-PY")} p saldo
        </span>
        {" · "}
        <span className="tabular-nums text-rose-700">{totalVendidos.toLocaleString("es-PY")} p vendidos</span>
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Pares saldo" value={`${totalPares.toLocaleString("es-PY")} p`} sub="vista filtrada" />
        <KpiCard label="Inicial vista" value={`${totalInicial.toLocaleString("es-PY")} p`} sub="importado" />
        <KpiCard label="Marcas" value={String(porMarca.length)} sub="módulo 01" />
        <KpiCard label="Estilos · tono" value={String(drill.length)} sub="módulo 02" />
        <KpiCard label="Gradas curva" value={String(porGrada.length)} sub="módulo 06" />
      </div>

      <DepositoChartSection
        index={1}
        title={`${ente} · Marcas`}
        subtitle="Distribución por marca · PPD categoría 3"
        slices={porMarca}
        totalPares={totalPares}
        defaultOpen
      />

      <EstiloTonoDrillSection index={2} drill={drill} defaultOpen />

      <MarcaEstiloDrillSection index={3} drill={estiloMarcaDrill} />

      <DepositoChartSection
        index={4}
        title="Por estilo"
        subtitle="Estilos en la vista filtrada"
        slices={porEstilo}
        totalPares={totalPares}
      />

      <DepositoChartSection
        index={5}
        title={`${ente} · Tonos`}
        subtitle="Torta de tonos (vista filtrada)"
        slices={porTono}
        totalPares={totalPares}
      />

      <GradaChartSection
        index={6}
        title={`${ente} · Gradas`}
        subtitle="Curvas importadora · cantidad y %"
        slices={porGrada}
        totalPares={totalPares}
      />
    </div>
  );
}
