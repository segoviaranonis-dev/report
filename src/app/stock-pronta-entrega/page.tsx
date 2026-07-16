import { DepositoRimecShell } from "@/app/deposito-rimec/components/DepositoRimecShell";
import { StockProntaEntregaClient } from "@/components/stock-pronta-entrega/StockProntaEntregaClient";
import {
  EMPTY_STOCK_PE_RESUMEN,
  getStockProntaEntregaResumen,
} from "@/lib/stock-pronta-entrega/queries-resumen";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export const dynamic = "force-dynamic";

export default async function StockProntaEntregaPage() {
  let resumen = EMPTY_STOCK_PE_RESUMEN;
  if (isRimecDatabaseConfigured()) {
    try {
      resumen = await getStockProntaEntregaResumen(getRimecPool(), {});
    } catch (e) {
      console.error("[stock-pronta-entrega] resumen SSR", e);
    }
  }

  return (
    <DepositoRimecShell footer={`Stock Pronta Entrega · batch ${resumen.batch_label} · Alejandro Magno`}>
      <StockProntaEntregaClient resumenInicial={resumen} />
    </DepositoRimecShell>
  );
}
