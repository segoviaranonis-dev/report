import { publicStorageObjectUrl } from "@/lib/storage-public-url";
import {
  productImagePrimaryStem,
  resolveProductImageProtocol,
  stems638,
  stem654,
  type ProductImageProtocol,
} from "@/lib/retail/product-image-protocol";

export type ProductImageContext = {
  proveedorImportacionId?: number | null;
  tipoV2Id?: number | null;
  protocol?: ProductImageProtocol;
  /** Kyly 638 — color Excel (K0001), no color_code bigint pilar (MIG-149). */
  imagenColorExcel?: string | null;
};

export {
  PROVEEDOR_CALZADO,
  PROVEEDOR_CONFECCIONES_KYLY,
  resolveProductImageProtocol,
  type ProductImageProtocol,
} from "@/lib/retail/product-image-protocol";

/** Debe coincidir con migrations/033_retail_staging_fk_dims.sql (material/color sentinela). */
const STAGING_SENTINEL_CODIGO_ABS = 999001;

export type ImageSize = "sm" | "md" | "lg";
export type ImageVariant = "thumb" | "hero";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

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

/** Quita prefijos productos/ y sm|md|lg|thumbs/ del path en Storage. */
export function stripProductImageTier(path: string): string {
  return String(path ?? "")
    .trim()
    .replace(/^productos\//i, "")
    .replace(/^(sm|md|lg|thumbs)\//i, "")
    .replace(/^\/+/, "");
}

/**
 * `v_stock_web.imagen_url` a veces llega como URL absoluta Storage.
 * Si se usa cruda como `imagen_nombre`, ensucia candidatos (garbage path)
 * y la miniatura prueba 4 URLs rotas antes del stem L-R-M-C.
 */
export function coerceImagenNombreField(raw: string | null | undefined): {
  basename: string | null;
  absoluteUrl: string | null;
} {
  const s = String(raw ?? "").trim();
  if (!s) return { basename: null, absoluteUrl: null };

  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      const path = decodeURIComponent(u.pathname);
      const m = path.match(/\/productos\/(?:(?:sm|md|lg|thumbs)\/)?(.+)$/i);
      const file = m?.[1] ? stripProductImageTier(m[1]) : (path.split("/").pop() ?? "");
      const basename = file ? stripProductImageTier(file) : null;
      return {
        basename: basename || null,
        absoluteUrl: s.split("?")[0] || s,
      };
    } catch {
      return { basename: null, absoluteUrl: s.split("?")[0] || s };
    }
  }

  return { basename: stripProductImageTier(s) || null, absoluteUrl: null };
}

function normalizeImageFileName(raw: string): string | null {
  const { basename } = coerceImagenNombreField(raw);
  if (!basename) return null;
  const base = stripProductImageTier(basename);
  if (!base) return null;
  return /\.(jpe?g|png|webp)$/i.test(base) ? base : `${base}.jpg`;
}

function variantToTiers(variant: ImageVariant): ImageSize[] {
  return variant === "hero" ? ["lg", "md", "sm"] : ["sm", "md"];
}

function pushUnique(out: string[], value: string) {
  if (value && !out.includes(value)) out.push(value);
}

/** URL pública sm/md/lg — Protocolo Imágenes Nexus. */
export function getProductImageUrl(imageName: string, size: ImageSize = "sm"): string {
  const base = normalizeImageFileName(imageName);
  if (!base) return "";
  return publicStorageObjectUrl("productos", `${size}/${base}`);
}

/** Candidatos ordenados por tier (sm→md→flat→thumbs legacy) o hero (lg→md→sm→flat). */
export function tieredStorageCandidates(
  filePath: string,
  variant: ImageVariant = "thumb",
): string[] {
  const clean = normalizeImageFileName(filePath);
  if (!clean) return [];

  const urls: string[] = [];
  pushUnique(urls, publicStorageObjectUrl("productos", clean));
  for (const tier of variantToTiers(variant)) {
    pushUnique(urls, publicStorageObjectUrl("productos", `${tier}/${clean}`));
  }
  pushUnique(urls, publicStorageObjectUrl("productos", `thumbs/${clean}`));
  return urls;
}

function stemCandidates(stem: string, variant: ImageVariant = "thumb"): string[] {
  const urls: string[] = [];
  for (const ext of IMAGE_EXTENSIONS) {
    for (const u of tieredStorageCandidates(`${stem}${ext}`, variant)) {
      pushUnique(urls, u);
    }
  }
  return urls;
}

