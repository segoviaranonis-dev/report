import { DepositoRimecShell } from "@/app/deposito-rimec/components/DepositoRimecShell";
import { StockProntaEntregaClient } from "@/components/stock-pronta-entrega/StockProntaEntregaClient";
import { getStockProntaEntregaResumen } from "@/lib/stock-pronta-entrega/queries-resumen";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export const dynamic = "force-dynamic";

export default async function StockProntaEntregaPage() {
  const resumen =
    isRimecDatabaseConfigured()
      ? await getStockProntaEntregaResumen(getRimecPool(), {})
      : {
          batch_label: "—",
          fecha_importacion: null,
          filas: 0,
          skus: 0,
          uds_total: 0,
          uds_inicial: 0,
          uds_vendidas: 0,
          monto_gs: 0,
          calzado: { tipo_v2_id: 1, label: "CALZADO", uds: 0, filas: 0, monto_gs: 0 },
          confecciones: { tipo_v2_id: 2, label: "CONFECCIONES", uds: 0, filas: 0, monto_gs: 0 },
          por_deposito: [],
          violacion: "HIEDRA_VENENOSA_PE" as const,
          origen: "pedido_proveedor_detalle" as const,
        };

  return (
    <DepositoRimecShell footer="Stock Pronta Entrega · sdrm0831 · Operativo Alejandro Magno · Cabeza 1">
      <StockProntaEntregaClient resumenInicial={resumen} />
    </DepositoRimecShell>
  );
}
