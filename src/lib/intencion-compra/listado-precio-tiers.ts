/** Catálogo canónico listado_precio — migración 027. */
export type ListadoPrecioTierId = 1 | 2 | 3 | 4;

export const LISTADO_PRECIO_TIERS: ReadonlyArray<{
  id: ListadoPrecioTierId;
  codigo: string;
  label: string;
  hint: string;
}> = [
  { id: 1, codigo: "LPN", label: "LPN", hint: "Precio neto · referencia base" },
  { id: 2, codigo: "LPC02", label: "LPC02", hint: "Listado interno / corte especial" },
  { id: 3, codigo: "LPC03", label: "LPC03", hint: "Default · LPN + 12%" },
  { id: 4, codigo: "LPC04", label: "LPC04", hint: "Especial · LPN + 20%" },
] as const;

export const ID_CATEGORIA_PROGRAMADO = 3;

/** Proforma 8604 · importación programado Alejandro Magno — LPC04 impuesto Director · 2026-07-07. */
export const LISTADO_IMPUETO_8604: ListadoPrecioTierId = 4;

export const IC_NUMEROS_8604 = [
  "IC-2026-0060",
  "IC-2026-0061",
  "IC-2026-0062",
  "IC-2026-0063",
  "IC-2026-0064",
  "IC-2026-0065",
  "IC-2026-0066",
  "IC-2026-0067",
  "IC-2026-0068",
  "IC-2026-0069",
] as const;

export function labelListadoPrecio(id: number | null | undefined): string {
  const t = LISTADO_PRECIO_TIERS.find((x) => x.id === id);
  return t ? t.label : "—";
}

export function esListadoPrecioValido(id: number | null | undefined): id is ListadoPrecioTierId {
  return id === 1 || id === 2 || id === 3 || id === 4;
}
