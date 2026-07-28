import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import { cadenaPeCanonico } from "@/lib/stock-pronta-entrega/pe-grupo-uno-visual";
import { PE_DICCIONARIO_FALLBACK } from "@/lib/pe/pe-diccionario";

/** Entrada del diccionario PE — independiente de biblioteca_precio / motor precios. */
export type EntradaDiccionarioPe = {
  clave: string;
  etiqueta: string;
  pares: number;
  articulos: number;
};

/** Orden canónico — habitat Report · fuente filtros Web vía pe_catalogo_filtro_web. */
export const ORDEN_CADENA_PE = PE_DICCIONARIO_FALLBACK.map((e) => e.cadena_pe);

/** Etiqueta UI — REGULAR se muestra como NORMAL, todo mayúsculas. */
export function etiquetaCadenaPeUi(clave: string): string {
  const c = String(clave ?? "REGULAR").trim().toUpperCase();
  if (c === "REGULAR") return "NORMAL";
  return c;
}

/**
 * Cadena comercial DPE — trillizo siamés con filtro Tipo / badge UI.
 * Ley: solo triunvirato Excel (COD.GRUPO). BCL no incide — ver `cadena-dpe-triunvirato.ts`.
 */
export function cadenaPeDeRow(row: DepositoRow): string {
  return cadenaPeCanonico(row);
}

export function buildEntradasDiccionarioPe(rows: DepositoRow[]): EntradaDiccionarioPe[] {
  const acc = new Map<string, { pares: number; arts: Set<string> }>();

  for (const r of rows) {
    const clave = cadenaPeDeRow(r);
    const cur = acc.get(clave) ?? { pares: 0, arts: new Set<string>() };
    cur.pares += Number(r.cantidad ?? 0) || 0;
    cur.arts.add(
      `${r.linea_codigo_proveedor}-${r.referencia_codigo_proveedor}-${r.material_code}-${r.color_code}`,
    );
    acc.set(clave, cur);
  }

  const out: EntradaDiccionarioPe[] = [];
  for (const clave of ORDEN_CADENA_PE) {
    const v = acc.get(clave);
    const meta = PE_DICCIONARIO_FALLBACK.find((e) => e.cadena_pe === clave);
    out.push({
      clave,
      etiqueta: meta?.etiqueta_ui ?? etiquetaCadenaPeUi(clave),
      pares: v?.pares ?? 0,
      articulos: v?.arts.size ?? 0,
    });
  }
  return out;
}

export function filterRowsByDiccionarioPe(
  rows: DepositoRow[],
  claveActiva: string | null,
): DepositoRow[] {
  if (!claveActiva) return rows;
  const want = claveActiva.trim().toUpperCase();
  return rows.filter((r) => cadenaPeDeRow(r) === want);
}
