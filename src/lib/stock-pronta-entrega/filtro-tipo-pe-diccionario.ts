import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import { casoFiltroIdsDesdeCodGrupo } from "@/lib/pilares/cod-grupo-caso-filtro";
import { cadenaPeCanonico } from "@/lib/stock-pronta-entrega/pe-grupo-uno-visual";

/** Filtro UI «Tipo» = casos comerciales PE (canon siamés Web/Report). */
export type PeTipoDiccionarioId =
  | "normal"
  | "actual"
  | "anterior"
  | "chi"
  | "promo"
  | "liquidacion"
  | "comun";

export const PE_TIPO_DICCIONARIO_OPCIONES: ReadonlyArray<{
  id: PeTipoDiccionarioId;
  label: string;
  cadena: string;
  ramos: ReadonlyArray<"CALZADO" | "CONFECCIONES" | "TODOS">;
}> = [
  { id: "normal", label: "NORMAL", cadena: "REGULAR", ramos: ["CALZADO", "TODOS"] },
  { id: "actual", label: "ACTUAL", cadena: "ACTUAL", ramos: ["CONFECCIONES", "TODOS"] },
  { id: "anterior", label: "ANTERIOR", cadena: "ANTERIOR", ramos: ["CONFECCIONES", "TODOS"] },
  { id: "chi", label: "CHINELO", cadena: "CHINELO", ramos: ["CALZADO", "TODOS"] },
  { id: "promo", label: "PROMOCIONAL", cadena: "PROMOCIONAL", ramos: ["CALZADO", "CONFECCIONES", "TODOS"] },
  { id: "liquidacion", label: "LIQUIDACION", cadena: "LIQUIDACION", ramos: ["CALZADO", "CONFECCIONES", "TODOS"] },
  { id: "comun", label: "COMUN", cadena: "COMUN", ramos: ["CALZADO", "TODOS"] },
] as const;

const PE_TIPO_ID_SET = new Set<string>(PE_TIPO_DICCIONARIO_OPCIONES.map((o) => o.id));

const CADENA_POR_ID = new Map(
  PE_TIPO_DICCIONARIO_OPCIONES.map((o) => [o.id, o.cadena] as const),
);

const LABEL_POR_ID = new Map(
  PE_TIPO_DICCIONARIO_OPCIONES.map((o) => [o.id, o.label] as const),
);

export function peTipoOpcionesVisibles(
  ramoTipo?: string | null,
): typeof PE_TIPO_DICCIONARIO_OPCIONES {
  const ramo = String(ramoTipo ?? "TODOS").trim().toUpperCase();
  if (ramo === "ACCESORIOS") {
    return [] as unknown as typeof PE_TIPO_DICCIONARIO_OPCIONES;
  }
  if (ramo === "CALZADO") {
    return PE_TIPO_DICCIONARIO_OPCIONES.filter((o) => o.ramos.includes("CALZADO"));
  }
  if (ramo === "CONFECCIONES") {
    return PE_TIPO_DICCIONARIO_OPCIONES.filter((o) => o.ramos.includes("CONFECCIONES"));
  }
  return PE_TIPO_DICCIONARIO_OPCIONES;
}

export function cadenaPeFromTipoId(id: PeTipoDiccionarioId): string {
  return CADENA_POR_ID.get(id) ?? "REGULAR";
}

export function peTipoIdFromCadena(cadena: string | null | undefined): PeTipoDiccionarioId {
  const u = String(cadena ?? "REGULAR").trim().toUpperCase();
  if (u === "PROMOCIONAL" || u === "PROMO" || u === "PRO") return "promo";
  if (u === "LIQUIDACION" || u === "LIQUIDACIÓN") return "liquidacion";
  if (u === "COMUN" || u === "COMÚN") return "comun";
  if (u === "CHI" || u === "CHINELO") return "chi";
  if (u === "ACTUAL") return "actual";
  if (u === "ANTERIOR") return "anterior";
  return "normal";
}

export function rowMatchesPeTipoDiccionario(
  row: DepositoRow,
  selected: readonly PeTipoDiccionarioId[],
): boolean {
  if (!selected.length) return true;
  const ids = [...casoFiltroIdsDesdeCodGrupo(row.cod_grupo)];
  const cadenaId = peTipoIdFromCadena(cadenaPeCanonico(row));
  if (!ids.includes(cadenaId)) ids.push(cadenaId);
  const marca = String(row.sdrm_marca ?? row.marca ?? "").trim().toUpperCase();
  const caso = String(row.caso_precio ?? "").trim().toUpperCase();
  if (marca === "CHINELO" || caso.includes("CHINELO") || caso === "CHI") {
    if (!ids.includes("chi")) ids.push("chi");
  }
  return selected.some((id) => ids.includes(id));
}

export function togglePeTipoDiccionario(
  list: PeTipoDiccionarioId[],
  id: PeTipoDiccionarioId,
): PeTipoDiccionarioId[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/** Convierte selección sidebar → clave diccionario (barra horizontal). */
export function claveDiccionarioFromTipoIds(
  ids: readonly PeTipoDiccionarioId[],
): string | null {
  if (ids.length !== 1) return null;
  return cadenaPeFromTipoId(ids[0]!);
}

/** Convierte clave diccionario → selección sidebar (un solo chip). */
export function tipoIdsFromClaveDiccionario(clave: string | null): PeTipoDiccionarioId[] {
  if (!clave) return [];
  return [peTipoIdFromCadena(clave)];
}

export function parsePeTipoSelected(ids: readonly string[]): PeTipoDiccionarioId[] {
  return ids.filter((g) => PE_TIPO_ID_SET.has(g)) as PeTipoDiccionarioId[];
}

export function labelPeTipoDiccionario(id: string): string {
  return LABEL_POR_ID.get(id as PeTipoDiccionarioId) ?? id.toUpperCase();
}
