import { FacturacionBandejaClient } from "../components/FacturacionBandejaClient";
import { TERMINO_FI } from "@/lib/facturacion/types";

export const dynamic = "force-dynamic";

export default function FacturacionProntaEntregaPage() {
  return (
    <FacturacionBandejaClient
      origen="pronta-entrega"
      titulo="Facturación Pronta entrega"
      subtitulo={`Ventas PE agrupadas por fecha · ${TERMINO_FI} enlazada a pedido_proveedor_detalle (import CSV / stock local). Sin Compra Legal · traspaso directo a Web Bazar (5000). Misma Ley FI que Programado.`}
      badgeOrigen="STOCK_IMPORTADO"
      groupByDate
      footerNote="Facturación Pronta entrega · 2.3.1.9.B · STOCK_IMPORTADO · PPD"
    />
  );
}
