/**
 * Persistencia v1 local — Asignación descuentos PE (dictador).
 * Sync Web = siguiente iteración.
 */

export type PeAsignacionDescuentoPayload = {
  batch_label: string;
  pct: number;
  molecule_keys: string[];
  assigned_at: string;
};

const key = (batch: string) => `pe_asig_descuento_v1_${batch}`;

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

export function parsePctDescuento(raw: string): number | null {
  const n = Number(String(raw).trim().replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.round(n * 100) / 100;
}
