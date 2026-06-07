import type {
  RetailArbolKpis,
  RetailArbolLeaf,
  RetailArbolNodo,
} from "@/lib/retail/arbol-snapshot-types";

const ENTE_ORDER = ["RIMEC", "Fernando", "San Martín", "San Martin", "Palma"];

function sortEnte(a: string, b: string): number {
  const ia = ENTE_ORDER.indexOf(a);
  const ib = ENTE_ORDER.indexOf(b);
  if (ia >= 0 && ib >= 0) return ia - ib;
  if (ia >= 0) return -1;
  if (ib >= 0) return 1;
  return a.localeCompare(b, "es");
}

function sortLabel(a: string, b: string): number {
  return a.localeCompare(b, "es");
}

function sumLeaves(rows: RetailArbolLeaf[]): { stock: number; venta: number } {
  let stock = 0;
  let venta = 0;
  for (const r of rows) {
    stock += r.stock;
    venta += r.venta;
  }
  return { stock, venta };
}

function nodoFromLeaves(
  id: string,
  nivel: RetailArbolNodo["nivel"],
  nombre: string,
  rows: RetailArbolLeaf[],
  hijos?: RetailArbolNodo[],
): RetailArbolNodo {
  const { stock, venta } = hijos
    ? {
        stock: hijos.reduce((s, h) => s + h.stock, 0),
        venta: hijos.reduce((s, h) => s + h.venta, 0),
      }
    : sumLeaves(rows);
  return {
    id,
    nivel,
    nombre,
    count: hijos?.length ?? rows.length,
    stock,
    venta,
    total: stock + venta,
    hijos,
  };
}

function groupBy<T>(items: T[], keyFn: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const item of items) {
    const k = keyFn(item);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(item);
  }
  return m;
}

export function calcularKpisArbol(leaves: RetailArbolLeaf[], filasExcel: number): RetailArbolKpis {
  const { stock, venta } = sumLeaves(leaves);
  return {
    stock,
    venta,
    total: stock + venta,
    skus: leaves.length,
    filasExcel,
  };
}

/** Ente → Género → Marca → SKU (línea·ref·material·color). Columnas Stock | Venta en cada nodo. */
export function construirArbolRetail(leaves: RetailArbolLeaf[]): RetailArbolNodo[] {
  const byEnte = groupBy(leaves, (l) => l.ente);
  const entes = [...byEnte.keys()].sort(sortEnte);

  return entes.map((ente) => {
    const rowsEnte = byEnte.get(ente)!;
    const byGen = groupBy(rowsEnte, (l) => l.genero);
    const generos = [...byGen.keys()].sort(sortLabel);

    const hijosGen: RetailArbolNodo[] = generos.map((genero) => {
      const rowsGen = byGen.get(genero)!;
      const byMarca = groupBy(rowsGen, (l) => l.marca);
      const marcas = [...byMarca.keys()].sort(sortLabel);

      const hijosMarca: RetailArbolNodo[] = marcas.map((marca) => {
        const rowsMarca = byMarca.get(marca)!;
        const bySku = groupBy(rowsMarca, (l) => l.skuKey);
        const skus = [...bySku.keys()].sort((a, b) => {
          const la = bySku.get(a)![0]!.skuLabel;
          const lb = bySku.get(b)![0]!.skuLabel;
          return la.localeCompare(lb, "es");
        });

        const hojas: RetailArbolNodo[] = skus.map((skuKey) => {
          const rowsSku = bySku.get(skuKey)!;
          const label = rowsSku[0]!.skuLabel;
          return nodoFromLeaves(`sku:${skuKey}`, 4, label, rowsSku);
        });

        return nodoFromLeaves(`marca:${ente}|${genero}|${marca}`, 3, marca, rowsMarca, hojas);
      });

      return nodoFromLeaves(`gen:${ente}|${genero}`, 2, genero, rowsGen, hijosMarca);
    });

    return nodoFromLeaves(`ente:${ente}`, 1, ente, rowsEnte, hijosGen);
  });
}
