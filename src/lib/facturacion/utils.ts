import type { FacturaListItem } from "./types";

export function agruparFacturasPorFecha(
  items: FacturaListItem[],
): Array<{ fecha: string; facturas: FacturaListItem[] }> {
  const map = new Map<string, FacturaListItem[]>();
  for (const f of items) {
    const key = f.fecha ?? "Sin fecha";
    const bucket = map.get(key) ?? [];
    bucket.push(f);
    map.set(key, bucket);
  }
  return [...map.entries()].map(([fecha, facturas]) => ({ fecha, facturas }));
}
