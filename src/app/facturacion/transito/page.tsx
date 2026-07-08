import { FacturacionBandejaClient } from "../components/FacturacionBandejaClient";
import { TERMINO_FI } from "@/lib/facturacion/types";

export const dynamic = "force-dynamic";

export default function FacturacionTransitoPage() {
  return (
    <FacturacionBandejaClient
      origen="transito"
      titulo="Facturación de proceso"
      subtitulo={`${TERMINO_FI} en tránsito · Compra previa / Compra Legal · distribución a sucursales y cliente 5000 (Bazzar.py). Enlazada a PP + PPD del ciclo de compra.`}
      badgeOrigen="PROCESO_PP"
      footerNote="Facturación tránsito · 2.3.1.9.A · PROCESO_PP"
    />
  );
}
