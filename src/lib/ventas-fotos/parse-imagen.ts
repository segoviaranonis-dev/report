/**
 * Parser de molécula L-R-M-C desde nombre de archivo de imagen
 *
 * Formato: linea-referencia-material-color.jpg
 * Ejemplo: 4076-1350-9569-15745.jpg
 */

import {
  getProductImageUrl,
  imagenNombreToCandidates,
} from "@/lib/retail/product-image";

export type ImagenParsed = {
  linea_codigo: number | null;
  referencia_codigo: number | null;
  material_codigo: number | null;
  color_codigo: number | null;
  filename: string;
  image_url: string;
  valid: boolean;
  error?: string;
};

/**
 * Parsea nombre de archivo en formato L-R-M-C
 *
 * @param imagen - Nombre de archivo (ej: "4076-1350-9569-15745.jpg")
 * @returns Objeto con pilares parseados y URL de Storage
 */
export function parseImagenMolecula(imagen: string | null | undefined): ImagenParsed {
  const filename = String(imagen ?? "").trim();

  if (!filename) {
    return {
      linea_codigo: null,
      referencia_codigo: null,
      material_codigo: null,
      color_codigo: null,
      filename: "",
      image_url: "",
      valid: false,
      error: "Imagen vacía",
    };
  }

  // Thumb canónico sm/ — Protocolo Imágenes Nexus
  const image_url = getProductImageUrl(filename, "sm");

  // Remover extensión
  const sinExtension = filename.replace(/\.(jpg|jpeg|png|webp)$/i, "");

  // Split por guión
  const partes = sinExtension.split("-");

  if (partes.length !== 4) {
    return {
      linea_codigo: null,
      referencia_codigo: null,
      material_codigo: null,
      color_codigo: null,
      filename,
      image_url,
      valid: false,
      error: `Formato inválido: esperado L-R-M-C (4 partes), encontrado ${partes.length}`,
    };
  }

  const [linea, referencia, material, color] = partes;

  // Validar que sean numéricos
  const lineaNum = parseInt(linea, 10);
  const referenciaNum = parseInt(referencia, 10);
  const materialNum = parseInt(material, 10);
  const colorNum = parseInt(color, 10);

  if (
    isNaN(lineaNum) ||
    isNaN(referenciaNum) ||
    isNaN(materialNum) ||
    isNaN(colorNum)
  ) {
    return {
      linea_codigo: null,
      referencia_codigo: null,
      material_codigo: null,
      color_codigo: null,
      filename,
      image_url,
      valid: false,
      error: "Una o más partes no son numéricas",
    };
  }

  return {
    linea_codigo: lineaNum,
    referencia_codigo: referenciaNum,
    material_codigo: materialNum,
    color_codigo: colorNum,
    filename,
    image_url,
    valid: true,
  };
}

/**
 * Genera candidatos de URLs para imagen (sm → md → flat → thumbs).
 */
export function getImagenCandidates(imagen: string | null | undefined): string[] {
  return imagenNombreToCandidates(imagen, "thumb");
}

/** Mismo set que getImagenCandidates pero flat/legacy primero — clave para PDF y grillas. */
export function getImagenCandidatesFlatFirst(imagen: string | null | undefined): string[] {
  return prioritizeFlatStorageUrls(getImagenCandidates(imagen));
}

export function mergeImageCandidatesFlatFirst(...groups: string[][]): string[] {
  const out: string[] = [];
  for (const group of groups) {
    for (const u of group) {
      if (u && !out.includes(u)) out.push(u);
    }
  }
  return prioritizeFlatStorageUrls(out);
}

function prioritizeFlatStorageUrls(urls: string[]): string[] {
  const isFlat = (u: string) => {
    try {
      return /\/productos\/[^/]+\.(jpe?g|png|webp)$/i.test(new URL(u).pathname);
    } catch {
      return false;
    }
  };
  const flat = urls.filter(isFlat);
  const tiered = urls.filter((u) => !flat.includes(u));
  return [...flat, ...tiered];
}
