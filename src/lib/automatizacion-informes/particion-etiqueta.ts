/** Etiquetas visibles DPE — PDF + bandeja (sin abrir). */

export type ParticionTag = {
  label: string;
  tag: string;
};

export type CadenaPdf = "NORMAL" | "PROMO" | "LIQUIDACION" | "COMUN";

/** Parsea casoLabel: "ABIERTO · NORMAL · G0201010000" */
export function parseCasoLabelCompuesto(casoLabel: string): {
  tipo: ParticionTag;
  cadena: CadenaPdf | null;
  codGrupo: string | null;
} {
  const raw = (casoLabel || "").trim();
  const u = raw.toUpperCase().replace(/-/g, " ");
  let cadena: CadenaPdf | null = null;
  if (/\bCOMUN\b/.test(u)) cadena = "COMUN";
  else if (/\b(LIQ|LIQUID)\b/.test(u) || /\bLIQUIDACION\b/.test(u)) cadena = "LIQUIDACION";
  else if (/\bPROMO\b/.test(u)) cadena = "PROMO";
  else if (/\b(NR|NORMAL|REGULAR)\b/.test(u)) cadena = "NORMAL";

  const g = raw.match(/G(\d{6,})/i);
  const tipoPart = raw.split("·")[0]?.trim() || raw;
  return {
    tipo: etiquetaParticionVisible(tipoPart),
    cadena,
    codGrupo: g?.[1] ?? null,
  };
}

const MAP: { match: RegExp; label: string; tag: string }[] = [
  { match: /CERRADO|\bCR\b/, label: "Cerrado (CR)", tag: "CR" },
  { match: /ABIERTO|\bAB\b/, label: "Abierto (AB)", tag: "AB" },
  { match: /ANTEOJ|MEDIA|LENTE/, label: "Anteojos / Medias", tag: "ANT" },
  { match: /CARTERA/, label: "Carteras", tag: "CAR" },
  { match: /LIQUID|\bLQ\b/, label: "Liquidacion", tag: "LIQ" },
  { match: /PROMO/, label: "Promo", tag: "PROMO" },
  { match: /COMUN/, label: "Comun", tag: "COMUN" },
  { match: /NORMAL|\bNR\b|REGULAR/, label: "Normal", tag: "N" },
];

export function etiquetaParticionVisible(idOrLabel: string): ParticionTag {
  const u = (idOrLabel || "").trim().toUpperCase();
  if (!u) return { label: "—", tag: "" };
  if (u === "CERRADO") return { label: "Cerrado (CR)", tag: "CR" };
  if (u === "ABIERTO") return { label: "Abierto (AB)", tag: "AB" };
  if (u === "LIQUIDACION" || u === "LIQ") return { label: "Liquidacion", tag: "LIQ" };
  if (u === "ANTEOJOS" || u === "MEDIAS") return { label: "Anteojos / Medias", tag: "ANT" };
  if (u === "CARTERAS" || u === "CARTERA") return { label: "Carteras", tag: "CAR" };
  if (u === "PROMOCIONAL" || u === "PROMO") return { label: "Promo", tag: "PROMO" };
  if (u === "COMUN") return { label: "Comun", tag: "COMUN" };
  if (u === "NORMAL" || u === "REGULAR") return { label: "Normal", tag: "N" };
  for (const row of MAP) {
    if (row.match.test(u)) return { label: row.label, tag: row.tag };
  }
  return { label: idOrLabel, tag: "" };
}

export function cadenaPeACadenaPdf(cadenaPe: string): CadenaPdf | null {
  const u = (cadenaPe || "").trim().toUpperCase();
  if (u === "PROMOCIONAL" || u === "PROMO") return "PROMO";
  if (u === "LIQUIDACION" || u === "LIQ") return "LIQUIDACION";
  if (u === "COMUN") return "COMUN";
  if (u === "REGULAR" || u === "NORMAL") return "NORMAL";
  return null;
}

function cadenaSlug(cadena?: CadenaPdf | null): string {
  if (cadena === "PROMO") return "PROMO";
  if (cadena === "LIQUIDACION") return "LQ";
  if (cadena === "COMUN") return "COMUN";
  return "NR";
}

/** Prefijo corto marca → VZ / ML / … */
export function prefijoMarcaCorto(marca: string): string {
  const m = marca.replace(/\s+/g, "").toUpperCase();
  if (m.startsWith("VIZZANO")) return "VZ";
  if (m.startsWith("MOLECA")) return "ML";
  if (m.startsWith("BEIRA")) return "BR";
  if (m.startsWith("MODARE")) return "MD";
  return m.slice(0, 2) || "XX";
}

/** Normaliza trozo de descripción de grupo → slug archivo. */
export function slugTrozoDescripcion(raw: string): string {
  return (raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Ley Director: 1 COD.GRUPO (Grupo 1) = 1 PDF.
 * Nombre = combinación de descripciones del grupo (MARCA · TIPO0 · TIPO1 · TIPO2).
 * Ej: VIZZANO_ABIERTO_NORMAL_LPN.pdf · VIZZANO_CERRADO_NORMAL_BOTA_LPN.pdf
 */
export function descripcionGrupoParts(opts: {
  marca: string;
  tipo0: string;
  tipo1: string;
  tipo2?: string | null;
}): string[] {
  const skip = new Set(["", "NADA", "-", "—", "NULL"]);
  return [opts.marca, opts.tipo0, opts.tipo1, opts.tipo2 || ""]
    .map((x) => String(x || "").trim().toUpperCase())
    .filter((x) => !skip.has(x));
}

export function labelDescripcionGrupo(opts: {
  marca: string;
  tipo0: string;
  tipo1: string;
  tipo2?: string | null;
}): string {
  return descripcionGrupoParts(opts).join(" · ");
}

export function slugArchivoCodGrupo(opts: {
  marca: string;
  tipo0: string;
  tipo1: string;
  tipo2?: string | null;
  listaPrecio: string;
  /** reserved — trazabilidad interna, no va en el nombre visible */
  codGrupo?: string;
}): string {
  const lp = opts.listaPrecio.toUpperCase();
  const mid = descripcionGrupoParts(opts)
    .map(slugTrozoDescripcion)
    .filter(Boolean)
    .join("_");
  return `${mid || "GRUPO"}_${lp}.pdf`;
}

/** Legacy — mantener por PDF generator viejo. */
export function slugArchivoParticion(opts: {
  marca: string;
  particionId: string;
  cadena?: CadenaPdf | null;
  listaPrecio: string;
}): string {
  const marca = opts.marca.replace(/\s+/g, "_").toUpperCase();
  const lp = opts.listaPrecio.toUpperCase();
  const id = opts.particionId.toUpperCase();
  const cad = cadenaSlug(opts.cadena);
  if (id.startsWith("G") && /\d/.test(id)) {
    return `${marca}_${id}_${cad}_${lp}.pdf`;
  }
  const tipo = etiquetaParticionVisible(id);
  const mid = tipo.label.replace(/\s+/g, "_").replace(/[()]/g, "") || id;
  return `${marca}_${mid}_${cad}_${lp}.pdf`;
}

/** Extrae COD.GRUPO desde nombre archivo / caso. */
export function codGrupoDesdeTexto(texto: string): string | null {
  const m = (texto || "").match(/G(\d{6,})/i);
  return m?.[1] ?? null;
}
