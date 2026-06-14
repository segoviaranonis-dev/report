import type { DepositoStockRow, PivotRow } from "@/lib/bazzar-web/deposito-web/types";

function sortTalla(a: string, b: string): number {
  const na = parseFloat(a.split("/")[0]);
  const nb = parseFloat(b.split("/")[0]);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return a.localeCompare(b, "es");
}

/** Gemelo pivot_table Streamlit (index 5 pilares, columns talla) */
export function buildPivotByTalla(rows: DepositoStockRow[]): {
  tallaColumns: string[];
  pivot: PivotRow[];
} {
  const tallaSet = new Set<string>();
  const map = new Map<string, PivotRow>();

  for (const row of rows) {
    tallaSet.add(row.talla);
    const key = [row.linea, row.referencia, row.material, row.color].join("\0");
    let entry = map.get(key);
    if (!entry) {
      entry = {
        linea: row.linea,
        referencia: row.referencia,
        material: row.material,
        color: row.color,
        tallas: {},
      };
      map.set(key, entry);
    }
    entry.tallas[row.talla] = (entry.tallas[row.talla] ?? 0) + row.stock;
  }

  const tallaColumns = [...tallaSet].sort(sortTalla);
  const pivot = [...map.values()].sort((a, b) =>
    `${a.linea}${a.referencia}`.localeCompare(`${b.linea}${b.referencia}`, "es"),
  );

  return { tallaColumns, pivot };
}
