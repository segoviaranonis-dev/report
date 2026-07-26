import { FacturacionBandejaClient } from "../components/FacturacionBandejaClient";
import { TERMINO_FI } from "@/lib/facturacion/types";

export const dynamic = "force-dynamic";

export default function FacturacionProntaEntregaPage() {
  return (
    <FacturacionBandejaClient
      origen="pronta-entrega"
      titulo="Facturación Pronta entrega"
      subtitulo={`Ventas PE agrupadas por Fecha de llegada / entrega cliente · ${TERMINO_FI} con pp_id al PP PE · sin Compra Legal · traspaso Web Bazar (5000).`}
      badgeOrigen="STOCK_IMPORTADO"
      groupByDate
      footerNote="Facturación Pronta entrega · 2.3.1.9.B · STOCK_IMPORTADO · PPD"
    />
  );
}
