import type { Pool } from "pg";
import { normAdminEtiqueta } from "@/lib/pedido-proveedor/administrador-ic-monto";

/** Nombres de caso comercial del evento (precio_evento_caso). */
export async function loadCasosEventoNombres(pool: Pool, eventoId: number): Promise<Set<string>> {
  const { rows } = await pool.query<{ nombre_caso: string }>(
    `SELECT nombre_caso FROM precio_evento_caso WHERE evento_id = $1`,
    [eventoId],
  );
  const set = new Set<string>();
  for (const r of rows) {
    const n = normAdminEtiqueta(String(r.nombre_caso ?? "").replace(/\*/g, ""));
    if (n) set.add(n);
  }
  return set;
}

function limpiarEtiqueta(raw: string): string {
  return String(raw ?? "")
    .replace(/\*/g, "")
    .replace(/—\s*sin estilo\s—/gi, "")
    .replace(/—\s*sin tipo\s—/gi, "")
    .trim();
}

/** STYLE listado motor (grupo estilo molécula L·R, fallback línea). */
export function resolverEstiloListadoMotor(estiloLr: string, estiloLinea: string): string {
  const lr = limpiarEtiqueta(estiloLr);
  if (lr) return lr;
  return limpiarEtiqueta(estiloLinea);
}

/**
 * Caso prefactura / FI — motor de precios + biblioteca (NO pilares sueltos).
 * 1. PELE / biblioteca línea (BCL → evento)
 * 2. precio_lista SKU (nombre_caso_aplicado · pec)
 */
export function resolveCasoMotorPrecios(opts: {
  casoPl: string;
  casoPele: string;
  estiloLr?: string;
  estiloLinea?: string;
  materialHint?: string;
  casosEvento?: Set<string>;
}): string {
  void opts.estiloLr;
  void opts.estiloLinea;
  void opts.materialHint;
  void opts.casosEvento;

  const pele = limpiarEtiqueta(opts.casoPele);
  if (pele) return pele;

  const pl = limpiarEtiqueta(opts.casoPl);
  if (pl && pl !== "—") return pl;

  return "—";
}

export function resolveCasoComercial(opts: {
  casoPl: string;
  casoPele: string;
  estiloLr?: string;
  estiloLinea?: string;
  materialHint?: string;
  casosEvento?: Set<string>;
}): string {
  return resolveCasoMotorPrecios(opts);
}

export function resolveCasoPrefactura(opts: {
  casoPl: string;
  casoPele: string;
  estiloLr?: string;
  estiloLinea?: string;
  materialHint?: string;
  casosEvento?: Set<string>;
}): string {
  return resolveCasoMotorPrecios(opts);
}

export function casoLineaFromMapa(mapa: Map<string, string>, lineaCod: string): string {
  const cod = String(Math.trunc(Number(lineaCod)));
  if (!cod || cod === "NaN") return "";
  return mapa.get(cod) ?? "";
}

/** Excel BRAND = nombre de caso comercial (ej. CHINELO), no marca real. */
export function brandEsCasoComercial(brand: string, casosEvento: Set<string>): boolean {
  const n = normAdminEtiqueta(String(brand ?? "").replace(/\*/g, ""));
  return n !== "" && casosEvento.has(n);
}

export type LineaMarcaHit = { id_marca: number; nombre: string };

/**
 * R-MARCA-PF-1 — import proforma: marca PPD = marca línea (pilar), caso ≠ marca.
 * Si BRAND del Excel es un caso del evento/biblioteca, no usar marcaLookup.
 */
export function resolveMarcaProformaImport(opts: {
  brandExcel: string;
  lineaCod: string;
  marcaLookup: Map<string, number>;
  casosEvento: Set<string>;
  lineaMarcaByCod: Map<string, LineaMarcaHit>;
}): { id_marca: number | null; brandParaJson: string } {
  const brandRaw = String(opts.brandExcel ?? "").trim();
  const brandKey = brandRaw.toUpperCase();
  const lineaCod = String(opts.lineaCod ?? "").trim();
  const lineaHit = opts.lineaMarcaByCod.get(lineaCod);

  if (brandEsCasoComercial(brandKey, opts.casosEvento)) {
    if (lineaHit) {
      return { id_marca: lineaHit.id_marca, brandParaJson: lineaHit.nombre };
    }
    return { id_marca: null, brandParaJson: brandRaw };
  }

  const idFromBrand = brandKey ? opts.marcaLookup.get(brandKey) ?? null : null;
  const id_marca = idFromBrand ?? lineaHit?.id_marca ?? null;
  const brandParaJson = brandKey || lineaHit?.nombre || brandRaw;
  return { id_marca, brandParaJson };
}
