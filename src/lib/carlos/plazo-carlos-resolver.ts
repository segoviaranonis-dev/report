/**
 * Traductor plazo → Cod. Oper. Carlos (Condiciones - Hector.xlsx col A).
 * Fuente canónica en disco: condiciones-hector-canon.json
 */
import canon from "./condiciones-hector-canon.json";

export type PlazoCarlosCanon = {
  cod_oper_carlos: string;
  dias_vto: string;
  label_ui: string;
  orden: number;
  id_plazo?: number | null;
};

export const PLAZO_CARLOS_FUENTE = canon.fuente;

export const PLAZO_CARLOS_FILAS: PlazoCarlosCanon[] = [...canon.filas].sort(
  (a, b) => a.orden - b.orden,
);

const BY_COD = new Map(PLAZO_CARLOS_FILAS.map((r) => [r.cod_oper_carlos.toUpperCase(), r]));
const BY_ID_PLAZO = new Map(
  PLAZO_CARLOS_FILAS.filter((r) => r.id_plazo != null).map((r) => [Number(r.id_plazo), r]),
);

/** Resuelve Cod. Oper. para CSV Carlos — nunca CR-{cliente}{plazo}. */
export function resolveCodOperCarlos(opts: {
  cod_oper_carlos?: string | null;
  cod_oper?: string | null;
  cod_operacion?: string | null;
  plazo_id?: number | string | null;
  plazo_cod_oper?: string | null;
  payload?: unknown;
}): string | null {
  const fromPayload = pickFromPayload(opts.payload);
  if (fromPayload) return fromPayload;

  for (const v of [opts.cod_oper_carlos, opts.cod_oper, opts.cod_operacion, opts.plazo_cod_oper]) {
    const c = normCod(v);
    if (c) return c;
  }

  const pid = Number(opts.plazo_id);
  if (Number.isFinite(pid) && pid > 0) {
    const hit = BY_ID_PLAZO.get(pid);
    if (hit) return hit.cod_oper_carlos;
  }

  return null;
}

function pickFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const p = payload as Record<string, unknown>;
  for (const k of ["cod_oper_carlos", "cod_oper", "cod_operacion", "codigo_operacion"]) {
    const c = normCod(p[k]);
    if (c) return c;
  }
  return null;
}

function normCod(raw: unknown): string | null {
  const s = String(raw ?? "").trim().toUpperCase();
  if (!s || s === "CR-0") return null;
  if (BY_COD.has(s)) return s;
  if (s.startsWith("CR-") || s.startsWith("CR")) return s;
  return null;
}

export function labelPlazoCarlos(cod: string): string {
  return BY_COD.get(cod.toUpperCase())?.label_ui ?? cod;
}
