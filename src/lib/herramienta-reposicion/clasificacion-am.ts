import type { ReposicionArticulo, ReposicionBucket } from "@/lib/herramienta-reposicion/merge-reposicion";
import { PP_ABIERTO_LABEL } from "@/lib/herramienta-reposicion/queries-pp-abierto";
import { calcularTotalesDesdeBuckets } from "@/lib/herramienta-reposicion/totales-reposicion";

const PE_RE = /^pronta\s*entrega$/i;

/** Entidades Magno · categorías IC 1·2·3 (siamese filtros AM). */
export type EntidadAmFiltro = "pe" | "cp" | "prg";

export const ENTIDAD_AM_OPCIONES: Array<{
  id: EntidadAmFiltro;
  label: string;
  cat: 1 | 2 | 3;
  title: string;
}> = [
  { id: "pe", label: "PE", cat: 1, title: "Pronta entrega · categoría 1 STOCK" },
  { id: "cp", label: "CP", cat: 2, title: "Compra previa · categoría 2" },
  { id: "prg", label: "PRG", cat: 3, title: "Programado · categoría 3" },
];

function esStockEstructural(b: ReposicionBucket): boolean {
  return PE_RE.test(b.label) || b.label === PP_ABIERTO_LABEL;
}

/**
 * Infalible Magno: ningún pill de PROGRAMADO puede vivir en STOCK's.
 * Rescata por label o preventa compartida y recalcula totales.
 */
export function sanearClasificacionAm(a: ReposicionArticulo): ReposicionArticulo {
  const progSaldo = [...(a.programadoSaldo ?? [])];
  const progVend = a.ventasProgramado ?? [];
  const progLabels = new Set([...progSaldo, ...progVend].map((b) => b.label));
  const progPreventas = new Set(
    [...progSaldo, ...progVend]
      .map((b) => String(b.preventa ?? "").trim())
      .filter(Boolean),
  );

  const stockOk: ReposicionBucket[] = [];
  const rescatados = new Map<string, ReposicionBucket>();

  for (const b of a.stock ?? []) {
    if (esStockEstructural(b)) {
      stockOk.push(b);
      continue;
    }
    const prev = String(b.preventa ?? "").trim();
    const esProg =
      progLabels.has(b.label) || (prev.length > 0 && progPreventas.has(prev));
    if (esProg) {
      const cur = rescatados.get(b.label);
      rescatados.set(b.label, {
        ...b,
        pares: (cur?.pares ?? 0) + b.pares,
        preventa: b.preventa ?? cur?.preventa ?? null,
        quincena: b.quincena ?? cur?.quincena ?? null,
      });
    } else {
      stockOk.push(b);
    }
  }

  if (rescatados.size === 0) {
    return a.programadoSaldo ? a : { ...a, programadoSaldo: progSaldo };
  }

  const saldoMap = new Map(progSaldo.map((b) => [b.label, { ...b }]));
  for (const [label, b] of rescatados) {
    const cur = saldoMap.get(label);
    if (cur) {
      saldoMap.set(label, { ...cur, pares: cur.pares + b.pares });
    } else {
      saldoMap.set(label, b);
    }
  }
  const programadoSaldo = [...saldoMap.values()].filter((b) => b.pares > 0);
  const totales = calcularTotalesDesdeBuckets(
    stockOk,
    a.ventasCp,
    progVend,
    programadoSaldo,
  );
  return { ...a, stock: stockOk, programadoSaldo, totales };
}

export function sanearArticulosAm(articulos: ReposicionArticulo[]): ReposicionArticulo[] {
  return articulos.map(sanearClasificacionAm);
}

export function articuloTieneEntidadAm(a: ReposicionArticulo, id: EntidadAmFiltro): boolean {
  if (id === "pe") return a.totales.peDisponible > 0;
  if (id === "cp") return a.totales.cpDisponible > 0 || a.totales.cpVendido > 0;
  return a.totales.programado > 0;
}

/** Vacío = todas las entidades (ley TODOS). */
export function filtrarPorEntidadesAm(
  articulos: ReposicionArticulo[],
  selected: EntidadAmFiltro[],
): ReposicionArticulo[] {
  if (selected.length === 0) return articulos;
  return articulos.filter((a) => selected.some((id) => articuloTieneEntidadAm(a, id)));
}

export function toggleEntidadAm(
  selected: EntidadAmFiltro[],
  id: EntidadAmFiltro,
): EntidadAmFiltro[] {
  return selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
}
