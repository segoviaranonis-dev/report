import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import type { VentaCompradorLinea } from "@/lib/clientes/etiqueta-comprador";
import { moleculeKeyVentas } from "@/lib/clientes/etiqueta-comprador";
import { lookupCasoLinea } from "@/lib/depositos/caso-biblioteca";
import { resolvePrecioGrupoLRM } from "@/lib/depositos/precio-venta";
import {
  claveGradaEnTarjeta,
  isConfecciones638,
  parseGradaAbierta638,
} from "@/lib/deposito-rimec/grada-abierta-638";

export type GradaImportadoraLine = {
  curva: string;
  /** Saldo actual (pares o prendas según ramo). */
  pares: number;
  /** Vendidos en la línea. */
  vendidos: number;
  /** Kyly 638 — LPN / precio lista de la fila. */
  lpn?: number | null;
  /** Talle normalizado 638. */
  talle?: string | null;
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
  return moleculeKeyVentas(
    p.linea_codigo_proveedor,
    p.referencia_codigo_proveedor,
    p.material_code,
    p.color_code,
  );
}

function compradoresForCard(
  items: DepositoRow[],
  molKey: string,
  ventasPorMol?: Map<string, VentaCompradorLinea[]> | null,
): VentaCompradorLinea[] {
  if (!ventasPorMol?.size) return [];

  const ppIds = [...new Set(items.map((i) => i.pp_id).filter((id): id is number => id != null))];
  const bucket = new Map<string, number>();

  const addLines = (lines: VentaCompradorLinea[] | undefined) => {
    for (const c of lines ?? []) {
      bucket.set(c.etiqueta, (bucket.get(c.etiqueta) ?? 0) + c.pares);
    }
  };

  if (ppIds.length === 0) {
    addLines(ventasPorMol.get(molKey));
  } else {
    for (const ppId of ppIds) {
      addLines(ventasPorMol.get(`${molKey}|${ppId}`) ?? ventasPorMol.get(molKey));
    }
  }

  return [...bucket.entries()]
    .map(([etiqueta, pares]) => ({ etiqueta, pares }))
    .filter((l) => l.pares > 0)
    .sort((a, b) => b.pares - a.pares || a.etiqueta.localeCompare(b.etiqueta, "es"));
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
      const gradaMap = new Map<
        string,
        { pares: number; vendidos: number; lpn: number | null; talle: string | null }
      >();
      let totalInicial = 0;
      let totalVendidos = 0;

      for (const item of items) {
        const curva = canonCurva(item.grada);
        const gKey = claveGradaEnTarjeta(curva, item.precio_unitario, item.tipo_v2_id);
        const prev = gradaMap.get(gKey) ?? { pares: 0, vendidos: 0, lpn: null as number | null, talle: null as string | null };
        const vend = item.pares_vendidos ?? 0;
        const ini = item.cantidad_inicial ?? item.cantidad + vend;
        const parsed = isConfecciones638(item.tipo_v2_id)
          ? parseGradaAbierta638(item.grada, item.cantidad)
          : null;
        gradaMap.set(gKey, {
          pares: prev.pares + item.cantidad,
          vendidos: prev.vendidos + vend,
          lpn: item.precio_unitario ?? prev.lpn,
          talle: parsed?.talle ?? prev.talle,
        });
        totalInicial += ini;
        totalVendidos += vend;
      }

      const gradas = Array.from(gradaMap.entries())
        .map(([curva, g]) => ({
          curva: curva.includes("|LPN:") ? curva.split("|LPN:")[0] : curva,
          pares: g.pares,
          vendidos: g.vendidos,
          lpn: g.lpn,
          talle: g.talle,
        }))
        .filter((g) => g.pares > 0 || g.vendidos > 0)
        .sort(
          (a, b) =>
            b.vendidos + b.pares - (a.vendidos + a.pares) ||
            a.curva.localeCompare(b.curva, "es"),
        );

      const totalPares = gradas.reduce((s, g) => s + g.pares, 0);
      const p = items[0];
      const molKey = moleculeKey(p);

      return {
        key,
        producto: p,
        gradas,
        totalPares,
        totalInicial,
        totalVendidos,
        estilo: p.estilo,
        precioVenta: resolvePrecioGrupoLRM(items),
        casoComercial:
          lookupCasoLinea(casoPorLinea, p.linea_codigo_proveedor) ?? p.caso_precio?.trim() ?? null,
        llegadaDesc: llegadaDescFromRows(items),
        compradores: compradoresForCard(items, molKey, opts?.ventasPorMol),
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
