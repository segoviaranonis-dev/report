import type { Pool } from "pg";
import { listImportadoProductos } from "@/lib/deposito-rimec/queries-productos-grilla";
import { listProgramadoProductos } from "@/lib/stock-programado/queries-productos";
import { listTransitoProductos } from "@/lib/stock-transito/queries-productos";
import {
  mergeReposicionArticulos,
  type ReposicionArticulo,
} from "@/lib/herramienta-reposicion/merge-reposicion";

export type HerramientaReposicionPayload = {
  articulos: ReposicionArticulo[];
  kpis: {
    moleculas: number;
    peDisponible: number;
    cpDisponible: number;
    cpVendido: number;
    programado: number;
  };
};

export async function getHerramientaReposicion(pool: Pool): Promise<HerramientaReposicionPayload> {
  const [pe, cp, prog] = await Promise.all([
    listImportadoProductos(pool),
    listTransitoProductos(pool),
    listProgramadoProductos(pool),
  ]);

  const articulos = mergeReposicionArticulos({
    pe: pe.productos,
    compraPrevia: cp.productos,
    programado: prog.productos,
  });

  const kpis = {
    moleculas: articulos.length,
    peDisponible: articulos.reduce((s, a) => s + a.totales.peDisponible, 0),
    cpDisponible: articulos.reduce((s, a) => s + a.totales.cpDisponible, 0),
    cpVendido: articulos.reduce((s, a) => s + a.totales.cpVendido, 0),
    programado: articulos.reduce((s, a) => s + a.totales.programado, 0),
  };

  return { articulos, kpis };
}
