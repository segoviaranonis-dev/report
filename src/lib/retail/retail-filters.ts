import type { RetailStagingRow } from "@/lib/retail/staging-row";

export type RetailFilterState = {
  marcaId: string;
  grupoEstiloId: string;
  lineaIds: number[];
  tipoIds: number[];
  colores: string[];
  q: string;
};

export const EMPTY_RETAIL_FILTERS: RetailFilterState = {
  marcaId: "",
  grupoEstiloId: "",
  lineaIds: [],
  tipoIds: [],
  colores: [],
  q: "",
};

export function parseRetailFiltersFromSearchParams(sp: URLSearchParams): RetailFilterState {
  const lineaIds = (sp.get("linea_ids") ?? "")
    .split(",")
    .filter(Boolean)
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n));
  const tipoIds = (sp.get("tipo_ids") ?? "")
    .split(",")
    .filter(Boolean)
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n));
  const colores = (sp.get("colores") ?? "").split(",").filter(Boolean);
  return {
    marcaId: sp.get("marca_id") ?? "",
    grupoEstiloId: sp.get("grupo_estilo_id") ?? "",
    lineaIds,
    tipoIds,
    colores,
    q: sp.get("q") ?? "",
  };
}

export function retailFiltersToQuery(f: RetailFilterState): string {
  const p = new URLSearchParams();
  if (f.marcaId) p.set("marca_id", f.marcaId);
  if (f.grupoEstiloId) p.set("grupo_estilo_id", f.grupoEstiloId);
  if (f.lineaIds.length) p.set("linea_ids", f.lineaIds.join(","));
  if (f.tipoIds.length) p.set("tipo_ids", f.tipoIds.join(","));
  if (f.colores.length) p.set("colores", f.colores.join(","));
  if (f.q.trim()) p.set("q", f.q.trim());
  const s = p.toString();
  return s ? `&${s}` : "";
}

export function applyRetailFilters(rows: RetailStagingRow[], f: RetailFilterState): RetailStagingRow[] {
  let out = rows;
  if (f.marcaId) {
    const mid = Number(f.marcaId);
    out = out.filter((r) => r.marca_id === mid);
  }
  if (f.grupoEstiloId) {
    const gid = Number(f.grupoEstiloId);
    out = out.filter((r) => r.grupo_estilo_id === gid);
  }
  if (f.lineaIds.length) {
    const set = new Set(f.lineaIds);
    out = out.filter((r) => r.linea_id != null && set.has(r.linea_id));
  }
  if (f.tipoIds.length) {
    const set = new Set(f.tipoIds);
    out = out.filter((r) => r.tipo_1_id != null && set.has(r.tipo_1_id));
  }
  if (f.colores.length) {
    const set = new Set(f.colores.map((c) => c.toLowerCase()));
    out = out.filter((r) => {
      const d = (r.descp_color ?? "").toLowerCase();
      return d && set.has(d);
    });
  }
  const q = f.q.trim().toLowerCase();
  if (q) {
    out = out.filter((r) => {
      const blob = `${r.linea_code} ${r.referencia_code} ${r.marca} ${r.estilo}`.toLowerCase();
      return blob.includes(q);
    });
  }
  return out;
}
