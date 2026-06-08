import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";

export type DepositoFilterState = {
  tipoV2Id: string;        // 1=CALZADO, 2=CONFECCIONES
  marcaId: string;
  generoId: string;
  grupoEstiloId: string;
  lineaIds: number[];
  colorIds: number[];
  q: string;
};

export const EMPTY_DEPOSITO_FILTERS: DepositoFilterState = {
  tipoV2Id: "",
  marcaId: "",
  generoId: "",
  grupoEstiloId: "",
  lineaIds: [],
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

export function parseDepositoFiltersFromSearchParams(sp: URLSearchParams): DepositoFilterState {
  return {
    tipoV2Id: sp.get("tipo_v2_id") ?? "",
    marcaId: sp.get("marca_id") ?? "",
    generoId: sp.get("genero_id") ?? "",
    grupoEstiloId: sp.get("grupo_estilo_id") ?? "",
    lineaIds: parseIdList(sp.get("linea_ids")),
    colorIds: parseIdList(sp.get("color_ids")),
    q: sp.get("q") ?? "",
  };
}

export function depositoFiltersToQuery(f: DepositoFilterState): string {
  const p = new URLSearchParams();
  if (f.tipoV2Id) p.set("tipo_v2_id", f.tipoV2Id);
  if (f.marcaId) p.set("marca_id", f.marcaId);
  if (f.generoId) p.set("genero_id", f.generoId);
  if (f.grupoEstiloId) p.set("grupo_estilo_id", f.grupoEstiloId);
  if (f.lineaIds.length) p.set("linea_ids", f.lineaIds.join(","));
  if (f.colorIds.length) p.set("color_ids", f.colorIds.join(","));
  if (f.q.trim()) p.set("q", f.q.trim());
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function applyDepositoFilters(rows: DepositoRow[], f: DepositoFilterState): DepositoRow[] {
  let out = rows;

  // Tipo V2 (Calzado/Confecciones)
  if (f.tipoV2Id) {
    const tid = Number(f.tipoV2Id);
    out = out.filter((r) => Number(r.tipo_v2_id) === tid);
  }

  // Marca
  if (f.marcaId) {
    const mid = Number(f.marcaId);
    out = out.filter((r) => Number(r.marca_id) === mid);
  }

  // Género
  if (f.generoId) {
    const gid = Number(f.generoId);
    out = out.filter((r) => Number(r.genero_id) === gid);
  }

  // Estilo
  if (f.grupoEstiloId) {
    const gid = Number(f.grupoEstiloId);
    out = out.filter((r) => Number(r.grupo_estilo_id) === gid);
  }

  // Línea
  if (f.lineaIds.length) {
    const set = new Set(f.lineaIds);
    out = out.filter((r) => r.linea_id != null && set.has(Number(r.linea_id)));
  }

  // Color
  if (f.colorIds.length) {
    const set = new Set(f.colorIds);
    out = out.filter((r) => r.color_id != null && set.has(Number(r.color_id)));
  }

  // Búsqueda de texto
  const q = f.q.trim().toLowerCase();
  if (q) {
    out = out.filter((r) => {
      const blob = `${r.linea_codigo_proveedor} ${r.referencia_codigo_proveedor} ${r.marca} ${r.estilo} ${r.descp_material} ${r.descp_color}`.toLowerCase();
      return blob.includes(q);
    });
  }

  return out;
}
