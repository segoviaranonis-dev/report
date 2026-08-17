/**
 * Cascada Admin L×R — espejo rimec-web/lib/catalogoCascadaMolecula.ts
 * Dimensiones → limpia Molécula E→L→R→M→C.
 * Hermano AP · superficie `/pilares/linea-referencia`.
 */

import { parseTipoV2Id } from "@/lib/pilares/constants";

export type LrOrigenTipo = "TODOS" | "CP" | "PRONTA_ENTREGA";
export type LrDepositoCodigo = "" | "D1" | "DEP2" | "D3";

export type LrCabeceraState = {
  tipo_v2_id: 1 | 2;
  origen_tipo: LrOrigenTipo;
  deposito_codigo: LrDepositoCodigo;
  buscar: string;
  genero_ids: number[];
  marca_ids: number[];
  tipo_1_ids: number[];
  tipo_grupos: string[];
  estilo_ids: number[];
  estilo_null: boolean;
  problemas_estilo: boolean;
  con_imagen: "" | "1" | "0";
  /** ids de linea */
  linea_ids: number[];
  referencia_ids: number[];
  material_familias: string[];
  color_familias: string[];
};

export type LrCabeceraPatch = Partial<LrCabeceraState>;

export function toggleId(list: number[], id: number): number[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export function toggleStr(list: string[], key: string): string[] {
  return list.includes(key) ? list.filter((x) => x !== key) : [...list, key];
}

/** Alias siames W · códigos proveedor en pills Línea (Admin L×R). */
export const toggleCodigo = toggleStr;

/** Dimensión → limpia molécula completa. */
export function cascadaDimensiones(patch: LrCabeceraPatch = {}): LrCabeceraPatch {
  return {
    ...patch,
    estilo_ids: [],
    estilo_null: false,
    problemas_estilo: false,
    con_imagen: "",
    linea_ids: [],
    referencia_ids: [],
    material_familias: [],
    color_familias: [],
  };
}

export function cascadaEstilo(estilo_ids: number[]): LrCabeceraPatch {
  return {
    estilo_ids,
    estilo_null: false,
    problemas_estilo: false,
    con_imagen: "",
    linea_ids: [],
    referencia_ids: [],
    material_familias: [],
    color_familias: [],
  };
}

export function cascadaEstiloNull(on: boolean): LrCabeceraPatch {
  return {
    ...cascadaEstilo([]),
    estilo_null: on,
  };
}

export function cascadaProblemasEstilo(on: boolean): LrCabeceraPatch {
  return {
    problemas_estilo: on,
    estilo_ids: [],
    estilo_null: false,
    con_imagen: "",
    linea_ids: [],
    referencia_ids: [],
    material_familias: [],
    color_familias: [],
  };
}

export function cascadaLinea(linea_ids: number[]): LrCabeceraPatch {
  return {
    linea_ids,
    referencia_ids: [],
    material_familias: [],
    color_familias: [],
  };
}

export function cascadaReferencia(referencia_ids: number[]): LrCabeceraPatch {
  return {
    referencia_ids,
    material_familias: [],
    color_familias: [],
  };
}

export function cascadaMaterial(material_familias: string[]): LrCabeceraPatch {
  return { material_familias, color_familias: [] };
}

export function cascadaColor(color_familias: string[]): LrCabeceraPatch {
  return { color_familias };
}

export function resetCascadaAlCambiarTipoV2(tipo_v2_id: 1 | 2): LrCabeceraPatch {
  return {
    ...emptyLrCabecera(tipo_v2_id),
    tipo_v2_id,
  };
}

function parseIdsCsv(raw: string | null): number[] {
  if (!raw?.trim() || raw === "__null__") return [];
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
}

function parseOrigenCsv(raw: string | null): LrOrigenTipo {
  const u = (raw || "TODOS").toUpperCase();
  if (u.includes("PRONTA")) return "PRONTA_ENTREGA";
  if (u === "CP" || u.includes("PREVIA")) return "CP";
  return "TODOS";
}

export function lrStateFromSearchParams(sp: URLSearchParams): LrCabeceraState {
  const tipo = parseTipoV2Id(sp.get("tipo_v2_id")) as 1 | 2;
  const estiloRaw = sp.get("estilo_ids") || sp.get("estilo_id");
  const dep = (sp.get("deposito_codigo") || "") as LrDepositoCodigo;
  return {
    tipo_v2_id: tipo,
    origen_tipo: parseOrigenCsv(sp.get("origen_tipo")),
    deposito_codigo: dep === "D1" || dep === "DEP2" || dep === "D3" ? dep : "",
    buscar: sp.get("q") || sp.get("buscar") || "",
    genero_ids: parseIdsCsv(sp.get("genero_ids") || sp.get("genero_id")),
    marca_ids: parseIdsCsv(sp.get("marca_ids")),
    tipo_1_ids: parseIdsCsv(sp.get("tipo_1_ids") || sp.get("tipo_1_id")),
    tipo_grupos: (sp.get("tipo_grupos") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    estilo_ids: estiloRaw === "__null__" ? [] : parseIdsCsv(estiloRaw),
    estilo_null: estiloRaw === "__null__",
    problemas_estilo: sp.get("problemas_estilo") === "1",
    con_imagen:
      sp.get("con_imagen") === "1" || sp.get("con_imagen") === "0"
        ? (sp.get("con_imagen") as "1" | "0")
        : "",
    linea_ids: parseIdsCsv(sp.get("linea_ids")),
    referencia_ids: parseIdsCsv(sp.get("referencia_ids")),
    material_familias: (sp.get("material_familias") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    color_familias: (sp.get("color_familias") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

export function lrStateToSearchParams(state: LrCabeceraState): URLSearchParams {
  const p = new URLSearchParams();
  p.set("tipo_v2_id", String(state.tipo_v2_id));
  if (state.origen_tipo !== "TODOS") p.set("origen_tipo", state.origen_tipo);
  if (state.deposito_codigo) p.set("deposito_codigo", state.deposito_codigo);
  if (state.buscar.trim()) p.set("q", state.buscar.trim());
  if (state.genero_ids.length) p.set("genero_ids", state.genero_ids.join(","));
  if (state.marca_ids.length) p.set("marca_ids", state.marca_ids.join(","));
  if (state.tipo_1_ids.length) p.set("tipo_1_ids", state.tipo_1_ids.join(","));
  if (state.tipo_grupos.length) p.set("tipo_grupos", state.tipo_grupos.join(","));
  if (state.problemas_estilo) p.set("problemas_estilo", "1");
  else if (state.estilo_null) p.set("estilo_ids", "__null__");
  else if (state.estilo_ids.length) p.set("estilo_ids", state.estilo_ids.join(","));
  if (state.problemas_estilo && state.con_imagen) p.set("con_imagen", state.con_imagen);
  if (state.linea_ids.length) p.set("linea_ids", state.linea_ids.join(","));
  if (state.referencia_ids.length) p.set("referencia_ids", state.referencia_ids.join(","));
  if (state.material_familias.length) p.set("material_familias", state.material_familias.join(","));
  if (state.color_familias.length) p.set("color_familias", state.color_familias.join(","));
  return p;
}

export function emptyLrCabecera(tipo_v2_id: 1 | 2 = 1): LrCabeceraState {
  return {
    tipo_v2_id,
    origen_tipo: "TODOS",
    deposito_codigo: "",
    buscar: "",
    genero_ids: [],
    marca_ids: [],
    tipo_1_ids: [],
    tipo_grupos: [],
    estilo_ids: [],
    estilo_null: false,
    problemas_estilo: false,
    con_imagen: "",
    linea_ids: [],
    referencia_ids: [],
    material_familias: [],
    color_familias: [],
  };
}
