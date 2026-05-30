import { productImageCandidates, productImagePrimaryFileName } from "@/lib/retail/product-image";
import { publicStorageObjectUrl } from "@/lib/storage-public-url";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const MOLECULA_IMAGEN_RE = /^(\d+)-(\d+)-(\d+)-(\d+)(\.[a-z0-9]{2,5})$/i;

export type ImagenMolecula = {
  linea_codigo: string;
  referencia_codigo: string;
  material_code: string;
  color_code: string;
  filename: string;
  image_url: string;
};

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
  if (/^https?:\/\//i.test(name)) return [name];

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

export function parseImagenMolecula(rawImageName: string | null | undefined): ImagenMolecula | null {
  const filename = cleanImageName(rawImageName).split("/").pop() ?? "";
  const match = filename.match(MOLECULA_IMAGEN_RE);
  if (!match) return null;

  return {
    linea_codigo: match[1],
    referencia_codigo: match[2],
    material_code: match[3],
    color_code: match[4],
    filename,
    image_url: publicStorageObjectUrl("productos", filename),
  };
}

export function ventaFotoImageCandidates(row: {
  imagen?: string | null;
  linea_codigo?: string | null;
  referencia_codigo?: string | null;
  material_code?: string | null;
  color_code?: string | null;
}): { candidates: string[]; searchName: string | null } {
  const parsed = parseImagenMolecula(row.imagen);
  const candidates = [
    ...(parsed?.image_url ? [parsed.image_url] : []),
    ...legacyImageCandidates(row.imagen),
    ...productImageCandidates(
      parsed?.linea_codigo ?? row.linea_codigo ?? "",
      parsed?.referencia_codigo ?? row.referencia_codigo ?? "",
      parsed?.material_code ?? row.material_code ?? "",
      parsed?.color_code ?? row.color_code ?? "",
    ),
  ];

  return {
    candidates: [...new Set(candidates)],
    searchName:
      parsed?.filename ||
      cleanImageName(row.imagen) ||
      productImagePrimaryFileName(
        parsed?.linea_codigo ?? row.linea_codigo ?? "",
        parsed?.referencia_codigo ?? row.referencia_codigo ?? "",
        parsed?.material_code ?? row.material_code ?? "",
        parsed?.color_code ?? row.color_code ?? "",
      ),
  };
}
