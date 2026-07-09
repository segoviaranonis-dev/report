import { DepositoRimecShell } from "@/app/deposito-rimec/components/DepositoRimecShell";
import { StockProntaEntregaClient } from "@/components/stock-pronta-entrega/StockProntaEntregaClient";
import {
  EMPTY_STOCK_PE_RESUMEN,
  getStockProntaEntregaResumen,
} from "@/lib/stock-pronta-entrega/queries-resumen";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export const dynamic = "force-dynamic";

export default async function StockProntaEntregaPage() {
  const resumen = isRimecDatabaseConfigured()
    ? await getStockProntaEntregaResumen(getRimecPool(), {})
    : EMPTY_STOCK_PE_RESUMEN;

  return (
    <DepositoRimecShell footer="Stock Pronta Entrega · sdrm0831 · Operativo Alejandro Magno · Cabeza 1">
      <StockProntaEntregaClient resumenInicial={resumen} />
    </DepositoRimecShell>
  );
}
