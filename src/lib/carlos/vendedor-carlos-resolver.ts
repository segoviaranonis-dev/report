/**
 * Traductor vendedor → Código de vendedor real (Hoja2 vendedor list.xlsx).
 */
import canon from "./vendedor-list-canon.json";

export const VENDEDOR_CARLOS_FUENTE = canon.fuente;

type VendedorEntry = {
  cod_nexus_excel: number;
  casos: Record<string, number>;
};

const VENDEDORES = canon.vendedores as Record<string, VendedorEntry>;

const CASOS_ORDEN = [
  "ACT-BRSPORT",
  "CARTERAS",
  "PROMOCIONAL",
  "CLASICOS",
  "TENIS",
  "CHINELO",
  "BR-VZ-MD-ML-MKA-O",
] as const;

/** Alias typo / variantes Nexus → nombre Hoja2. */
export function normalizeVendedorNombre(raw: string | null | undefined): string {
  const n = String(raw ?? "").trim().toUpperCase();
  if (n === "IRMA") return "YRMA";
  if (n === "GRACIELA") return "GRICELDA";
  return n;
}

const CASO_PE_PLACEHOLDER = /^PE(\s|[·•\-]|$)/i;

/** Caso comercial Carlos — fi.caso PE·batch no sirve; fallback BR-VZ calzado. */
export function resolveCasoComercialCarlos(
  caso: string | null | undefined,
  payload?: unknown,
): string {
  const raw = String(caso ?? "").trim();
  if (raw && !CASO_PE_PLACEHOLDER.test(raw)) {
    const up = raw.toUpperCase();
    for (const key of CASOS_ORDEN) {
      if (up === key || up.includes(key)) return key;
    }
    return raw;
  }

  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const lotes = (payload as Record<string, unknown>).lotes;
    if (Array.isArray(lotes)) {
      for (const lote of lotes) {
        if (!lote || typeof lote !== "object") continue;
        const facturas = (lote as Record<string, unknown>).facturas;
        if (!Array.isArray(facturas)) continue;
        for (const f of facturas) {
          if (!f || typeof f !== "object") continue;
          const c = String((f as Record<string, unknown>).caso ?? "").trim();
          if (c && !CASO_PE_PLACEHOLDER.test(c)) {
            const resolved = resolveCasoComercialCarlos(c);
            if (!CASO_PE_PLACEHOLDER.test(resolved)) return resolved;
          }
        }
      }
    }
  }

  return "BR-VZ-MD-ML-MKA-O";
}

function matchCaso(casoRaw: string | null | undefined, casos: Record<string, number>): number | null {
  const raw = String(casoRaw ?? "").trim().toUpperCase();
  if (!raw) return null;

  if (casos[raw] != null) return casos[raw];

  for (const key of CASOS_ORDEN) {
    const mk = key.toUpperCase();
    if (raw === mk || raw.includes(mk) || mk.includes(raw)) {
      const hit = casos[key];
      if (hit != null) return hit;
    }
  }

  for (const [key, id] of Object.entries(casos)) {
    const mk = key.toUpperCase();
    if (raw.includes(mk) || mk.includes(raw)) return id;
  }

  return null;
}

function findVendedorEntry(nombre: string): VendedorEntry | null {
  const n = normalizeVendedorNombre(nombre);
  if (!n) return null;
  if (VENDEDORES[n]) return VENDEDORES[n];

  for (const [key, entry] of Object.entries(VENDEDORES)) {
    if (key.includes(n) || n.includes(key)) return entry;
  }
  return null;
}

/** Código de vendedor real para col CSV `vendedor`. */
export function resolveCodigoVendedorReal(opts: {
  vendedor_nombre?: string | null;
  caso?: string | null;
  codigo_vendedor_carlos?: string | number | null;
}): string | null {
  const pinned = opts.codigo_vendedor_carlos;
  if (pinned != null && String(pinned).trim() !== "") {
    const n = Number(pinned);
    if (Number.isFinite(n) && n > 0) return String(Math.trunc(n));
  }

  const entry = findVendedorEntry(opts.vendedor_nombre ?? "");
  if (!entry) return null;

  const byCaso = matchCaso(opts.caso, entry.casos);
  if (byCaso != null) return String(byCaso);

  for (const key of CASOS_ORDEN) {
    const v = entry.casos[key];
    if (v != null) return String(v);
  }

  const first = Object.values(entry.casos)[0];
  return first != null ? String(first) : null;
}
