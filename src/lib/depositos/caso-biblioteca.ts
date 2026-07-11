/** Puente BCL → depósito: caso comercial por código línea (paridad biblioteca-editor). */

export type CasoBibliotecaLite = {
  id: number;
  nombre_caso: string;
  lineas: string[];
  lineas_count?: number;
  indice_gs?: number;
};

/** Normaliza código línea depósito ↔ BCL (entero STYLE). */
export function normLineaCodigo(raw: string | number | null | undefined): string {
  if (raw == null || raw === "") return "";
  const n = Number(String(raw).trim().replace(/,/g, "."));
  if (!Number.isFinite(n)) return String(raw).trim();
  return String(Math.trunc(n));
}

/** Mapa linea_codigo → nombre_caso (exclusividad BCL). */
export function buildLineaCasoMap(casos: readonly CasoBibliotecaLite[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of casos) {
    const nombre = c.nombre_caso?.trim();
    if (!nombre) continue;
    for (const linea of c.lineas ?? []) {
      const cod = normLineaCodigo(linea);
      if (cod) map.set(cod, nombre);
    }
  }
  return map;
}

export function lookupCasoLinea(
  map: Map<string, string> | null | undefined,
  lineaCodigo: string | number | null | undefined,
): string | null {
  if (!map?.size) return null;
  const cod = normLineaCodigo(lineaCodigo);
  if (!cod) return null;
  return map.get(cod) ?? null;
}

/** Comparación insensible a mayúsculas para chips biblioteca ↔ fila PPD. */
export function normalizeCasoNombre(raw: string | null | undefined): string {
  return (raw ?? "").trim().toUpperCase();
}

type RowCasoMatch = {
  linea_codigo_proveedor?: string | number | null;
  caso_precio?: string | null;
};

/** BCL por línea + fallback `caso_precio` en molécula (paridad precio_lista). */
export function rowMatchesCasoActivo(
  row: RowCasoMatch,
  casoActivo: string,
  lineaCasoMap: Map<string, string> | null | undefined,
): boolean {
  const want = normalizeCasoNombre(casoActivo);
  if (!want) return false;
  const fromMap = lookupCasoLinea(lineaCasoMap, row.linea_codigo_proveedor);
  if (fromMap && normalizeCasoNombre(fromMap) === want) return true;
  const fromRow = normalizeCasoNombre(row.caso_precio);
  return fromRow === want;
}

export function filterRowsByCasoActivo<T extends RowCasoMatch>(
  rows: T[],
  casoActivo: string | null,
  lineaCasoMap: Map<string, string> | null | undefined,
): T[] {
  if (!casoActivo) return rows;
  return rows.filter((r) => rowMatchesCasoActivo(r, casoActivo, lineaCasoMap));
}

/** Líneas pertenecientes a un caso (para filtro). */
export function lineasEnCaso(caso: CasoBibliotecaLite): Set<string> {
  const set = new Set<string>();
  for (const l of caso.lineas ?? []) {
    const cod = normLineaCodigo(l);
    if (cod) set.add(cod);
  }
  return set;
}
