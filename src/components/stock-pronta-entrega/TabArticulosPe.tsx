"use client";

import { useStockPe } from "./StockPeContext";
import { DepositoChartSection } from "@/app/depositos-bazzar/components/DepositoChartSection";
import { EstiloTonoDrillSection } from "@/app/depositos-bazzar/components/EstiloTonoDrillSection";
import { FiltrosArticulosBarView } from "@/app/depositos-bazzar/components/FiltrosArticulosBar";
import { GradaChartSection } from "@/app/depositos-bazzar/components/GradaChartSection";
import { MarcaEstiloDrillSection } from "@/app/depositos-bazzar/components/MarcaEstiloDrillSection";

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-report-rule bg-white p-3 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wide text-report-muted">{label}</p>
      <p className="mt-1 text-lg font-black tabular-nums text-bazzar-naranja-dark">{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-report-muted">{sub}</p> : null}
    </div>
  );
}

export function TabArticulosPe() {
  const {
    loading,
    err,
    ente,
    drill,
    estiloMarcaDrill,
    porMarca,
    porEstilo,
    porTono,
    porGrada,
    totalPares,
    tonoCatalog,
    filtros,
    setFiltros,
    opciones,
    cardsCount,
  } = useStockPe();

  if (loading || err) return null;

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

      <p className="text-xs text-report-muted">
        Vista filtrada ·{" "}
        <span className="font-bold tabular-nums text-bazzar-naranja">
          {totalPares.toLocaleString("es-PY")} p
        </span>
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          label="Pares vista"
          value={`${totalPares.toLocaleString("es-PY")} p`}
          sub="stock PE filtrado"
        />
        <KpiCard label="Marcas" value={String(porMarca.length)} sub="módulo 01" />
        <KpiCard label="Estilos · tono" value={String(drill.length)} sub="módulo 02" />
        <KpiCard label="Estilos · marca" value={String(estiloMarcaDrill.length)} sub="módulo 03" />
        <KpiCard label="Gradas curva" value={String(porGrada.length)} sub="módulo 06" />
      </div>

      <DepositoChartSection
        index={1}
        title={`${ente} · Marcas`}
        subtitle="Pronta entrega · distribución por marca"
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
