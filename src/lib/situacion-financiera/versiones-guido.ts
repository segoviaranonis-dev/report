/** Catálogo de pestañas Sit Fin · versiones Guido (CONTEXTO) + Nexus · 2.3.1.50.6 */

export type SfTabId =
  | "excel-al"
  | "guido-html-roles"
  | "guido-html-excel"
  | "guido-cuadro"
  | "guido-cobros"
  | "graficos"
  | "auditoria"
  | "nexus";

export type SfTabMeta = {
  id: SfTabId;
  label: string;
  short: string;
  desc: string;
  fuenteGuido: string;
};

/** Orden de pestañas: no se elimina ninguna versión. */
export const SF_TABS: SfTabMeta[] = [
  {
    id: "excel-al",
    label: "Excel AL 03-08",
    short: "Excel",
    desc: "Réplica hoja SIT FIN del Excel objetivo SF AL 03-08.xlsx",
    fuenteGuido: "Plantilla Excel · informe_situacion_excel / SF AL",
  },
  {
    id: "guido-html-roles",
    label: "Guido HTML · roles",
    short: "HTML v1",
    desc: "Informe HTML editable: verde AUTO · naranja MANUAL · lila PENDIENTE · amarillo CALC",
    fuenteGuido: "informe_situacion_financiera.py (1ª plantilla roles)",
  },
  {
    id: "guido-html-excel",
    label: "Guido HTML · look Excel",
    short: "HTML v2",
    desc: "Rediseño Times + grilla + mescol · 'tal cual el Excel/PDF'",
    fuenteGuido: "informe_situacion_financiera.py (REDISEÑO TAL CUAL EL EXCEL)",
  },
  {
    id: "guido-cuadro",
    label: "Guido · Cuadro vencimientos",
    short: "Cuadro",
    desc: "Pivote tipo cobro × meses/buckets · detalle auditable",
    fuenteGuido: "cuadro_vencimientos_html.py",
  },
  {
    id: "guido-cobros",
    label: "Guido · Análisis cobros",
    short: "Cobros",
    desc: "Pivote previsto × cobrado · líquido efvo+transf",
    fuenteGuido: "analisis_cobros.py",
  },
  {
    id: "graficos",
    label: "Gráficos",
    short: "Charts",
    desc: "Saldo disponible, cheques, aging y composición — vista gerencial",
    fuenteGuido: "Nexus · datos Excel AL + pipeline LAB",
  },
  {
    id: "auditoria",
    label: "Auditoría mapa",
    short: "Audit",
    desc: "Cruce Excel vs TXT limpio · canon · descuadres",
    fuenteGuido: "audit-mapa-al-0308 · mapa-canon-al-0308",
  },
  {
    id: "nexus",
    label: "Vista Nexus",
    short: "Nexus",
    desc: "Ciclo económico importadora + bloques pipeline (hub)",
    fuenteGuido: "Módulo hub Report 2.3.1.50.5",
  },
];
