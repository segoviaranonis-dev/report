/**
 * grades_json en PPD — tallas + metadata F9 (_shop, _brand, _item).
 * Ley: solo claves numéricas 20–55 son tallas; metadata nunca entra a grada CSV/UI.
 */

export const GRADES_JSON_META_KEYS = ["_shop", "_brand", "_item"] as const;

const META_SET = new Set<string>(GRADES_JSON_META_KEYS);

export function isGradesTallaKey(key: string): boolean {
  const k = String(key ?? "").trim();
  if (!k || k.startsWith("_") || META_SET.has(k)) return false;
  const head = (k.split("/")[0] ?? k).replace(/[^\d.]/g, "");
  const n = Number(head);
  return Number.isFinite(n) && n >= 20 && n <= 55;
}

function parseRawObject(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const j = JSON.parse(raw.trim()) as unknown;
    return typeof j === "object" && j !== null && !Array.isArray(j) ? (j as Record<string, unknown>) : null;
  } catch {
    try {
      const j = JSON.parse(raw.trim().replace(/'/g, '"')) as unknown;
      return typeof j === "object" && j !== null && !Array.isArray(j) ? (j as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
}

/** Solo tallas — excluye _shop / _brand / _item y claves no calzado. */
export function gradesJsonSoloTallas(raw: unknown): Record<string, number> {
  const obj = parseRawObject(raw);
  if (!obj) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!isGradesTallaKey(k)) continue;
    const n = Number(v);
    if (Number.isFinite(n)) out[String(k).trim()] = n;
  }
  return out;
}

export function readGradesMeta(raw: unknown): { shop?: string; brand?: string; item?: string } {
  const obj = parseRawObject(raw);
  if (!obj) return {};
  return {
    shop: typeof obj._shop === "string" ? obj._shop : undefined,
    brand: typeof obj._brand === "string" ? obj._brand : undefined,
    item: typeof obj._item === "string" ? obj._item : undefined,
  };
}
