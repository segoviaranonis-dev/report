/**
 * Parser de molécula L-R-M-C desde nombre de archivo de imagen
 *
 * Formato: linea-referencia-material-color.jpg
 * Ejemplo: 4076-1350-9569-15745.jpg
 */

import { publicStorageObjectUrl } from "@/lib/storage-public-url";

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

  // Construir URL de Supabase Storage
  const image_url = publicStorageObjectUrl("productos", filename);

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
 * Genera candidatos de URLs para imagen
 * Retorna array con URL principal y fallbacks
 */
export function getImagenCandidates(imagen: string | null | undefined): string[] {
  const parsed = parseImagenMolecula(imagen);

  if (!parsed.valid || !parsed.image_url) {
    return [];
  }

  // Por ahora solo retornamos la URL principal
  // Podríamos agregar fallbacks con diferentes extensiones si fuera necesario
  return [parsed.image_url];
}
