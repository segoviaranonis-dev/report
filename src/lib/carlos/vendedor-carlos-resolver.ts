/**
 * Traductor vendedor → Código de vendedor real (Hoja2 vendedor list.xlsx).
 *
 * Punto neurálgico contable/comisión (2%/4% vía códigos Carlos).
 * Regla bancaria: si el texto de caso contiene una clave Hoja2 (p.ej. PROMOCIONAL),
 * NUNCA ignorarla por prefijo UI `PE ·…` ni caer a BR-VZ.
 */
import canon from "./vendedor-list-canon.json";

export const VENDEDOR_CARLOS_FUENTE = canon.fuente;

type VendedorEntry = {
  cod_nexus_excel: number;
  casos: Record<string, number>;
};

const VENDEDORES = canon.vendedores as Record<string, VendedorEntry>;

/** Orden Hoja2 — más específico comercial antes del fallback calzado BR-VZ. */
export const CASOS_ORDEN = [
  "ACT-BRSPORT",
  "CARTERAS",
  "PROMOCIONAL",
  "CLASICOS",
  "TENIS",
  "CHINELO",
  "BR-VZ-MD-ML-MKA-O",
] as const;

export type CasoCarlosCanonico = (typeof CASOS_ORDEN)[number];

/** Alias typo / variantes Nexus → nombre Hoja2. */
export function normalizeVendedorNombre(raw: string | null | undefined): string {
  const n = String(raw ?? "").trim().toUpperCase();
  if (n === "IRMA") return "YRMA";
  if (n === "GRACIELA") return "GRICELDA";
  if (n === "LUIS") return "LUISLV";
  if (n.startsWith("EDUARDO")) return "EDUARDO ARAUJO G.";
  if (n.startsWith("ENRIQUE")) return "ENRIQUE";
  return n;
}

/**
 * Extrae clave comercial Carlos desde cualquier etiqueta UI/BD
 * (`PROMOCIONAL`, `PE · batch · PROMOCIONAL`, `PE-PROMOCIONAL`, …).
 * Preferencia: primera clave de CASOS_ORDEN presente en el texto.
 */
export function extractCasoCanonicoFromText(
  caso: string | null | undefined,
): CasoCarlosCanonico | null {
  const up = String(caso ?? "").trim().toUpperCase();
  if (!up) return null;
  for (const key of CASOS_ORDEN) {
    if (up === key || up.includes(key)) return key;
  }
  return null;
}

/**
 * Caso comercial Carlos.
 * 1) Clave Hoja2 en el string (aunque empiece con PE ·)
 * 2) Payload lotes/facturas
 * 3) Fallback BR-VZ solo si no hay clave comercial detectable
 */
export function resolveCasoComercialCarlos(
  caso: string | null | undefined,
  payload?: unknown,
): string {
  const fromRaw = extractCasoCanonicoFromText(caso);
  if (fromRaw) return fromRaw;

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
          const fromPayload = extractCasoCanonicoFromText(c);
          if (fromPayload) return fromPayload;
        }
      }
    }
  }

  const raw = String(caso ?? "").trim();
  if (raw && !extractCasoCanonicoFromText(raw)) {
    // Texto no vacío sin clave Hoja2 (p.ej. solo "PE · 228") → calzado default.
    return "BR-VZ-MD-ML-MKA-O";
  }

  return "BR-VZ-MD-ML-MKA-O";
}

/**
 * Barrera bancaria: el caso resuelto debe coincidir con la clave extraíble del crudo.
 * Evita regresión PE·PROMO → BR-VZ (ATI 49→53).
 */
export function assertCasoCarlosIntegridadBancaria(opts: {
  casoRaw: string | null | undefined;
  casoResuelto: string;
}): void {
  const expected = extractCasoCanonicoFromText(opts.casoRaw);
  if (!expected) return;
  if (opts.casoResuelto !== expected) {
    throw new Error(
      `Integridad Carlos rotura bancaria · crudo contiene ${expected} pero resolvió ${opts.casoResuelto} · raw=${String(opts.casoRaw ?? "").slice(0, 120)}`,
    );
  }
}

function matchCaso(casoRaw: string | null | undefined, casos: Record<string, number>): number | null {
  const canonCaso = extractCasoCanonicoFromText(casoRaw) ?? String(casoRaw ?? "").trim().toUpperCase();
  if (!canonCaso) return null;

  if (casos[canonCaso] != null) return casos[canonCaso];

  const raw = canonCaso.toUpperCase();
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

/** UI / auditoría: `YRMA(44)` */
export function formatVendedorCarlosLabel(opts: {
  vendedor_nombre?: string | null;
  caso?: string | null;
  codigo_vendedor_carlos?: string | number | null;
  payload?: unknown;
}): string {
  const nombre = String(opts.vendedor_nombre ?? "").trim() || "—";
  const casoCarlos = resolveCasoComercialCarlos(opts.caso, opts.payload);
  assertCasoCarlosIntegridadBancaria({ casoRaw: opts.caso, casoResuelto: casoCarlos });
  const cod = resolveCodigoVendedorReal({
    vendedor_nombre: opts.vendedor_nombre,
    caso: casoCarlos,
    codigo_vendedor_carlos: opts.codigo_vendedor_carlos,
  });
  return cod ? `${nombre}(${cod})` : nombre;
}

/** Col CSV `vendedor` — lanza si no hay código Carlos (veneno inválido). */
export function resolveVendedorCarlosParaCsv(opts: {
  vendedor_nombre?: string | null;
  caso?: string | null;
  codigo_vendedor_carlos?: string | number | null;
  payload?: unknown;
  override?: string | null;
}): string {
  const pinned = opts.override ?? opts.codigo_vendedor_carlos;
  if (pinned != null && String(pinned).trim() !== "") {
    const n = Number(pinned);
    if (Number.isFinite(n) && n > 0) return String(Math.trunc(n));
  }
  const casoCarlos = resolveCasoComercialCarlos(opts.caso, opts.payload);
  assertCasoCarlosIntegridadBancaria({ casoRaw: opts.caso, casoResuelto: casoCarlos });

  // Defensa extra: PROMO en crudo no puede terminar en código BR-VZ del vendedor.
  const entry = findVendedorEntry(opts.vendedor_nombre ?? "");
  if (entry && extractCasoCanonicoFromText(opts.caso) === "PROMOCIONAL") {
    const codPromo = entry.casos.PROMOCIONAL;
    const codBr = entry.casos["BR-VZ-MD-ML-MKA-O"];
    if (codPromo != null && codBr != null && codPromo !== codBr) {
      const provisional = resolveCodigoVendedorReal({
        vendedor_nombre: opts.vendedor_nombre,
        caso: casoCarlos,
        codigo_vendedor_carlos: pinned,
      });
      if (provisional === String(codBr)) {
        throw new Error(
          `Integridad Carlos PROMO→BR-VZ · vendedor=${opts.vendedor_nombre} · esperado ${codPromo} · raw=${String(opts.caso).slice(0, 80)}`,
        );
      }
    }
  }

  const cod = resolveCodigoVendedorReal({
    vendedor_nombre: opts.vendedor_nombre,
    caso: casoCarlos,
    codigo_vendedor_carlos: pinned,
  });
  if (cod) return cod;
  throw new Error(
    `Código de vendedor real no resuelto · vendedor=${opts.vendedor_nombre ?? "—"} · caso=${casoCarlos}`,
  );
}
