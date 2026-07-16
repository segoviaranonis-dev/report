import type { ReposicionArticulo } from "@/lib/herramienta-reposicion/merge-reposicion";

/** Nivel 0 = sin señal AM · 1 = completo · 2 = incompleto · 3 = monocategoría */
export type NivelAm = 0 | 1 | 2 | 3;

const PE_LABEL = /^pronta\s*entrega$/i;

/** Mapa inmutable clave molécula → nivel (desde dataset completo API). */
export type NivelAmMap = ReadonlyMap<string, NivelAm>;

export function ejesPresentes(a: ReposicionArticulo): boolean[] {
  const cpStock = a.stock.some((b) => !PE_LABEL.test(b.label) && b.pares > 0);
  const peStock = a.stock.some((b) => PE_LABEL.test(b.label) && b.pares > 0);
  const ventaCp = a.ventasCp.some((b) => b.pares > 0);
  const programado = a.ventasProgramado.some((b) => b.pares > 0);
  return [cpStock, peStock, ventaCp, programado];
}

export function nivelAm(a: ReposicionArticulo): NivelAm {
  const n = ejesPresentes(a).filter(Boolean).length;
  if (n === 0) return 0;
  if (n === 4) return 1;
  if (n === 1) return 3;
  return 2;
}

/** Construye mapa desde artículos crudos — aplicar una sola vez al cargar API. */
export function buildNivelAmMap(articulos: ReposicionArticulo[]): NivelAmMap {
  const map = new Map<string, NivelAm>();
  for (const a of articulos) {
    map.set(a.key, nivelAm(a));
  }
  return map;
}

export function nivelAmLabel(n: NivelAm): string {
  switch (n) {
    case 1:
      return "N1";
    case 2:
      return "N2";
    case 3:
      return "N3";
    default:
      return "—";
  }
}

export function nivelAmTitulo(n: NivelAm): string {
  switch (n) {
    case 1:
      return "Nivel 1 · Completo AM (4 ejes)";
    case 2:
      return "Nivel 2 · Incompleto (2–3 ejes)";
    case 3:
      return "Nivel 3 · Monocategoría";
    default:
      return "Sin señal AM";
  }
}

/** Orden grilla: N1 → N2 → N3 → sin señal · desempate marca/L+R */
export function compareReposicionPorNivel(
  a: ReposicionArticulo,
  b: ReposicionArticulo,
  niveles: NivelAmMap,
): number {
  const na = niveles.get(a.key) ?? 0;
  const nb = niveles.get(b.key) ?? 0;
  const rank = (n: NivelAm) => (n === 0 ? 99 : n);
  const dr = rank(na) - rank(nb);
  if (dr !== 0) return dr;
  const dm = a.marca.localeCompare(b.marca, "es");
  if (dm !== 0) return dm;
  return `${a.linea}.${a.referencia}`.localeCompare(`${b.linea}.${b.referencia}`, "es");
}
