import { productImageCandidates, productImagePrimaryFileName } from "@/lib/retail/product-image";
import { publicStorageObjectUrl } from "@/lib/storage-public-url";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

function cleanImageName(raw: string | null | undefined): string {
  return String(raw ?? "")
    .trim()
    .replace(/^[/\\]+/, "")
    .replace(/\\/g, "/");
}

function hasExtension(name: string): boolean {
  return /\.[a-z0-9]{2,5}$/i.test(name);
}

function pushUnique(out: string[], value: string) {
  if (value && !out.includes(value)) out.push(value);
}

export function legacyImageCandidates(rawImageName: string | null | undefined): string[] {
  const name = cleanImageName(rawImageName);
  if (!name) return [];

  const candidates: string[] = [];
  if (hasExtension(name)) {
    pushUnique(candidates, publicStorageObjectUrl("productos", name));
  } else {
    for (const ext of IMAGE_EXTENSIONS) {
      pushUnique(candidates, publicStorageObjectUrl("productos", `${name}${ext}`));
    }
  }
  return candidates;
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