function resolveCtxProtocol(input: ProductImageContext & { imagenNombre?: string | null }): ProductImageProtocol {
  return input.protocol ?? resolveProductImageProtocol(input);
}

/**
 * Convención Nexus — rama 654 (L-R-M-C) o 638 (L_C) según proveedor.
 */
export function productImageCandidates(
  lineaCodigo: string,
  referenciaCodigo: string,
  materialCode: string | number,
  colorCode: string | number,
  variant: ImageVariant = "thumb",
  ctx?: ProductImageContext & { imagenNombre?: string | null },
): string[] {
  const protocol = ctx ? resolveCtxProtocol({ ...ctx, imagenNombre: ctx.imagenNombre }) : "654";

  if (protocol === "638") {
    // Excel/F9 (K0001 · id_color) primero; color_code pilar de respaldo.
    // Nombres descriptivos («PRETO») con espacios → Storage 400 — se omiten.
    const colorKeys = [ctx?.imagenColorExcel, colorCode]
      .map((c) => String(c ?? "").trim())
      .filter((c) => {
        if (!c || /\s/.test(c)) return false;
        return /^\d+$/.test(c.replace(/^k/i, ""));
      });
    const urls: string[] = [];
    const seenStem = new Set<string>();
    for (const colorKey of colorKeys) {
      for (const stem of stems638(lineaCodigo, colorKey)) {
        if (seenStem.has(stem)) continue;
        seenStem.add(stem);
        for (const u of stemCandidates(stem, variant)) pushUnique(urls, u);
      }
    }
    return urls;
  }

  const L = normPillarSegment(lineaCodigo);
  const R = normPillarSegment(referenciaCodigo);
  const M = normPillarSegment(materialCode);
  const C = normPillarSegment(colorCode);
  if (!L || !R) return [];

  const urls: string[] = [];
  const stem4 = joinPillarStem([L, R, M, C]);
  if (stem4) {
    for (const u of stemCandidates(stem4, variant)) pushUnique(urls, u);
  }
  const stemLr = joinPillarStem([L, R]);
  for (const u of stemCandidates(stemLr, variant)) pushUnique(urls, u);
  return urls;
}

export function productImagePrimary(
  lineaCodigo: string,
  referenciaCodigo: string,
  materialCode: string | number,
  colorCode: string | number,
  variant: ImageVariant = "thumb",
): string | undefined {
  return productImageCandidates(
    lineaCodigo,
    referenciaCodigo,
    materialCode,
    colorCode,
    variant,
  )[0];
}

/** Nombre de archivo principal intentado (misma convención RIMEC/Bazzar). */
export function productImagePrimaryFileName(
  lineaCodigo: string,
  referenciaCodigo: string,
  materialCode: string | number,
  colorCode: string | number,
  ctx?: ProductImageContext & { imagenNombre?: string | null },
): string | null {
  const stem = productImagePrimaryStem({
    ...ctx,
    linea: lineaCodigo,
    referencia: referenciaCodigo,
    material: materialCode,
    color: colorCode,
    imagenColorExcel: ctx?.imagenColorExcel,
    imagenNombre: ctx?.imagenNombre,
  });
  if (!stem) return null;
  return `${stem}.jpg`;
}

/** Candidatos desde columna IMAGEN del Excel (nombre en bucket productos). */
export function imagenNombreToCandidates(
  imagenNombre: string | null | undefined,
  variant: ImageVariant = "thumb",
): string[] {
  const { basename, absoluteUrl } = coerceImagenNombreField(imagenNombre);
  const urls: string[] = [];

  // URL absoluta válida primero (v_stock_web / vistas) — evita cascada onError
  if (absoluteUrl) pushUnique(urls, absoluteUrl);

  if (!basename) return urls;

  const base = stripProductImageTier(basename);
  if (!base) return urls;

  if (/\.(jpe?g|png|webp)$/i.test(base)) {
    for (const u of tieredStorageCandidates(base, variant)) pushUnique(urls, u);
    return urls;
  }

  for (const ext of IMAGE_EXTENSIONS) {
    for (const u of tieredStorageCandidates(`${base}${ext}`, variant)) pushUnique(urls, u);
  }
  return urls;
}

/**
 * Si el archivo/URL ya trae stem 654 L-R-M-C, esos códigos mandan para la cascada
 * (ALM post-compra a menudo tiene otro material_code que Storage — ley 2.01.04.021).
 */
