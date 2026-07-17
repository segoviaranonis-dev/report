/**
 * Primera palabra de descripción de pilar (material / color).
 * Paridad: `colorPredominante` en color-canon.ts
 *
 * Corta en el primer separador: espacio · `/` · `-` (también `–` · `|` · `,`).
 * Ej.: "NAPA TURIM" → "NAPA" · "NEGRO/BLANCO" → "NEGRO" · "SINT-ECO" → "SINT"
 */
import { colorPredominante, normalizarEtiqueta } from "@/lib/pilares/color-canon";

export function primeraPalabraPilar(descripcion: string | null | undefined): string {
  return colorPredominante(descripcion);
}

/** Etiqueta corta para UI de filtro (Title Case). */
export function etiquetaFiltroPilar(descripcion: string | null | undefined): string {
  const raw = primeraPalabraPilar(descripcion);
  return raw ? normalizarEtiqueta(raw) : "";
}
