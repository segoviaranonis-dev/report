import type { AprobacionesFiltros } from "./aprobaciones-filtros-types";
import { FILTROS_VACIOS } from "./aprobaciones-filtros-types";

function splitCsv(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitNums(raw: string | null): number[] {
  return splitCsv(raw)
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => Number.isFinite(n));
}

function normDate(raw: string | null): string | null {
  const t = raw?.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return null;
}

/** Parsea query string API → filtros. */
export function parseFiltrosFromSearchParams(sp: URLSearchParams): AprobacionesFiltros {
  return {
    clienteIds: splitNums(sp.get("cliente_ids")),
    clienteNombres: splitCsv(sp.get("cliente_nombres")),
    marcas: splitCsv(sp.get("marcas")),
    vendedores: splitCsv(sp.get("vendedores")),
    codigosArticulo: splitCsv(sp.get("codigos_articulo")),
    codigosGrupoDpe: splitCsv(sp.get("codigos_grupo_dpe")),
    lineaQ: sp.get("linea")?.trim() ?? "",
    referenciaQ: sp.get("referencia")?.trim() ?? "",
    pvGlobalQ: sp.get("pv")?.trim() ?? "",
    nroFacturaQ: sp.get("nro_fi")?.trim() ?? "",
    fechaDesde: normDate(sp.get("fecha_desde")),
    fechaHasta: normDate(sp.get("fecha_hasta")),
  };
}

/** Serializa filtros para fetch cliente. */
export function filtrosToSearchParams(f: AprobacionesFiltros): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.clienteIds.length) sp.set("cliente_ids", f.clienteIds.join(","));
  if (f.clienteNombres.length) sp.set("cliente_nombres", f.clienteNombres.join(","));
  if (f.marcas.length) sp.set("marcas", f.marcas.join(","));
  if (f.vendedores.length) sp.set("vendedores", f.vendedores.join(","));
  if (f.codigosArticulo.length) sp.set("codigos_articulo", f.codigosArticulo.join(","));
  if (f.codigosGrupoDpe.length) sp.set("codigos_grupo_dpe", f.codigosGrupoDpe.join(","));
  if (f.lineaQ.trim()) sp.set("linea", f.lineaQ.trim());
  if (f.referenciaQ.trim()) sp.set("referencia", f.referenciaQ.trim());
  if (f.pvGlobalQ.trim()) sp.set("pv", f.pvGlobalQ.trim());
  if (f.nroFacturaQ.trim()) sp.set("nro_fi", f.nroFacturaQ.trim());
  if (f.fechaDesde) sp.set("fecha_desde", f.fechaDesde);
  if (f.fechaHasta) sp.set("fecha_hasta", f.fechaHasta);
  return sp;
}

export function mergeFiltros(partial: Partial<AprobacionesFiltros>): AprobacionesFiltros {
  return { ...FILTROS_VACIOS, ...partial };
}
