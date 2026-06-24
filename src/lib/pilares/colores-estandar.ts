/** Colores estándar — catálogo BD + helpers (tono_canon.etiqueta). */

import { colorPredominante, parseTonoCanon } from "./color-canon";

export type ColorEstandar = {
  etiqueta: string;
  hex: string;
  aliases: string[];
  orden?: number;
  uso_count?: number;
};

/** Fallback si BD no responde (dev offline). */
export const COLORES_ESTANDAR_DEFAULT: ColorEstandar[] = [
  { etiqueta: "Negro", hex: "#1a1a1a", aliases: ["negro", "preto", "black"] },
  { etiqueta: "Blanco", hex: "#f5f5f0", aliases: ["blanco", "branco", "white", "marfil", "ivory", "offwhite"] },
  {
    etiqueta: "Gris",
    hex: "#9e9e9e",
    aliases: ["gris", "cinza", "grey", "gray", "grafito", "plata", "prata", "silver", "plateado", "platino"],
  },
  {
    etiqueta: "Dorado",
    hex: "#ffd54f",
    aliases: ["dorado", "dourado", "oro", "gold", "golden", "amarillo", "amarelo", "yellow", "mostaza", "mustard"],
  },
  {
    etiqueta: "Beige",
    hex: "#e8d5b0",
    aliases: [
      "beige", "bege", "avela", "avellana", "nude", "natural", "crema", "cream", "camel", "capuchino", "caramelo",
      "tan", "taupe", "piñon", "pinon", "moka", "mocha", "couro", "cuero", "leather",
    ],
  },
  {
    etiqueta: "Marrón",
    hex: "#6d4c41",
    aliases: ["marrón", "marron", "marrom", "brown", "cacao", "cocoa", "chocolate", "coffee", "café", "cafe"],
  },
  { etiqueta: "Rojo", hex: "#c62828", aliases: ["rojo", "vermelho", "red"] },
  { etiqueta: "Vino", hex: "#880e4f", aliases: ["vino", "wine", "bordô", "bordo", "burdeo", "guinda"] },
  { etiqueta: "Naranja", hex: "#c2410c", aliases: ["naranja", "laranja", "orange", "coral"] },
  { etiqueta: "Verde", hex: "#2e7d32", aliases: ["verde", "green", "oliva", "olive"] },
  { etiqueta: "Celeste", hex: "#4fc3f7", aliases: ["celeste", "aqua"] },
  { etiqueta: "Azul", hex: "#1565c0", aliases: ["azul", "blue"] },
  { etiqueta: "Marino", hex: "#1e3a5f", aliases: ["marino", "marinha", "navy"] },
  { etiqueta: "Rosado", hex: "#f48fb1", aliases: ["rosado", "rosa", "pink"] },
  { etiqueta: "Bronce", hex: "#b87333", aliases: ["bronce", "bronze"] },
];

/** @deprecated usar catálogo desde API/BD */
export const COLORES_ESTANDAR = COLORES_ESTANDAR_DEFAULT;

const ETIQUETAS_LEGACY: Record<string, string> = {
  plateado: "Gris",
  plata: "Gris",
  amarillo: "Dorado",
};

export const SIN_TONO_ETIQUETA = "";
export const SIN_TONO_HEX = "#e2e8f0";

function normalizeToken(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function buildAliasIndex(catalog: ColorEstandar[]): Map<string, ColorEstandar> {
  const index = new Map<string, ColorEstandar>();
  for (const c of catalog) {
    index.set(normalizeToken(c.etiqueta), c);
    for (const a of c.aliases) index.set(normalizeToken(a), c);
  }
  return index;
}

export function findColorEstandarInCatalog(etiqueta: string, catalog: ColorEstandar[]): ColorEstandar | undefined {
  const key = normalizeToken(etiqueta);
  const index = buildAliasIndex(catalog);
  const direct = index.get(key) ?? catalog.find((c) => normalizeToken(c.etiqueta) === key);
  if (direct) return direct;
  const legacy = ETIQUETAS_LEGACY[key];
  if (legacy) return findColorEstandarInCatalog(legacy, catalog);
  return undefined;
}

export function findColorEstandar(etiqueta: string): ColorEstandar | undefined {
  return findColorEstandarInCatalog(etiqueta, COLORES_ESTANDAR_DEFAULT);
}

export function sugerirColorEstandarFromCatalog(
  texto: string | null | undefined,
  catalog: ColorEstandar[],
): ColorEstandar | null {
  const raw = String(texto ?? "").trim();
  if (!raw) return null;

  const direct = findColorEstandarInCatalog(raw, catalog);
  if (direct) return direct;

  const tokens = raw.split(/[/,\-–|\s]+/).map((t) => t.trim()).filter(Boolean);
  for (const token of tokens) {
    const hit = findColorEstandarInCatalog(token, catalog);
    if (hit) return hit;
  }

  for (const c of catalog) {
    for (const alias of c.aliases) {
      if (raw.toLowerCase().includes(alias)) return c;
    }
  }
  return null;
}

export function sugerirColorEstandar(texto: string | null | undefined): ColorEstandar | null {
  return sugerirColorEstandarFromCatalog(texto, COLORES_ESTANDAR_DEFAULT);
}

/** Conteo por etiqueta estándar (tono_canon guardado o sugerencia desde nombre). */
export function computeUsoPorEstandar(
  rows: { nombre: string | null; tono_canon: Record<string, unknown> | null }[],
  catalog: ColorEstandar[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const c of catalog) counts.set(c.etiqueta, 0);

  for (const row of rows) {
    const tono = parseTonoCanon(row.tono_canon);
    let etiqueta = tono?.etiqueta?.trim();
    if (!etiqueta) {
      const pred = colorPredominante(row.nombre);
      const sug = sugerirColorEstandarFromCatalog(pred || row.nombre, catalog);
      etiqueta = sug?.etiqueta;
    } else {
      const std = findColorEstandarInCatalog(etiqueta, catalog);
      etiqueta = std?.etiqueta ?? etiqueta;
    }
    if (etiqueta && counts.has(etiqueta)) {
      counts.set(etiqueta, (counts.get(etiqueta) ?? 0) + 1);
    }
  }
  return counts;
}

/** Ordena catálogo: dominante primero (uso desc), empate por orden previo. */
export function ordenarCatalogoPorUso(
  catalog: ColorEstandar[],
  uso: Map<string, number>,
): ColorEstandar[] {
  return [...catalog].sort((a, b) => {
    const diff = (uso.get(b.etiqueta) ?? 0) - (uso.get(a.etiqueta) ?? 0);
    if (diff !== 0) return diff;
    return (a.orden ?? 999) - (b.orden ?? 999);
  });
}

export function isEtiquetaEstandar(etiqueta: string, catalog = COLORES_ESTANDAR_DEFAULT): boolean {
  return Boolean(findColorEstandarInCatalog(etiqueta, catalog));
}

export function etiquetasEstandar(catalog = COLORES_ESTANDAR_DEFAULT): string[] {
  return catalog.map((c) => c.etiqueta);
}

export function rowToColorEstandar(r: {
  etiqueta: string;
  hex: string;
  aliases: unknown;
  orden?: number;
  uso_count?: number;
}): ColorEstandar {
  const aliases = Array.isArray(r.aliases) ? r.aliases.map(String) : [];
  return {
    etiqueta: r.etiqueta,
    hex: r.hex,
    aliases,
    orden: r.orden,
    uso_count: r.uso_count,
  };
}
