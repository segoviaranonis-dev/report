/**
 * Normalización talla/grada — operativa depósito Bazzar (niños · medias · adultos).
 * Alinea etiquetas UI, cards y filtro (CSV POS · Retail · N°17 · 17/18 · 17.0).
 */

/** Etiqueta canónica para chips y columnas de card. */
export function normalizeGradaLabel(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim();
  if (!s || /sin grada/i.test(s)) return "";

  if (/^\d{1,2}\/\d{1,2}$/.test(s)) return s;

  const asFloat = s.match(/^(\d{1,2})\.0+$/);
  if (asFloat) return asFloat[1];

  const nPrefix = s.match(/^[nN][°ºoø.]?\s*(\d{1,2}(?:\/\d{1,2})?)/);
  if (nPrefix) return nPrefix[1];

  if (/^\d{1,2}$/.test(s)) return s;

  const half = s.match(/(\d{1,2}\/\d{1,2})/);
  if (half) return half[1];

  const two = s.match(/(\d{2})/);
  if (two) return two[1];

  const one = s.match(/(\d{1,2})/);
  if (one) return one[1];

  return s;
}

/** Claves equivalentes para match filtro (sin duplicar cantidad). */
export function gradaMatchKeys(raw: string | null | undefined): string[] {
  const s = String(raw ?? "").trim();
  if (!s || /sin grada/i.test(s)) return [];

  const keys = new Set<string>();
  keys.add(s);

  const label = normalizeGradaLabel(s);
  if (label) keys.add(label);

  const half = label.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (half) {
    keys.add(half[1]);
    keys.add(half[2]);
  }

  return [...keys];
}

export function matchesGradaSelection(
  selected: string[],
  rowGrada: string | null | undefined,
): boolean {
  if (!selected.length) return true;

  const rowKeys = gradaMatchKeys(rowGrada);
  if (!rowKeys.length) return false;

  return selected.some((sel) => {
    const selKeys = gradaMatchKeys(sel);
    return selKeys.some((sk) => rowKeys.includes(sk));
  });
}

export function sortGradaLabels(a: string, b: string): number {
  const la = normalizeGradaLabel(a) || a;
  const lb = normalizeGradaLabel(b) || b;
  const na = Number(la.split("/")[0]);
  const nb = Number(lb.split("/")[0]);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return la.localeCompare(lb, "es");
}
