import { IMPORTACION_PRECIOS, IMPORTACION_PRECIOS_NUEVO } from "@/lib/report/routes";

export const IMPORTACION_PASOS = [
  { paso: 0, slug: "", label: "Carga", desc: "Excel proveedor · ley género · sesión de trabajo" },
  { paso: 1, slug: "memoria", label: "Memoria", desc: "Biblioteca de casos para este listado" },
  { paso: 2, slug: "preview", label: "Preview", desc: "Excel × casos · SKUs fuera de biblioteca" },
  { paso: 3, slug: "validacion", label: "Conversión", desc: "Calcular precio_lista (SQL indexado)" },
  { paso: 4, slug: "cierre", label: "Cierre", desc: "Listado oficial · visible en historial" },
] as const;

export type ImportacionPasoNum = (typeof IMPORTACION_PASOS)[number]["paso"];

export function importacionPasoMeta(paso: number) {
  return IMPORTACION_PASOS.find((p) => p.paso === paso) ?? IMPORTACION_PASOS[0];
}

export function importacionPasoPath(paso: number, eventoId?: number | null): string {
  const meta = importacionPasoMeta(paso);
  const base =
    meta.paso === 0
      ? IMPORTACION_PRECIOS_NUEVO
      : `${IMPORTACION_PRECIOS_NUEVO}/${meta.slug}`;
  if (eventoId != null && eventoId > 0) {
    return `${base}?evento_id=${eventoId}`;
  }
  return base;
}

export function importacionHubPath(): string {
  return IMPORTACION_PRECIOS;
}
