/**
 * Protocolo hermanos siameses — extensión Bazzar Web.
 * Pareja: Depósito Web (Report) ↔ Catálogo tienda (bazzar-web).
 * Ley madre Tipo: CHUSAR 2.2.1.18 (AM ↔ RIMEC Web) + diccionario PE.
 */
import type { SiamesesPayload } from "./types";

export function getSiamesesBazzarWeb(): SiamesesPayload {
  return {
    pareja: {
      a: {
        nombre: "Depósito Web",
        app: "Report",
        ruta: "/bazzar-web/deposito-web",
      },
      b: {
        nombre: "Catálogo tienda",
        app: "Bazzar Web",
        ruta: "http://localhost:3002/catalogo",
      },
    },
    prioridad: [
      "Liquidación (es_liquidacion / LIQUIDACION)",
      "Promo (es_promo / PROMOCIONAL)",
      "Normal / Carteras / COMUN (diccionario COD.GRUPO)",
    ],
    ley:
      "Misma prioridad Tipo · badge = filtro · si se repara en Depósito Web, alinear tienda en el mismo turno (y al revés). Imagen 654/638: Ley 2.01.04.021.",
    items: [
      {
        id: "tabs-tipo",
        label: "Tabs Tipo siameses (TODOS · NORMAL · PROMO · LIQ · COMUN)",
        estado: "PASS",
        detalle:
          "Depósito Web usa DiccionarioPeBar + filtro-tipo-pe-diccionario (paridad Stock PE)",
        ruta: "report/.../DepositoWebClient.tsx",
      },
      {
        id: "vendible-filter",
        label: "Tienda solo vendible (SANO + precio>0 + stock>0)",
        estado: "PASS",
        detalle: "bazzar-web/lib/catalogo-vendible.ts · soloVendibleCatalogo()",
        ruta: "bazzar-web/lib/catalogo-vendible.ts",
      },
      {
        id: "canon-tipo",
        label: "Módulo canónico Tipo (holding)",
        estado: "INFO",
        detalle:
          "AM ↔ RIMEC Web: filtro-tipo-canonico.ts · Bazzar usa diccionario PE en Depósito",
        ruta: "report/src/lib/filtros/filtro-tipo-canonico.ts",
      },
      {
        id: "imagen-dual",
        label: "Imagen dual 654 / 638",
        estado: "PASS",
        detalle:
          "654 L-R-M-C · 638 L_colorExcel (color_nombre) · contain NIIF",
        ruta: "bazzar-web/lib/product-image.ts",
      },
      {
        id: "grilla",
        label: "Grilla caja abierta (talla suelta)",
        estado: "PASS",
        detalle:
          "Depósito: GrillaPeImportadora · Tienda: ProductoCard tallas clicables",
      },
      {
        id: "prohibido",
        label: "Prohibido divergir sin deuda",
        estado: "INFO",
        detalle:
          "Regla Cursor hermanos-siameses-filtro-tipo.mdc · doc 2.2.1.18 + este CHUSAR 2.5.1.6",
      },
    ],
    modulos_canonicos: [
      {
        label: "Filtro Tipo canónico (AM/Web)",
        path: "report/src/lib/filtros/filtro-tipo-canonico.ts",
      },
      {
        label: "Diccionario PE Tipo",
        path: "report/src/lib/stock-pronta-entrega/filtro-tipo-pe-diccionario.ts",
      },
      {
        label: "Depósito Web client",
        path: "report/src/app/bazzar-web/deposito-web/components/DepositoWebClient.tsx",
      },
      {
        label: "Catálogo vendible tienda",
        path: "bazzar-web/lib/catalogo-vendible.ts",
      },
      {
        label: "CHUSAR siameses Tipo",
        path: ".claude/2_modulos/2.2_rimec_web/CHUSAR_FILTRO_TIPO_HERMANOS_SIAMESES_20260720.md",
      },
    ],
  };
}
