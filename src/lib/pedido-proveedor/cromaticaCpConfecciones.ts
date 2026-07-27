/**
 * Cromática CP/Programado — calzado vs confecciones (siamese rimec-web).
 * Confecciones: amarillo pastel amber-50 / yellow-50.
 */

export type RamoCpVisual = "calzado" | "confecciones";

export const CP_CONF_PASTEL = {
  borderL: "border-l-amber-400",
  border: "border-amber-200/90",
  bg: "bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50/70",
  bgSoft: "bg-yellow-50/80",
  textQuincena: "text-amber-900",
  textPreventa: "text-orange-700",
  pill: "border-amber-300 bg-yellow-50 font-bold text-amber-950",
} as const;

export const CP_CALZADO = {
  borderL: "border-l-sky-600",
  border: "border-rimec-azul/50",
  bg: "bg-white",
  bgSoft: "bg-blue-50/45",
  textQuincena: "text-sky-800",
  textPreventa: "text-orange-600",
  pill: "border-rimec-azul/50 bg-white",
} as const;

export function cromaticaCp(ramo: RamoCpVisual) {
  return ramo === "confecciones" ? CP_CONF_PASTEL : CP_CALZADO;
}

export function ppMarcasOProformaConfecciones(input: {
  marcas?: string | null;
  numero_proforma?: string | null;
}): boolean {
  const m = String(input.marcas ?? "").toUpperCase();
  if (/\b(KYLY|MILON)\b/.test(m)) return true;
  const pf = String(input.numero_proforma ?? "").trim();
  return /^638\b/.test(pf) || pf.startsWith("638-");
}
