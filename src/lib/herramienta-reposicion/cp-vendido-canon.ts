import type { Pool } from "pg";
import type { ReposicionArticulo } from "@/lib/herramienta-reposicion/merge-reposicion";
import { moleculeKeyVentas } from "@/lib/clientes/etiqueta-comprador";
import { SQL_MOL_CP_BASE } from "@/lib/panel-control/compra-previa-canonical";
import { calcularTotalesDesdeBuckets } from "@/lib/herramienta-reposicion/totales-reposicion";

/** Vendido CP canónico Panel · mol_activa · molécula 5 pilares (sin grada). */
export async function fetchCpVendidoCanonPorMol(pool: Pool): Promise<Map<string, number>> {
  const { rows } = await pool.query<{
    linea: string;
    referencia: string;
    material_code: string;
    color_code: string;
    vendido: string;
  }>(
    `
    ${SQL_MOL_CP_BASE}
    SELECT
      TRIM(linea) AS linea,
      TRIM(referencia) AS referencia,
      TRIM(material_code) AS material_code,
      TRIM(color_code) AS color_code,
      COALESCE(SUM(vendido), 0)::text AS vendido
    FROM mol_activa
    GROUP BY 1, 2, 3, 4
    `,
  );
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = moleculeKeyVentas(r.linea, r.referencia, r.material_code, r.color_code);
    map.set(key, (map.get(key) ?? 0) + (Number(r.vendido) || 0));
  }
  return map;
}

/**
 * Ajusta ventasCp / totales.cpVendido para paridad Panel CP = AM KPI.
 * Solo incrementa cuando canon > actual (no pisa ventas mayores en v_stock).
 */
export function aplicarCpVendidoCanon(
  articulos: ReposicionArticulo[],
  canon: Map<string, number>,
): ReposicionArticulo[] {
  const byKey = new Map(articulos.map((a) => [a.key, a]));
  const out = articulos.map((a) => {
    const target = canon.get(a.key);
    if (target == null || target === a.totales.cpVendido) return a;
    const ventasCp =
      target <= 0
        ? []
        : [{ label: a.ventasCp[0]?.label ?? "Sin llegada", pares: target }];
    const next = { ...a, ventasCp };
    return { ...next, totales: calcularTotalesDesdeBuckets(next.stock, next.ventasCp, next.ventasProgramado) };
  });

  for (const [key, vendido] of canon) {
    if (byKey.has(key) || vendido <= 0) continue;
    const parts = key.split("-");
    if (parts.length < 4) continue;
    const [linea, referencia, material, color] = parts;
    out.push({
      key,
      marca: "—",
      linea,
      referencia,
      material,
      color,
      descp_material: null,
      descp_color: null,
      imagen_nombre: null,
      imagen_color_excel: null,
      lpn: null,
      genero: "(sin género)",
      estilo: "(sin estilo)",
      tipo_v2: "Calzado",
      tipo_1: null,
      tono_etiqueta: null,
      linea_id: null,
      referencia_id: null,
      material_id: 0,
      color_id: 0,
      marca_id: null,
      genero_id: null,
      grupo_estilo_id: null,
      tipo_1_id: null,
      tipo_v2_id: 1,
      caso_precio: null,
      caso_id: null,
      cadena_comercial: null,
      es_liquidacion: null,
      stock: [],
      ventasCp: [{ label: "Sin llegada", pares: vendido }],
      ventasProgramado: [],
      totales: {
        peDisponible: 0,
        cpDisponible: 0,
        cpVendido: vendido,
        programado: 0,
        ppAbierto: 0,
      },
    });
  }
  return out;
}