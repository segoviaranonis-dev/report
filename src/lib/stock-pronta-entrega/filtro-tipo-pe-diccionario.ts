import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import { PE_DICCIONARIO_FALLBACK } from "@/lib/pe/pe-diccionario";
import { cadenaPeCanonico } from "@/lib/stock-pronta-entrega/pe-grupo-uno-visual";

/** IDs sidebar Tipo PE — espejo del diccionario pronta entrega (sin biblioteca / sin carteras). */
export type PeTipoDiccionarioId = "normal" | "promo" | "liquidacion" | "comun";

export const PE_TIPO_DICCIONARIO_OPCIONES: ReadonlyArray<{
  id: PeTipoDiccionarioId;
  label: string;
  cadena: string;
}> = PE_DICCIONARIO_FALLBACK.map((row) => {
  const cadena = row.cadena_pe;
  let id: PeTipoDiccionarioId;
  if (cadena === "PROMOCIONAL") id = "promo";
  else if (cadena === "LIQUIDACION") id = "liquidacion";
  else if (cadena === "COMUN") id = "comun";
  else id = "normal";
  return { id, label: row.etiqueta_ui, cadena };
});

const CADENA_POR_ID = new Map(
  PE_TIPO_DICCIONARIO_OPCIONES.map((o) => [o.id, o.cadena] as const),
);

export function cadenaPeFromTipoId(id: PeTipoDiccionarioId): string {
  return CADENA_POR_ID.get(id) ?? "REGULAR";
}

export function peTipoIdFromCadena(cadena: string | null | undefined): PeTipoDiccionarioId {
  const u = String(cadena ?? "REGULAR").trim().toUpperCase();
  if (u === "PROMOCIONAL" || u === "PROMO") return "promo";
  if (u === "LIQUIDACION" || u === "LIQUIDACIÓN") return "liquidacion";
  if (u === "COMUN" || u === "COMÚN") return "comun";
  return "normal";
}

export function rowMatchesPeTipoDiccionario(
  row: DepositoRow,
  selected: readonly PeTipoDiccionarioId[],
): boolean {
  if (!selected.length) return true;
  const cadena = cadenaPeCanonico(row);
  const want = new Set(selected.map((id) => cadenaPeFromTipoId(id)));
  return want.has(cadena);
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

const PE_TIPO_ID_SET = new Set<string>(["normal", "promo", "liquidacion", "comun"]);

export function parsePeTipoSelected(ids: readonly string[]): PeTipoDiccionarioId[] {
  return ids.filter((g) => PE_TIPO_ID_SET.has(g)) as PeTipoDiccionarioId[];
}
