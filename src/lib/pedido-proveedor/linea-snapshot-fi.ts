/**
 * Snapshot FI — serialización server-side (sin deps de imagen UI).
 * Usado por motor programado · Administrador IC · enrich en queries.
 */
import { gradesJsonSoloTallas } from "./grades-json-canonical";

function str(v: unknown): string {
  return v != null ? String(v).trim() : "";
}

function codigoFromSnapshot(snap: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = str(snap[k]);
    if (v) return v;
  }
  return "";
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

function hasGradesInSnapshot(snap: Record<string, unknown>): boolean {
  const parsed = gradesJsonSoloTallas(snap.grades_json);
  return Object.keys(parsed).length > 0;
}

/** Completa snapshot FI incompleto con datos PPD (imagen L-R-M-C · grada). */
export function enrichLineaSnapshotFromPpd(
  raw: unknown,
  ppd: {
    linea?: string | null;
    referencia?: string | null;
    material_code?: string | null;
    color_code?: string | null;
    grades_json?: unknown;
  } | null,
): Record<string, unknown> {
  const snap = parseSnapshotObject(raw);
  if (!ppd) return snap;
  if (!codigoFromSnapshot(snap, "linea_codigo", "linea") && ppd.linea) {
    snap.linea_codigo = String(ppd.linea).trim();
  }
  if (!codigoFromSnapshot(snap, "ref_codigo", "referencia_codigo", "referencia") && ppd.referencia) {
    snap.ref_codigo = String(ppd.referencia).trim();
  }
  if (!codigoFromSnapshot(snap, "material_code", "material_codigo", "id_material_f9") && ppd.material_code) {
    snap.material_code = String(ppd.material_code).trim();
  }
  if (!codigoFromSnapshot(snap, "color_code", "color_codigo", "id_color_f9") && ppd.color_code) {
    snap.color_code = String(ppd.color_code).trim();
  }
  if (!hasGradesInSnapshot(snap) && ppd.grades_json) {
    snap.grades_json = ppd.grades_json;
  }
  return snap;
}

/** Snapshot canónico al INSERT FI — incluye FK imagen (L-R-M-C) y grada. */
export function buildLineaSnapshotForFi(input: {
  linea_codigo: string;
  ref_codigo: string;
  material_code?: string;
  color_code?: string;
  material_nombre?: string;
  color_nombre?: string;
  grades_json?: unknown;
  ic_id?: number;
  origen?: string;
  sin_lpn?: boolean;
}): string {
  const grades = input.grades_json ? gradesJsonSoloTallas(input.grades_json) : null;
  const payload: Record<string, unknown> = {
    linea_codigo: input.linea_codigo,
    ref_codigo: input.ref_codigo,
    material_code: String(input.material_code ?? "").trim(),
    color_code: String(input.color_code ?? "").trim(),
    material_nombre: input.material_nombre ?? "",
    color_nombre: input.color_nombre ?? "",
  };
  if (grades && Object.keys(grades).length > 0) payload.grades_json = grades;
  if (input.ic_id != null) payload.ic_id = input.ic_id;
  if (input.origen) payload.origen = input.origen;
  if (input.sin_lpn) payload.sin_lpn = true;
  return JSON.stringify(payload);
}
