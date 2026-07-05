import { DepositoRimecShell } from "../components/DepositoRimecShell";
import { DepositoRimecStockClient } from "../components/DepositoRimecStockClient";

export const dynamic = "force-dynamic";

export default function DepositoProcesoPage() {
  return (
    <DepositoRimecShell footer="Depósito RIMEC · Stock del proceso · PROCESO_PP">
      <DepositoRimecStockClient
        apiPath="/api/deposito-rimec/proceso/productos"
        titulo="Stock del proceso"
        subtitulo="Saldo Pedido Proveedor · grilla cajas (canon tablet)."
        badgeClass="bg-rimec-celeste-bg text-rimec-azul-dark"
        badgeLabel="origen PROCESO_PP"
      />
    </DepositoRimecShell>
  );
}
