import {
  imagenNombreToCandidates,
  productImageCandidates,
  productImagePrimaryFileName,
} from "@/lib/retail/product-image";

function cleanImageName(raw: string | null | undefined): string {
  return String(raw ?? "")
    .trim()
    .replace(/^[/\\]+/, "")
    .replace(/\\/g, "/");
}

export function legacyImageCandidates(rawImageName: string | null | undefined): string[] {
  return imagenNombreToCandidates(cleanImageName(rawImageName), "thumb");
}

export function ventaFotoImageCandidates(row: {
  imagen?: string | null;
  linea_codigo?: string | null;
  referencia_codigo?: string | null;
  material_code?: string | null;
  color_code?: string | null;
}): { candidates: string[]; searchName: string | null } {
  const candidates = [
    ...legacyImageCandidates(row.imagen),
    ...productImageCandidates(
      row.linea_codigo ?? "",
      row.referencia_codigo ?? "",
      row.material_code ?? "",
      row.color_code ?? "",
    ),
  ];

  return {
    candidates: [...new Set(candidates)],
    searchName:
      cleanImageName(row.imagen) ||
      productImagePrimaryFileName(
        row.linea_codigo ?? "",
        row.referencia_codigo ?? "",
        row.material_code ?? "",
        row.color_code ?? "",
      ),
  };
}
