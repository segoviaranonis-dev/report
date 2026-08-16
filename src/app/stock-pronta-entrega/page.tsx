import { DepositoRimecShell } from "@/app/deposito-rimec/components/DepositoRimecShell";
import { StockProntaEntregaClient } from "@/components/stock-pronta-entrega/StockProntaEntregaClient";
import { EMPTY_STOCK_PE_RESUMEN } from "@/lib/stock-pronta-entrega/queries-resumen";

export const dynamic = "force-dynamic";

/**
 * Resumen SSR vacío a propósito: no bloquea TTFB con query pesada.
 * KPIs se refrescan en cliente; grilla = /api/.../productos (cache 90s + SWR).
 */
export default async function StockProntaEntregaPage() {
  return (
    <DepositoRimecShell footer="Stock Pronta Entrega · Alejandro Magno">
      <StockProntaEntregaClient resumenInicial={EMPTY_STOCK_PE_RESUMEN} />
    </DepositoRimecShell>
  );
}
