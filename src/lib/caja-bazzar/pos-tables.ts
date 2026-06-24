/** Tablas POS Bazzar — bandeja cajero vs Bobeda ORO */

export const TABLA_BANDEJA = "ticket_bandeja_cajero";
export const TABLA_BOBINA = "bobeda_venta_pos";
export const TABLA_LEGACY = "ticket_venta_pos";

export type FuentePos = "bandeja" | "bobeda" | "legacy";

export function fuentePorEstadoApi(estado: string | null | undefined): FuentePos {
  const e = estado?.trim().toUpperCase() ?? "";
  if (!e) return "bandeja";
  if (e === "FACTURADO" || e === "PENDIENTE_ENTREGA" || e === "ENTREGADO" || e === "ANULADO") {
    return "bobeda";
  }
  if (e === "EMITIDO" || e === "PENDIENTE_CAJA" || e === "CSV_DESCARGADO" || e === "ARCHIVADO") {
    return "bandeja";
  }
  return "bandeja";
}

/** Estados BD para filtro según fuente y parámetro API */
export function estadosFiltroBd(fuente: FuentePos, estadoApi: string | null | undefined): string[] | null {
  const e = estadoApi?.trim().toUpperCase() ?? "";
  if (fuente === "bandeja") {
    if (e === "EMITIDO" || e === "PENDIENTE_CAJA") return ["PENDIENTE_CAJA", "CSV_DESCARGADO"];
    if (e === "CSV_DESCARGADO") return ["CSV_DESCARGADO"];
    if (e) return [e];
    return ["PENDIENTE_CAJA", "CSV_DESCARGADO"];
  }
  if (fuente === "bobeda") {
    if (e === "FACTURADO" || e === "PENDIENTE_ENTREGA") return ["PENDIENTE_ENTREGA"];
    if (e === "ENTREGADO") return ["ENTREGADO"];
    if (e) return [e];
    return null;
  }
  if (e) return [e];
  return null;
}

export function codigoColumn(fuente: FuentePos): string {
  if (fuente === "bandeja") return "codigo_bandeja";
  if (fuente === "bobeda") return "codigo_oro";
  return "codigo_ticket";
}

export function estadoUiDesdeBd(fuente: FuentePos, estadoBd: string): string {
  const e = estadoBd.toUpperCase();
  if (fuente === "bandeja") {
    if (e === "PENDIENTE_CAJA" || e === "CSV_DESCARGADO") return e === "CSV_DESCARGADO" ? "CSV_DESCARGADO" : "PENDIENTE_CAJA";
    return estadoBd;
  }
  if (fuente === "bobeda") {
    if (e === "PENDIENTE_ENTREGA") return "PENDIENTE_ENTREGA";
    return estadoBd;
  }
  return estadoBd;
}
