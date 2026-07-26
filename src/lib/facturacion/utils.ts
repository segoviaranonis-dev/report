import type { FacturaListItem } from "./types";

export function agruparFacturasPorFecha(
  items: FacturaListItem[],
  opts?: { ordenFecha?: "asc" | "desc" },
): Array<{ fecha: string; facturas: FacturaListItem[] }> {
  const orden = opts?.ordenFecha ?? "asc";
  const map = new Map<string, FacturaListItem[]>();
  for (const f of items) {
    const key = f.fecha_entrega_real?.slice(0, 10) || f.fecha || "Sin fecha";
    const bucket = map.get(key) ?? [];
    bucket.push(f);
    map.set(key, bucket);
  }
  return [...map.entries()]
    .map(([fecha, facturas]) => ({ fecha, facturas }))
    .sort((a, b) => {
      if (a.fecha === "Sin fecha") return 1;
      if (b.fecha === "Sin fecha") return -1;
      const cmp = a.fecha.localeCompare(b.fecha);
      return orden === "desc" ? -cmp : cmp;
    });
}
