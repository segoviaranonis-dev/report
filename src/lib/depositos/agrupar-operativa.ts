import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import { lookupCasoLinea } from "@/lib/depositos/caso-biblioteca";
import { normalizeGradaLabel, sortGradaLabels } from "@/lib/depositos/grada-operativa";
import { resolvePrecioGrupoLRM } from "@/lib/depositos/precio-venta";

export type ProductoOperativaCard = {
  key: string;
  producto: DepositoRow;
  tallas: string[];
  stock: number[];
  totalPares: number;
  estilo: string;
  /** Precio venta por par (LPN CSV · mismo en L+R+material). */
  precioVenta: number | null;
  /** Caso comercial motor (BCL · por línea). */
  casoComercial: string | null;
};

function moleculeKey(p: DepositoRow): string {
  return `${p.linea_codigo_proveedor}-${p.referencia_codigo_proveedor}-${p.material_code}-${p.color_code}`;
}

function parseTalla(grada: string): string {
  return grada.trim();
}

export function agruparProductosOperativa(
  rows: DepositoRow[],
  casoPorLinea?: Map<string, string> | null,
): ProductoOperativaCard[] {
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

    const tallas = Array.from(stockMap.keys()).sort(sortGradaLabels);

    const stock = tallas.map((t) => stockMap.get(t) ?? 0);

    return {
      key,
      producto: items[0],
      tallas,
      stock,
      totalPares: stock.reduce((s, n) => s + n, 0),
      estilo: items[0].estilo,
      precioVenta: resolvePrecioGrupoLRM(items),
      casoComercial: lookupCasoLinea(casoPorLinea, items[0].linea_codigo_proveedor),
    };
  }).sort((a, b) => {
    const dp = b.totalPares - a.totalPares;
    if (dp !== 0) return dp;
    return a.key.localeCompare(b.key, "es");
  });
}
