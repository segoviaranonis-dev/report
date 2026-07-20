import type { Pool } from "pg";
import { listImportadoProductos } from "@/lib/deposito-rimec/queries-productos-grilla";
import { listProgramadoProductos } from "@/lib/stock-programado/queries-productos";
import { listTransitoProductos } from "@/lib/stock-transito/queries-productos";
import { listPpAbiertoProductos } from "@/lib/herramienta-reposicion/queries-pp-abierto";
import {
  mergeReposicionArticulos,
  type ReposicionArticulo,
} from "@/lib/herramienta-reposicion/merge-reposicion";
import {
  auditarIntegridadReposicion,
  kpisDesdeArticulos,
  recalcularTotalesArticulo,
} from "@/lib/herramienta-reposicion/totales-reposicion";

export type HerramientaReposicionPayload = {
  articulos: ReposicionArticulo[];
  kpis: {
    moleculas: number;
    peDisponible: number;
    cpDisponible: number;
    cpVendido: number;
    programado: number;
    ppAbierto: number;
  };
  integridadOk: true;
};

export async function getHerramientaReposicion(pool: Pool): Promise<HerramientaReposicionPayload> {
  const [pe, cp, prog, ppAbierto] = await Promise.all([
    listImportadoProductos(pool),
    listTransitoProductos(pool),
    listProgramadoProductos(pool),
    listPpAbiertoProductos(pool),
  ]);

  const articulosRaw = mergeReposicionArticulos({
    pe: pe.productos,
    compraPrevia: cp.productos,
    programado: prog.productos,
    ppAbierto: ppAbierto.productos,
  });

  const articulos = articulosRaw.map(recalcularTotalesArticulo);

  const issues = auditarIntegridadReposicion(articulos);
  if (issues.length > 0) {
    console.error("[herramienta-reposicion] integridad molecular FAIL", issues.slice(0, 5));
    throw new Error(`Integridad molecular: ${issues.length} tarjeta(s) con totales ≠ pills`);
  }

  const kpis = kpisDesdeArticulos(articulos);

  return { articulos, kpis, integridadOk: true as const };
}
