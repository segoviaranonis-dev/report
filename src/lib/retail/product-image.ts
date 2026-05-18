import { publicStorageObjectUrl } from "@/lib/storage-public-url";

/** Debe coincidir con migrations/033_retail_staging_fk_dims.sql (material/color sentinela). */
const STAGING_SENTINEL_CODIGO_ABS = 999001;

function normCodigo(v: string | number | null | undefined): string {
  if (v == null) return "";
  const n = Number(v);
  if (Number.isFinite(n) && n === Math.floor(n)) return String(Math.floor(n));
  return String(v).trim().replace(/\s+/g, "");
}

function isSentinelCodigoProveedor(norm: string): boolean {
  if (!norm) return false;
  const n = Number(norm.replace(/^\+/, ""));
  return Number.isFinite(n) && Math.abs(Math.trunc(n)) === STAGING_SENTINEL_CODIGO_ABS;
}

/** Segmento para nombre de archivo: sin sentinela -999001 (evita doble guion al unir). */
function normPillarSegment(v: string | number | null | undefined): string {
  const s = normCodigo(v);
  if (!s || isSentinelCodigoProveedor(s)) return "";
  return s;
}

function joinPillarStem(parts: string[]): string {
  return parts.filter(Boolean).join("-");
}

/**
 * Misma convención que rimec-web / bazzar-web:
 * productos/{linea}-{ref}-{material_code}-{color_code}.jpg
 */
export function productImageCandidates(
  lineaCodigo: string,
  referenciaCodigo: string,
  materialCode: string | number,
  colorCode: string | number,
): string[] {
  const L = normPillarSegment(lineaCodigo);
  const R = normPillarSegment(referenciaCodigo);
  const M = normPillarSegment(materialCode);
  const C = normPillarSegment(colorCode);
  if (!L || !R) return [];

  const stem4 = joinPillarStem([L, R, M, C]);
  const exts = [".jpg", ".jpeg", ".png", ".webp"];
  const urls: string[] = [];
  if (stem4) {
    for (const ext of exts) {
      const u = publicStorageObjectUrl("productos", `${stem4}${ext}`);
      if (u) urls.push(u);
    }
  }
  // Fallback L-R (sin mat/color) por si la foto es solo línea+ref
  const stemLr = joinPillarStem([L, R]);
  for (const ext of exts) {
    const u = publicStorageObjectUrl("productos", `${stemLr}${ext}`);
    if (u && !urls.includes(u)) urls.push(u);
  }
  return urls;
}

export function productImagePrimary(
  lineaCodigo: string,
  referenciaCodigo: string,
  materialCode: string | number,
  colorCode: string | number,
): string | undefined {
  return productImageCandidates(lineaCodigo, referenciaCodigo, materialCode, colorCode)[0];
}

/** Nombre de archivo principal intentado (misma convención RIMEC/Bazzar). */
export function productImagePrimaryFileName(
  lineaCodigo: string,
  referenciaCodigo: string,
  materialCode: string | number,
  colorCode: string | number,
): string | null {
  const L = normPillarSegment(lineaCodigo);
  const R = normPillarSegment(referenciaCodigo);
  const M = normPillarSegment(materialCode);
  const C = normPillarSegment(colorCode);
  if (!L || !R) return null;
  const stem = joinPillarStem([L, R, M, C]);
  if (!stem) return null;
  return `${stem}.jpg`;
}
