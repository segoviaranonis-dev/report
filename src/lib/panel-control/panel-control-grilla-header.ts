import { COLORES_ESTANDAR_DEFAULT } from "@/lib/pilares/colores-estandar";

/**
 * CABECERA DE FILTROS — contrato obligatorio Panel de Control Alejandro Magno.
 *
 * Toda ruta con grilla de moléculas desde `/rimec?mundo=panel-control`:
 * - `/stock-pronta-entrega`
 * - `/stock-transito` (+ `/disponible` · `/ventas`)
 * - `/stock-programado`
 *
 * Componente UI: `PanelControlTrianguloHeader` → `TrianguloHeaderDeposito`.
 * Spec: `report/src/components/panel-control/PANEL_CONTROL_GRILLA_HEADER.md`
 * Moria: CABECERA_DE_FILTROS · TRIANGULO_HEADER_PILARES (3.2.00.001)
 */
export const PANEL_CONTROL_GRILLA_HEADER = {
  gradaVariant: "importadora" as const,
  filtersDefaultOpen: false,
  hideVitalesHero: true,
  hideProductosVital: true,
  categoriaEnCabecera: true,
  summaryLayout: "vitales-first" as const,
  tonoCatalog: COLORES_ESTANDAR_DEFAULT,
} as const;

export const PANEL_CONTROL_GRILLA_ROUTES = [
  "/stock-pronta-entrega",
  "/stock-transito",
  "/stock-transito/disponible",
  "/stock-transito/ventas",
  "/stock-programado",
] as const;
