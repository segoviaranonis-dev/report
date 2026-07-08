import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import type { VentaCompradorLinea } from "@/lib/clientes/etiqueta-comprador";
import { moleculeKeyVentas } from "@/lib/clientes/etiqueta-comprador";
import { lookupCasoLinea } from "@/lib/depositos/caso-biblioteca";
import { resolvePrecioGrupoLRM } from "@/lib/depositos/precio-venta";

export type GradaImportadoraLine = {
  curva: string;
  /** Saldo actual (pares disponibles). */
  pares: number;
  /** Pares vendidos en la curva. */
  vendidos: number;
};

export type PeImportadoraCard = {
  key: string;
  producto: DepositoRow;
  gradas: GradaImportadoraLine[];
  /** Saldo agregado (suma cantidad). */
  totalPares: number;
  totalInicial: number;
  totalVendidos: number;
  estilo: string;
  precioVenta: number | null;
  casoComercial: string | null;
  /** Tránsito — quincena_arribo.descripcion (dato duro llegada) */
  llegadaDesc: string | null;
  /** Ventas confirmadas · cadena o cliente (2 nombres) · solo vista expandida. */
  compradores: VentaCompradorLinea[];
};

function moleculeKey(p: DepositoRow): string {
  return `${p.linea_codigo_proveedor}-${p.referencia_codigo_proveedor}-${p.material_code}-${p.color_code}`;
}

function canonCurva(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim();
  return s && s !== "—" ? s : "(sin grada)";
}

/** Etiqueta llegada desde filas agrupadas (quincena_arribo.descripcion). */
export function llegadaDescFromRows(rows: DepositoRow[]): string | null {
  const labels = [
    ...new Set(
      rows
        .map((r) => String(r.quincena_desc ?? "").trim())
        .filter((s) => s && s !== "—" && !/^sin quincena/i.test(s)),
    ),
  ].sort((a, b) => a.localeCompare(b, "es"));
  if (labels.length === 0) return null;
  if (labels.length === 1) return labels[0];
  return `${labels[0]} · +${labels.length - 1}`;
}

type AgruparPeOpts = {
  /** Tránsito / programado — prioriza vendido en orden de tarjetas. */
  ordenVentas?: boolean;
  /** Map molécula → compradores (cadena/cliente). */
  ventasPorMol?: Map<string, VentaCompradorLinea[]> | null;
};

/** Agrupa molécula L+R+material+color · una imagen · gradas = curvas con saldo/vendido. */
export function agruparPeImportadora(
  rows: DepositoRow[],
  casoPorLinea?: Map<string, string> | null,
  opts?: AgruparPeOpts,
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
      const gradaMap = new Map<string, { pares: number; vendidos: number }>();
      let totalInicial = 0;
      let totalVendidos = 0;

      for (const item of items) {
        const curva = canonCurva(item.grada);
        const prev = gradaMap.get(curva) ?? { pares: 0, vendidos: 0 };
        const vend = item.pares_vendidos ?? 0;
        const ini = item.cantidad_inicial ?? item.cantidad + vend;
        gradaMap.set(curva, {
          pares: prev.pares + item.cantidad,
          vendidos: prev.vendidos + vend,
        });
        totalInicial += ini;
        totalVendidos += vend;
      }

      const gradas = Array.from(gradaMap.entries())
        .map(([curva, g]) => ({ curva, pares: g.pares, vendidos: g.vendidos }))
        .filter((g) => g.pares > 0 || g.vendidos > 0)
        .sort(
          (a, b) =>
            b.vendidos + b.pares - (a.vendidos + a.pares) ||
            a.curva.localeCompare(b.curva, "es"),
        );

      const totalPares = gradas.reduce((s, g) => s + g.pares, 0);
      const p = items[0];
      const molKey = moleculeKeyVentas(
        p.linea_codigo_proveedor,
        p.referencia_codigo_proveedor,
        p.material_code,
        p.color_code,
      );

      return {
        key,
        producto: p,
        gradas,
        totalPares,
        totalInicial,
        totalVendidos,
        estilo: p.estilo,
        precioVenta: resolvePrecioGrupoLRM(items),
        casoComercial: lookupCasoLinea(casoPorLinea, p.linea_codigo_proveedor),
        llegadaDesc: llegadaDescFromRows(items),
        compradores: opts?.ventasPorMol?.get(molKey) ?? [],
      };
    })
    .sort((a, b) => {
      if (opts?.ordenVentas) {
        const dv = b.totalVendidos - a.totalVendidos;
        if (dv !== 0) return dv;
      }
      const dp = b.totalPares - a.totalPares;
      if (dp !== 0) return dp;
      return a.key.localeCompare(b.key, "es");
    });
}
