import type { RetailStagingRow } from "@/lib/retail/staging-row";

export type RetailFilterState = {
  generoId: string;
  marcaId: string;
  grupoEstiloId: string;
  lineaIds: number[];
  tipoIds: number[];
  tipoV2Ids: number[];  // NUEVO: Filtro Calzados/Confecciones
  colorIds: number[];
  q: string;
};

export const EMPTY_RETAIL_FILTERS: RetailFilterState = {
  generoId: "",
  marcaId: "",
  grupoEstiloId: "",
  lineaIds: [],
  tipoIds: [],
  tipoV2Ids: [],  // NUEVO
  colorIds: [],
  q: "",
};

function parseIdList(raw: string | null): number[] {
  return (raw ?? "")
    .split(",")
    .filter(Boolean)
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n));
}

export function parseRetailFiltersFromSearchParams(sp: URLSearchParams): RetailFilterState {
  return {
    generoId: sp.get("genero_id") ?? "",
    marcaId: sp.get("marca_id") ?? "",
    grupoEstiloId: sp.get("grupo_estilo_id") ?? "",
    lineaIds: parseIdList(sp.get("linea_ids")),
    tipoIds: parseIdList(sp.get("tipo_ids")),
    tipoV2Ids: parseIdList(sp.get("tipo_v2_ids")),  // NUEVO
    colorIds: parseIdList(sp.get("color_ids")),
    q: sp.get("q") ?? "",
  };
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

  // Tipo V2 (Calzados/Confecciones): normalizar a número
  if (f.tipoV2Ids.length) {
    const set = new Set(f.tipoV2Ids);
    out = out.filter((r) => r.tipo_v2_id != null && set.has(Number(r.tipo_v2_id)));
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
