/** Catálogo de pestañas Sit Fin · versiones Guido · ISLA 2.3.1.50.12 */

export type SfTabId =
  | "excel-al"
  | "guido-html-roles"
  | "guido-html-excel"
  | "guido-cuadro"
  | "guido-cobros"
  | "graficos"
  | "auditoria"
  | "absorcion"
  | "ratios"
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
    fuenteGuido: "Sit Fin isla · Excel AL + pipeline LAB propio",
  },
  {
    id: "auditoria",
    label: "Auditoría mapa",
    short: "Audit",
    desc: "Cruce Excel vs TXT limpio · canon · descuadres · gate isla",
    fuenteGuido: "audit-mapa-al-0308 · mapa-canon-al-0308",
  },
  {
    id: "absorcion",
    label: "Absorción · norte (LAB)",
    short: "Norte",
    desc: "LAB · no alimenta Sit Fin isla · norte caja primero",
    fuenteGuido: "NORTE_ABSORCION_SF · ISLA 2.3.1.50.12",
  },
  {
    id: "ratios",
    label: "Ratios (LAB)",
    short: "Ratios",
    desc: "LAB · bloqueados · sin resultados Nexus operativos",
    fuenteGuido: "ratios-motor.ts · ISLA",
  },
  {
    id: "nexus",
    label: "Vista pipeline (LAB)",
    short: "Pipeline",
    desc: "Demo/pipeline local isla — no es integración Nexus operativa",
    fuenteGuido: "demo-corte-al · ISLA 2.3.1.50.12",
  },
];
