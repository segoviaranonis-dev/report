import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import type { CasoBibliotecaRow } from "@/lib/motor-precios/biblioteca-editor";

/** Normaliza código línea proveedor para match BCL ↔ depósito. */
export function normLineaCodigo(raw: string | number | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const n = Number(s);
  if (Number.isFinite(n)) return String(Math.trunc(n));
  return s;
}

export function lineasToSet(lineas: string[]): Set<string> {
  const set = new Set<string>();
  for (const ln of lineas) {
    const c = normLineaCodigo(ln);
    if (c) set.add(c);
  }
  return set;
}

export function applyFiltroIndiceCaso(rows: DepositoRow[], lineas: string[]): DepositoRow[] {
  if (!lineas.length) return rows;
  const set = lineasToSet(lineas);
  return rows.filter((r) => {
    const cod = normLineaCodigo(r.linea_codigo_proveedor);
    return cod != null && set.has(cod);
  });
}

export type CasoIndiceStats = {
  caso_id: number;
  productos: number;
  pares: number;
  lineas_en_stock: number;
};

export function statsPorCaso(productos: DepositoRow[], casos: CasoBibliotecaRow[]): CasoIndiceStats[] {
  const lineaPares = new Map<string, number>();
  const lineaProductos = new Map<string, Set<string>>();

  for (const p of productos) {
    const cod = normLineaCodigo(p.linea_codigo_proveedor);
    if (!cod) continue;
    lineaPares.set(cod, (lineaPares.get(cod) ?? 0) + p.cantidad);
    const mol = `${p.linea_codigo_proveedor}-${p.referencia_codigo_proveedor}-${p.material_code}-${p.color_code}`;
    const s = lineaProductos.get(cod) ?? new Set<string>();
    s.add(mol);
    lineaProductos.set(cod, s);
  }

  return casos.map((c) => {
    const set = lineasToSet(c.lineas);
    let pares = 0;
    let productos = 0;
    let lineasEnStock = 0;
    for (const ln of set) {
      const pp = lineaPares.get(ln);
      if (pp && pp > 0) {
        lineasEnStock += 1;
        pares += pp;
        productos += lineaProductos.get(ln)?.size ?? 0;
      }
    }
    return {
      caso_id: c.id,
      productos,
      pares,
      lineas_en_stock: lineasEnStock,
    };
  });
}

export function formatIndiceGs(indice: number): string {
  return `${indice.toLocaleString("es-PY")} Gs`;
}
