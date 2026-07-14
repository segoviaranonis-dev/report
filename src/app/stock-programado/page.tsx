import { DepositoRimecShell } from "@/app/deposito-rimec/components/DepositoRimecShell";
import { StockProgramadoClient } from "@/components/stock-programado/StockProgramadoClient";
import { getStockProgramadoResumen } from "@/lib/stock-programado/queries-resumen";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export const dynamic = "force-dynamic";

const EMPTY_RESUMEN = {
  pedidos_pp: 0,
  moleculas: 0,
  pares_inicial: 0,
  pares_vendidos: 0,
  pares_saldo: 0,
  por_quincena: [],
  por_proforma: [],
};

export default async function StockProgramadoPage({
  searchParams,
}: {
  searchParams: Promise<{ proforma?: string }>;
}) {
  const { proforma } = await searchParams;
  const resumen = isRimecDatabaseConfigured()
    ? await getStockProgramadoResumen(getRimecPool())
    : EMPTY_RESUMEN;

  return (
    <DepositoRimecShell footer="Stock Programado · categoría 3 · Alejandro Magno">
      <StockProgramadoClient resumenInicial={resumen} proformaInicial={proforma ?? null} />
    </DepositoRimecShell>
  );
}
