import { FacturacionBandejaClient } from "../components/FacturacionBandejaClient";
import { TERMINO_FI } from "@/lib/facturacion/types";

export const dynamic = "force-dynamic";

export default function FacturacionProntaEntregaPage() {
  return (
    <FacturacionBandejaClient
      origen="pronta-entrega"
      titulo="Facturación Pronta entrega"
      subtitulo={`Bandeja de entrada PE · hoy y lo más reciente arriba · al terminar el legal de Carlos: PROCESAR (sale de bandeja → bóveda RIMEC). ${TERMINO_FI} con pp_id al PP PE · traspaso Web Bazar (5000).`}
      badgeOrigen="STOCK_IMPORTADO"
      groupByDate
      footerNote="Facturación Pronta entrega · 2.3.1.9.B · STOCK_IMPORTADO · PPD"
    />
  );
}
