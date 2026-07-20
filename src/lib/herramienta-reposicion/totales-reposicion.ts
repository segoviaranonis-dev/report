import type { ReposicionArticulo, ReposicionBucket } from "@/lib/herramienta-reposicion/merge-reposicion";
import { PP_ABIERTO_LABEL } from "@/lib/herramienta-reposicion/queries-pp-abierto";

const PE_LABEL = /^pronta\s*entrega$/i;

/** Pares enteros · transferencia bancaria (sin drift float). */
export function enteroPares(n: unknown): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.trunc(x);
}

export type KpisReposicion = {
  moleculas: number;
  peDisponible: number;
  cpDisponible: number;
  cpVendido: number;
  programado: number;
  ppAbierto: number;
};

export type IntegridadIssue = {
  key: string;
  linea: string;
  referencia: string;
  campo: "peDisponible" | "cpDisponible" | "cpVendido" | "programado" | "ppAbierto";
  enTotales: number;
  enBuckets: number;
};

/** Totales canónicos = suma de pills/buckets por molécula (L+R+material+color). */
export function calcularTotalesDesdeBuckets(
  stock: ReposicionBucket[],
  ventasCp: ReposicionBucket[],
  ventasProgramado: ReposicionBucket[],
): ReposicionArticulo["totales"] {
  let peDisponible = 0;
  let cpDisponible = 0;
  let ppAbierto = 0;
  for (const b of stock) {
    const p = enteroPares(b.pares);
    if (PE_LABEL.test(b.label)) peDisponible += p;
    else if (b.label === PP_ABIERTO_LABEL) ppAbierto += p;
    else cpDisponible += p;
  }
  let cpVendido = 0;
  for (const b of ventasCp) cpVendido += enteroPares(b.pares);
  let programado = 0;
  for (const b of ventasProgramado) programado += enteroPares(b.pares);
  return { peDisponible, cpDisponible, cpVendido, programado, ppAbierto };
}

/** Fuerza `totales` desde buckets — evita drift entre merge y auditoría. */
export function recalcularTotalesArticulo(a: ReposicionArticulo): ReposicionArticulo {
  return {
    ...a,
    totales: calcularTotalesDesdeBuckets(a.stock, a.ventasCp, a.ventasProgramado),
  };
}

/** KPIs = suma exacta de `totales` por tarjeta (transferencia bancaria · enteros). */
export function kpisDesdeArticulos(articulos: ReposicionArticulo[]): KpisReposicion {
  let peDisponible = 0;
  let cpDisponible = 0;
  let cpVendido = 0;
  let programado = 0;
  let ppAbierto = 0;
  for (const a of articulos) {
    peDisponible += enteroPares(a.totales.peDisponible);
    cpDisponible += enteroPares(a.totales.cpDisponible);
    cpVendido += enteroPares(a.totales.cpVendido);
    programado += enteroPares(a.totales.programado);
    ppAbierto += enteroPares(a.totales.ppAbierto);
  }
  return {
    moleculas: articulos.length,
    peDisponible,
    cpDisponible,
    cpVendido,
    programado,
    ppAbierto,
  };
}

export function paresStockDesdeArticulo(a: ReposicionArticulo): number {
  return a.totales.peDisponible + a.totales.cpDisponible + a.totales.ppAbierto;
}

export function paresTotalesAmDesdeArticulo(a: ReposicionArticulo): number {
  return (
    a.totales.peDisponible +
    a.totales.cpDisponible +
    a.totales.cpVendido +
    a.totales.programado +
    a.totales.ppAbierto
  );
}

/** Cada `totales.*` debe coincidir con la suma de pills visibles en la tarjeta. */
export function auditarIntegridadArticulo(a: ReposicionArticulo): IntegridadIssue[] {
  const issues: IntegridadIssue[] = [];
  const canon = calcularTotalesDesdeBuckets(a.stock, a.ventasCp, a.ventasProgramado);
  const checks: Array<{
    campo: IntegridadIssue["campo"];
    enTotales: number;
    enBuckets: number;
  }> = [
    { campo: "peDisponible", enTotales: a.totales.peDisponible, enBuckets: canon.peDisponible },
    { campo: "cpDisponible", enTotales: a.totales.cpDisponible, enBuckets: canon.cpDisponible },
    { campo: "cpVendido", enTotales: a.totales.cpVendido, enBuckets: canon.cpVendido },
    { campo: "programado", enTotales: a.totales.programado, enBuckets: canon.programado },
    { campo: "ppAbierto", enTotales: a.totales.ppAbierto, enBuckets: canon.ppAbierto },
  ];
  for (const c of checks) {
    if (c.enTotales !== c.enBuckets) {
      issues.push({
        key: a.key,
        linea: a.linea,
        referencia: a.referencia,
        campo: c.campo,
        enTotales: c.enTotales,
        enBuckets: c.enBuckets,
      });
    }
  }
  return issues;
}

export function auditarIntegridadReposicion(articulos: ReposicionArticulo[]): IntegridadIssue[] {
  return articulos.flatMap(auditarIntegridadArticulo);
}

/** Cabecera KPIs vs suma molecular de tarjetas visibles. */
export function auditarIntegridadVista(
  kpis: KpisReposicion,
  articulos: ReposicionArticulo[],
): boolean {
  const sum = kpisDesdeArticulos(articulos);
  return (
    kpis.moleculas === sum.moleculas &&
    kpis.peDisponible === sum.peDisponible &&
    kpis.cpDisponible === sum.cpDisponible &&
    kpis.cpVendido === sum.cpVendido &&
    kpis.programado === sum.programado &&
    kpis.ppAbierto === sum.ppAbierto
  );
}

/** Vista filtrada ⊆ holding · cada eje ≤ total (tolerancia 0). */
export function auditarParidadVistaHolding(
  vista: KpisReposicion,
  holding: KpisReposicion,
): boolean {
  return (
    vista.moleculas <= holding.moleculas &&
    vista.peDisponible <= holding.peDisponible &&
    vista.cpDisponible <= holding.cpDisponible &&
    vista.cpVendido <= holding.cpVendido &&
    vista.programado <= holding.programado &&
    vista.ppAbierto <= holding.ppAbierto
  );
}

/** API kpis === recomputo desde tarjetas (holding completo). */
export function auditarIntegridadApi(
  apiKpis: KpisReposicion,
  articulos: ReposicionArticulo[],
): boolean {
  const holding = kpisDesdeArticulos(articulos);
  return JSON.stringify(apiKpis) === JSON.stringify(holding);
}

/** Valor inventario = LPN × pares en stock (PE + CP disp) — solo tarjetas con LPN. */
export function valorInventarioDesdeArticulos(articulos: ReposicionArticulo[]): number {
  let total = 0;
  for (const a of articulos) {
    if (a.lpn == null || a.lpn <= 0) continue;
    total += a.lpn * paresStockDesdeArticulo(a);
  }
  return total;
}
