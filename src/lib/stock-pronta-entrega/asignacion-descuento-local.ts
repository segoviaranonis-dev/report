/**
 * Persistencia v1 local — Asignación descuentos PE (dictador).
 * Clave = molécula comercial L-R-mat-color (misma que grilla / Web).
 * Sync BD + Web + FI = siguiente iteración.
 */

import { moleculeKeyVentas } from "@/lib/clientes/etiqueta-comprador";

export type PeAsignacionDescuentoPayload = {
  batch_label: string;
  pct: number;
  molecule_keys: string[];
  assigned_at: string;
};

const key = (batch: string) => `pe_asig_descuento_v1_${batch}`;

export function moleculeKeyDescuentoPe(p: {
  linea_codigo_proveedor?: string | null;
  referencia_codigo_proveedor?: string | null;
  material_code?: string | null;
  color_code?: string | null;
}): string {
  return moleculeKeyVentas(
    p.linea_codigo_proveedor ?? "",
    p.referencia_codigo_proveedor ?? "",
    p.material_code ?? "",
    p.color_code ?? "",
  );
}

export function savePeAsignacionDescuentoLocal(
  payload: PeAsignacionDescuentoPayload,
): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(key(payload.batch_label), JSON.stringify(payload));
}

export function loadPeAsignacionDescuentoLocal(
  batchLabel: string,
): PeAsignacionDescuentoPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key(batchLabel));
    if (!raw) return null;
    return JSON.parse(raw) as PeAsignacionDescuentoPayload;
  } catch {
    return null;
  }
}

/** Mapa molécula → % para pintar grilla. */
export function mapDescuentoPeLocal(batchLabel: string): Map<string, number> {
  const payload = loadPeAsignacionDescuentoLocal(batchLabel);
  const map = new Map<string, number>();
  if (!payload) return map;
  for (const k of payload.molecule_keys) map.set(k, payload.pct);
  return map;
}

export function parsePctDescuento(raw: string): number | null {
  const n = Number(String(raw).trim().replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.round(n * 100) / 100;
}