export function parseStem654FromImagenNombre(
  imagenNombre: string | null | undefined,
): { linea: string; referencia: string; material: string; color: string } | null {
  const { basename } = coerceImagenNombreField(imagenNombre);
  if (!basename) return null;
  const stem = stripProductImageTier(basename).replace(/\.(jpe?g|png|webp)$/i, "");
  const parts = stem.split("-").filter(Boolean);
  if (parts.length < 4) return null;
  const [linea, referencia, material, color] = parts;
  if (!linea || !referencia || !material || !color) return null;
  if (/\s/.test(material) || /\s/.test(color)) return null;
  return { linea, referencia, material, color };
}

export function productImageCandidatesForRow(
  lineaCodigo: string,
  referenciaCodigo: string,
  materialCode: string | number,
  colorCode: string | number,
  imagenNombre?: string | null,
  variant: ImageVariant = "thumb",
  ctx?: ProductImageContext,
): string[] {
  const { basename } = coerceImagenNombreField(imagenNombre);
  const imagenNombreCanon = basename ?? imagenNombre;
  const fromExcel = imagenNombreToCandidates(imagenNombre, variant);
  const protocol = resolveCtxProtocol({ ...ctx, imagenNombre: imagenNombreCanon });

  // 638: no reinterpretar el archivo como L-R-M-C (guiones legacy Kyly).
  if (protocol === "638") {
    const fromMolecule = productImageCandidates(
      lineaCodigo,
      referenciaCodigo,
      materialCode,
      colorCode,
      variant,
      {
        ...ctx,
        tipoV2Id: ctx?.tipoV2Id ?? 2,
        imagenNombre: imagenNombreCanon,
        imagenColorExcel: ctx?.imagenColorExcel ?? null,
      },
    );
    const out = [...fromExcel];
    for (const u of fromMolecule) {
      if (!out.includes(u)) out.push(u);
    }
    return out;
  }

  const stem654 = parseStem654FromImagenNombre(imagenNombre);
  const fromMolecule = productImageCandidates(
    stem654?.linea ?? lineaCodigo,
    stem654?.referencia ?? referenciaCodigo,
    stem654?.material ?? materialCode,
    stem654?.color ?? colorCode,
    variant,
    { ...ctx, imagenNombre: imagenNombreCanon },
  );
  const out = [...fromExcel];
  for (const u of fromMolecule) {
    if (!out.includes(u)) out.push(u);
  }
  return out;
}

/** URL plana legacy (sin tier) — fallback cuando sm/md/lg falta en Storage. */
export function resolveFlatImageUrl(input: {
  linea: string;
  referencia: string;
  material: string | number;
  color: string | number;
  imagenNombre?: string | null;
} & ProductImageContext): string | null {
  const excel = String(input.imagenNombre ?? "").trim();
  if (excel) {
    const file = normalizeImageFileName(excel);
    if (!file) return null;
    return publicStorageObjectUrl("productos", file);
  }

  const protocol = resolveCtxProtocol(input);
  if (protocol === "638") {
    const stem = stems638(input.linea, input.imagenColorExcel ?? input.color)[0];
    if (!stem) return null;
    return publicStorageObjectUrl("productos", `${stem}.jpg`);
  }

  const stem = stem654(input.linea, input.referencia, input.material, input.color);
  if (!stem) return null;
  return publicStorageObjectUrl("productos", `${stem}.jpg`);
}

/** Una URL canónica por variant (thumb=sm, hero=lg). */
export function resolveCanonicalImageUrl(input: {
  linea: string;
  referencia: string;
  material: string | number;
  color: string | number;
  imagenNombre?: string | null;
  variant: ImageVariant;
} & ProductImageContext): string | null {
  const size: ImageSize = input.variant === "hero" ? "lg" : "sm";
  const excel = String(input.imagenNombre ?? "").trim();
  if (excel) {
    const url = getProductImageUrl(excel, size);
    return url || null;
  }

  const protocol = resolveCtxProtocol(input);
  const stem =
    protocol === "638"
      ? stems638(input.linea, input.imagenColorExcel ?? input.color)[0]
      : stem654(input.linea, input.referencia, input.material, input.color);
  if (!stem) return null;

  return publicStorageObjectUrl("productos", `${size}/${stem}.jpg`) || null;
}

/** Hero/modal: lg → md → sm → flat. */
export function productImageHeroCandidates(
  lineaCodigo: string,
  referenciaCodigo: string,
  materialCode: string | number,
  colorCode: string | number,
  imagenNombre?: string | null,
  ctx?: ProductImageContext,
): string[] {
  return productImageCandidatesForRow(
    lineaCodigo,
    referenciaCodigo,
    materialCode,
    colorCode,
    imagenNombre,
    "hero",
    ctx,
  );
}
