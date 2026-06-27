import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";

export type ProductoOperativaCard = {
  key: string;
  producto: DepositoRow;
  tallas: string[];
  stock: number[];
  totalPares: number;
  estilo: string;
};

function moleculeKey(p: DepositoRow): string {
  return `${p.linea_codigo_proveedor}-${p.referencia_codigo_proveedor}-${p.material_code}-${p.color_code}`;
}

function parseTalla(grada: string): string {
  return grada.trim();
}

export function agruparProductosOperativa(rows: DepositoRow[]): ProductoOperativaCard[] {
  const map = new Map<string, DepositoRow[]>();

  for (const row of rows) {
    const key = moleculeKey(row);
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }

  return Array.from(map.entries()).map(([key, items]) => {
    const stockMap = new Map<string, number>();
    for (const item of items) {
      const talla = parseTalla(item.grada);
      stockMap.set(talla, (stockMap.get(talla) ?? 0) + item.cantidad);
    }

    const tallas = Array.from(stockMap.keys()).sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return a.localeCompare(b, "es");
    });

    const stock = tallas.map((t) => stockMap.get(t) ?? 0);

    return {
      key,
      producto: items[0],
      tallas,
      stock,
      totalPares: stock.reduce((s, n) => s + n, 0),
      estilo: items[0].estilo,
    };
  }).sort((a, b) => {
    const dp = b.totalPares - a.totalPares;
    if (dp !== 0) return dp;
    return a.key.localeCompare(b.key, "es");
  });
}
