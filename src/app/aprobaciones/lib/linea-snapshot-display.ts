/**
 * Resolución canónica de imagen + gradas desde linea_snapshot (FI / PP / Aprobaciones).
 * Ley: NEXUS_PROTOCOLO_IMAGENES_PRODUCTO.md — bucket productos, L-R-M-C.jpg
 * Grada caja cerrada importadora: 34(1 2 3 3 2 1)39 — espacios dentro del paréntesis.
 */
import {
  imagenNombreToCandidates,
  productImageCandidates,
  productImagePrimaryFileName,
} from "@/lib/retail/product-image";
import { legacyImageCandidates } from "@/lib/ventas-fotos/image";
import { parseImagenMolecula } from "@/lib/ventas-fotos/parse-imagen";

export type LineaSnapshotParsed = {
  linea_codigo: string;
  ref_codigo: string;
  material_nombre: string;
  color_nombre: string;
  material_code: string;
  color_code: string;
  gradas_display: string;
  imageCandidates: string[];
  imageSearchName: string | null;
};

function str(v: unknown): string {
  return v != null ? String(v).trim() : "";
}

/** Parse JSON o dict estilo Python {'34': 1, '35': 2} */
function parseLooseRecord(raw: unknown): Record<string, number> | null {
  if (!raw) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const n = Number(v);
      if (Number.isFinite(n)) out[String(k)] = n;
    }
    return Object.keys(out).length ? out : null;
  }
  if (typeof raw !== "string" || !raw.trim()) return null;
  const s = raw.trim();
  try {
    const j = JSON.parse(s) as unknown;
    return parseLooseRecord(j);
  } catch {
    /* sigue */
  }
  try {
    const j = JSON.parse(s.replace(/'/g, '"')) as unknown;
    return parseLooseRecord(j);
  } catch {
    return null;
  }
}

function sortTallaKeys(keys: string[]): string[] {
  return [...keys].sort(
    (a, b) => parseFloat(a.split("/")[0]) - parseFloat(b.split("/")[0]),
  );
}

/**
 * grades_json → 34(1 2 3 3 2 1)39
 * Formato importadora (espacios, no guiones).
 */
export function gradasFmtFromJson(grades: Record<string, number> | null | undefined): string {
  if (!grades || typeof grades !== "object") return "";
  const keys = sortTallaKeys(Object.keys(grades));
  if (keys.length === 0) return "";
  const cantidades = keys.map((k) => String(Math.round(Number(grades[k]) || 0)));
  return `${keys[0]}(${cantidades.join(" ")})${keys[keys.length - 1]}`;
}

/** "30:2 · 31:2 · 32:2" → 30(2 2 2)32 */
function gradasFmtFromColonDot(fmt: string): string {
  if (!fmt.includes(":")) return fmt;
  const partes = fmt
    .split("·")
    .map((p) => p.trim())
    .filter(Boolean);
  if (partes.length === 0) return fmt;
  const tallas: string[] = [];
  const cantidades: string[] = [];
  for (const p of partes) {
    const [talla, cant] = p.split(":").map((x) => x.trim());
    if (!talla || cant == null) continue;
    tallas.push(talla);
    cantidades.push(String(Math.round(Number(cant) || 0)));
  }
  if (tallas.length === 0) return fmt;
  return `${tallas[0]}(${cantidades.join(" ")})${tallas[tallas.length - 1]}`;
}

/** Normaliza guiones/comas legacy a espacios: 27(1-1-1-1-2-2)36 → 27(1 1 1 1 2 2)36 */
function normalizarSeparadorGrada(fmt: string): string {
  const trimmed = fmt.trim();
  const m = trimmed.match(/^(\d+)\(([^)]+)\)(\d+)$/);
  if (!m) return trimmed;
  const inner = m[2]
    .replace(/[,;|/\\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${m[1]}(${inner})${m[3]}`;
}

function fmtRawFromSnapshot(snap: Record<string, unknown>): string {
  for (const key of ["gradas_fmt", "grada_fmt", "grada_text", "grada_display"] as const) {
    const v = str(snap[key]);
    if (v) return v;
  }
  const grada = snap.grada;
  if (typeof grada === "string") return grada.trim();
  return "";
}

export function gradasDisplayFromSnapshot(snap: Record<string, unknown>): string {
  const parsed =
    parseLooseRecord(snap.grades_json) ??
    parseLooseRecord(snap.gradas) ??
    (typeof snap.grada === "object" ? parseLooseRecord(snap.grada) : null);

  if (parsed) {
    const formatted = gradasFmtFromJson(parsed);
    if (formatted) return formatted;
  }

  const fmtRaw = fmtRawFromSnapshot(snap);
  if (fmtRaw) {
    if (fmtRaw.includes(":")) return gradasFmtFromColonDot(fmtRaw);
    if (/\(\s*\d/.test(fmtRaw)) return normalizarSeparadorGrada(fmtRaw);
    return fmtRaw;
  }

  return "";
}

function codigoFromSnapshot(snap: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = str(snap[k]);
    if (v) return v;
  }
  return "";
}

function fileNameFromImagenUrl(raw: string): string | null {
  if (!raw) return null;
  if (!raw.includes("/")) return raw;
  const marker = "/storage/v1/object/public/productos/";
  const idx = raw.indexOf(marker);
  if (idx >= 0) {
    return decodeURIComponent(raw.slice(idx + marker.length).split("?")[0] ?? "");
  }
  return null;
}

export function imageCandidatesFromSnapshot(snap: Record<string, unknown>): {
  candidates: string[];
  searchName: string | null;
} {
  const linea = codigoFromSnapshot(snap, "linea_codigo", "linea");
  const ref = codigoFromSnapshot(snap, "ref_codigo", "referencia_codigo", "referencia");
  let material = codigoFromSnapshot(
    snap,
    "material_code",
    "material_codigo",
    "id_material_f9",
    "material_codigo_proveedor",
  );
  let color = codigoFromSnapshot(
    snap,
    "color_code",
    "color_codigo",
    "id_color_f9",
    "color_codigo_proveedor",
  );

  const imagenRaw = str(snap.imagen_url);
  const fileFromUrl = fileNameFromImagenUrl(imagenRaw);
  if ((!material || !color) && fileFromUrl) {
    const parsed = parseImagenMolecula(fileFromUrl);
    if (parsed.valid) {
      if (!material && parsed.material_codigo != null) material = String(parsed.material_codigo);
      if (!color && parsed.color_codigo != null) color = String(parsed.color_codigo);
    }
  }

  const candidates: string[] = [];
  const pushUnique = (url: string) => {
    if (url && !candidates.includes(url)) candidates.push(url);
  };

  if (imagenRaw.startsWith("http") && imagenRaw.includes("/productos/")) {
    pushUnique(imagenRaw);
  }

  const legacyName = fileFromUrl ?? (imagenRaw && !imagenRaw.startsWith("http") ? imagenRaw : null);
  for (const u of legacyImageCandidates(legacyName)) pushUnique(u);
  for (const u of imagenNombreToCandidates(legacyName)) pushUnique(u);

  if (linea && ref) {
    for (const u of productImageCandidates(linea, ref, material, color)) pushUnique(u);
  }

  const searchName =
    legacyName ||
    productImagePrimaryFileName(linea, ref, material, color) ||
    (linea && ref ? `${linea}-${ref}-${material || "?"}-${color || "?"}.jpg` : null);

  return { candidates, searchName };
}

function parseSnapshotObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      try {
        return JSON.parse(raw.replace(/'/g, '"')) as Record<string, unknown>;
      } catch {
        return {};
      }
    }
  }
  return {};
}

/** Parsea linea_snapshot JSONB → campos de UI alineados a fi_card.py */
export function parseLineaSnapshotForDisplay(raw: unknown): LineaSnapshotParsed {
  const snap = parseSnapshotObject(raw);
  const { candidates, searchName } = imageCandidatesFromSnapshot(snap);

  return {
    linea_codigo: codigoFromSnapshot(snap, "linea_codigo", "linea") || "?",
    ref_codigo: codigoFromSnapshot(snap, "ref_codigo", "referencia_codigo", "referencia") || "?",
    material_nombre: str(snap.material_nombre ?? snap.descp_material ?? snap.material),
    color_nombre: str(snap.color_nombre ?? snap.color),
    material_code: codigoFromSnapshot(snap, "material_code", "material_codigo", "id_material_f9"),
    color_code: codigoFromSnapshot(snap, "color_code", "color_codigo", "id_color_f9"),
    gradas_display: gradasDisplayFromSnapshot(snap),
    imageCandidates: candidates,
    imageSearchName: searchName,
  };
}
