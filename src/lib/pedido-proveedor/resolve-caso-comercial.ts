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
