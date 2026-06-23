import type { RetailStagingRow } from "@/lib/retail/staging-row";

export type RetailFilterState = {
  generoId: string;
  marcaId: string;
  grupoEstiloId: string;
  lineaIds: number[];
  tipoIds: number[];
  tipoV2Ids: number[];  // 1=Calzados · 2=Confecciones
  colorIds: number[];
  q: string;
};

/** tipo_v2_id canónico — alineado pilares / import Kyly. */
export const TIPO_V2_CALZADO = 1;
export const TIPO_V2_CONFECCIONES = 2;

export const EMPTY_RETAIL_FILTERS: RetailFilterState = {
  generoId: "",
  marcaId: "",
  grupoEstiloId: "",
  lineaIds: [],
  tipoIds: [],
  tipoV2Ids: [],
  colorIds: [],
  q: "",
};

/** Predeterminado Report Retail: solo calzado 654 (excluye confecciones ref K). */
export const DEFAULT_RETAIL_FILTERS: RetailFilterState = {
  ...EMPTY_RETAIL_FILTERS,
  tipoV2Ids: [TIPO_V2_CALZADO],
};

function parseIdList(raw: string | null): number[] {
  return (raw ?? "")
    .split(",")
    .filter(Boolean)
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n));
}

/** Aplica default calzados si no hay tipo_v2 en URL/estado. */
export function resolveRetailFilters(f: RetailFilterState): RetailFilterState {
  if (f.tipoV2Ids.length > 0) return f;
  return { ...f, tipoV2Ids: [TIPO_V2_CALZADO] };
}

export function parseRetailFiltersFromSearchParams(sp: URLSearchParams): RetailFilterState {
  const hasTipoV2 = sp.has("tipo_v2_ids");
  const base: RetailFilterState = {
    generoId: sp.get("genero_id") ?? "",
    marcaId: sp.get("marca_id") ?? "",
    grupoEstiloId: sp.get("grupo_estilo_id") ?? "",
    lineaIds: parseIdList(sp.get("linea_ids")),
    tipoIds: parseIdList(sp.get("tipo_ids")),
    tipoV2Ids: hasTipoV2 ? parseIdList(sp.get("tipo_v2_ids")) : [TIPO_V2_CALZADO],
    colorIds: parseIdList(sp.get("color_ids")),
    q: sp.get("q") ?? "",
  };
  return base;
}

export function retailFiltersToQuery(f: RetailFilterState): string {
  const p = new URLSearchParams();
  if (f.generoId) p.set("genero_id", f.generoId);
  if (f.marcaId) p.set("marca_id", f.marcaId);
  if (f.grupoEstiloId) p.set("grupo_estilo_id", f.grupoEstiloId);
  if (f.lineaIds.length) p.set("linea_ids", f.lineaIds.join(","));
  if (f.tipoIds.length) p.set("tipo_ids", f.tipoIds.join(","));
  if (f.tipoV2Ids.length) p.set("tipo_v2_ids", f.tipoV2Ids.join(","));  // NUEVO
  if (f.colorIds.length) p.set("color_ids", f.colorIds.join(","));
  if (f.q.trim()) p.set("q", f.q.trim());
  const s = p.toString();
  return s ? `&${s}` : "";
}

export function applyRetailFilters(rows: RetailStagingRow[], f: RetailFilterState): RetailStagingRow[] {
  let out = rows;

  // Género: normalizar a número para comparación robusta
  if (f.generoId) {
    const gid = Number(f.generoId);
    out = out.filter((r) => Number(r.genero_id) === gid);
  }

  // Marca: normalizar a número
  if (f.marcaId) {
    const mid = Number(f.marcaId);
    out = out.filter((r) => Number(r.marca_id) === mid);
  }

  // Estilo: normalizar a número
  if (f.grupoEstiloId) {
    const gid = Number(f.grupoEstiloId);
    out = out.filter((r) => Number(r.grupo_estilo_id) === gid);
  }

  // Línea: normalizar a número
  if (f.lineaIds.length) {
    const set = new Set(f.lineaIds);
    out = out.filter((r) => r.linea_id != null && set.has(Number(r.linea_id)));
  }

  // Tipo: normalizar a número
  if (f.tipoIds.length) {
    const set = new Set(f.tipoIds);
    out = out.filter((r) => r.tipo_1_id != null && set.has(Number(r.tipo_1_id)));
  }

  // Tipo V2 (Calzados/Confecciones)
  if (f.tipoV2Ids.length) {
    const set = new Set(f.tipoV2Ids);
    out = out.filter((r) => {
      const tv2 = r.tipo_v2_id != null ? Number(r.tipo_v2_id) : TIPO_V2_CALZADO;
      return set.has(tv2);
    });
  }

  // Color: normalizar a número
  if (f.colorIds.length) {
    const set = new Set(f.colorIds);
    out = out.filter((r) => r.color_id != null && set.has(Number(r.color_id)));
  }
  const q = f.q.trim().toLowerCase();
  if (q) {
    out = out.filter((r) => {
      const blob = `${r.linea_codigo_proveedor} ${r.referencia_codigo_proveedor} ${r.marca} ${r.estilo}`.toLowerCase();
      return blob.includes(q);
    });
  }
  return out;
}
