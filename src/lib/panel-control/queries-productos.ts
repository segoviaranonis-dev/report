import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import type { Pool } from "pg";
import { listImportadoProductos } from "@/lib/deposito-rimec/queries-productos-grilla";
import { listProgramadoProductos } from "@/lib/stock-programado/queries-productos";
import { listTransitoProductos } from "@/lib/stock-transito/queries-productos";
import type { EntidadActivoResumen } from "@/lib/panel-control/queries-resumen";

export type PanelSectorProductos = {
  entidad: EntidadActivoResumen["entidad"];
  productos: DepositoRow[];
  moleculas: number;
  pares_comprados: number;
  pares_vendidos: number;
  pares_saldo: number;
};

export async function getPanelSectorProductos(
  pool: Pool,
  entidad: EntidadActivoResumen["entidad"],
): Promise<PanelSectorProductos> {
  if (entidad === "COMPRA_PREVIA") {
    const { productos, pares, pares_vendidos } = await listTransitoProductos(pool);
    const comprados = productos.reduce((s, p) => s + (p.cantidad_inicial ?? p.cantidad + (p.pares_vendidos ?? 0)), 0);
    const vendidos = productos.reduce((s, p) => s + (p.pares_vendidos ?? 0), 0);
    return {
      entidad,
      productos,
      moleculas: new Set(productos.map(molKey)).size,
      pares_comprados: comprados,
      pares_vendidos: vendidos,
      pares_saldo: pares,
    };
  }

  if (entidad === "PROGRAMADO") {
    const { productos, pares, pares_vendidos } = await listProgramadoProductos(pool);
    const comprados = productos.reduce((s, p) => s + (p.cantidad_inicial ?? p.cantidad + (p.pares_vendidos ?? 0)), 0);
    const vendidos = productos.reduce((s, p) => s + (p.pares_vendidos ?? 0), 0);
    return {
      entidad,
      productos,
      moleculas: new Set(productos.map(molKey)).size,
      pares_comprados: comprados,
      pares_vendidos: vendidos,
      pares_saldo: pares,
    };
  }

  const { productos, pares } = await listImportadoProductos(pool);
  const comprados = productos.reduce((s, p) => s + (p.cantidad_inicial ?? p.cantidad + (p.pares_vendidos ?? 0)), 0);
  const vendidos = productos.reduce((s, p) => s + (p.pares_vendidos ?? 0), 0);
  return {
    entidad: "STOCK",
    productos,
    moleculas: new Set(productos.map(molKey)).size,
    pares_comprados: comprados,
    pares_vendidos: vendidos,
    pares_saldo: pares,
  };
}

function molKey(p: DepositoRow): string {
  return `${p.linea_codigo_proveedor}-${p.referencia_codigo_proveedor}-${p.material_code}-${p.color_code}`;
}
