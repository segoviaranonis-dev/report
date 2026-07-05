import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import { lookupCasoLinea } from "@/lib/depositos/caso-biblioteca";
import { resolvePrecioGrupoLRM } from "@/lib/depositos/precio-venta";

export type GradaImportadoraLine = {
  curva: string;
  pares: number;
};

export type PeImportadoraCard = {
  key: string;
  producto: DepositoRow;
  gradas: GradaImportadoraLine[];
  totalPares: number;
  estilo: string;
  precioVenta: number | null;
  casoComercial: string | null;
};

function moleculeKey(p: DepositoRow): string {
  return `${p.linea_codigo_proveedor}-${p.referencia_codigo_proveedor}-${p.material_code}-${p.color_code}`;
}

function canonCurva(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim();
  return s && s !== "—" ? s : "(sin grada)";
}

/** Agrupa molécula L+R+material+color · gradas = curvas importadora con pares. */
export function agruparPeImportadora(
  rows: DepositoRow[],
  casoPorLinea?: Map<string, string> | null,
): PeImportadoraCard[] {
  const map = new Map<string, DepositoRow[]>();

  for (const row of rows) {
    const key = moleculeKey(row);
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }

  return Array.from(map.entries())
    .map(([key, items]) => {
      const gradaMap = new Map<string, number>();
      for (const item of items) {
        const curva = canonCurva(item.grada);
        gradaMap.set(curva, (gradaMap.get(curva) ?? 0) + item.cantidad);
      }

      const gradas = Array.from(gradaMap.entries())
        .map(([curva, pares]) => ({ curva, pares }))
        .sort((a, b) => b.pares - a.pares || a.curva.localeCompare(b.curva, "es"));

      const totalPares = gradas.reduce((s, g) => s + g.pares, 0);

      return {
        key,
        producto: items[0],
        gradas,
        totalPares,
        estilo: items[0].estilo,
        precioVenta: resolvePrecioGrupoLRM(items),
        casoComercial: lookupCasoLinea(casoPorLinea, items[0].linea_codigo_proveedor),
      };
    })
    .sort((a, b) => {
      const dp = b.totalPares - a.totalPares;
      if (dp !== 0) return dp;
      return a.key.localeCompare(b.key, "es");
    });
}
