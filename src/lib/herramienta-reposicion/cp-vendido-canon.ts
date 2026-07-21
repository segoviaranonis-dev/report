import type { Pool } from "pg";
import type {
  ReposicionArticulo,
  ReposicionBucket,
} from "@/lib/herramienta-reposicion/merge-reposicion";
import { moleculeKeyVentas } from "@/lib/clientes/etiqueta-comprador";
import { SQL_MOL_CP_BASE } from "@/lib/panel-control/compra-previa-canonical";
import { calcularTotalesDesdeBuckets } from "@/lib/herramienta-reposicion/totales-reposicion";
import {
  etiquetaDatoDuroCp,
  partesDatoDuroCp,
} from "@/lib/pedido-proveedor/dato-duro-cabecera";

/**
 * Vendido CP canónico Panel · molécula 5 pilares + lote de origen.
 * Conserva preventa/quincena incluso cuando saldo=0 y la vista stock ya no trae la fila.
 */
export async function fetchCpVendidoCanonPorMol(
  pool: Pool,
): Promise<Map<string, ReposicionBucket[]>> {
  const { rows } = await pool.query<{
    linea: string;
    referencia: string;
    material_code: string;
    color_code: string;
    nro_pedido_externo: string | null;
    quincena_desc: string | null;
    vendido: string;
  }>(
    `
    ${SQL_MOL_CP_BASE}
    SELECT
      TRIM(m.linea) AS linea,
      TRIM(m.referencia) AS referencia,
      TRIM(m.material_code) AS material_code,
      TRIM(m.color_code) AS color_code,
      pp.nro_pedido_externo,
      qa.descripcion AS quincena_desc,
      COALESCE(SUM(m.vendido), 0)::text AS vendido
    FROM mol_activa m
    JOIN pedido_proveedor pp ON pp.id = m.pp_id
    LEFT JOIN quincena_arribo qa ON qa.id = pp.quincena_arribo_id
    GROUP BY 1, 2, 3, 4, 5, 6
    `,
  );
  const porMolEtiqueta = new Map<string, Map<string, ReposicionBucket>>();
  for (const r of rows) {
    const key = moleculeKeyVentas(r.linea, r.referencia, r.material_code, r.color_code);
    const pares = Number(r.vendido) || 0;
    if (pares <= 0) continue;
    const partes = partesDatoDuroCp(r.nro_pedido_externo, r.quincena_desc);
    const label = etiquetaDatoDuroCp(r.nro_pedido_externo, r.quincena_desc);
    const buckets = porMolEtiqueta.get(key) ?? new Map<string, ReposicionBucket>();
    const actual = buckets.get(label);
    buckets.set(label, {
      label,
      pares: (actual?.pares ?? 0) + pares,
      preventa: partes.preventa || null,
      quincena: partes.quincena || null,
    });
    porMolEtiqueta.set(key, buckets);
  }
  return new Map(
    [...porMolEtiqueta].map(([key, buckets]) => [key, [...buckets.values()]]),
  );
}

/**
 * Ajusta ventasCp / totales.cpVendido para paridad Panel CP = AM KPI.
 * Solo incrementa cuando canon > actual (no pisa ventas mayores en v_stock).
 */
export function aplicarCpVendidoCanon(
  articulos: ReposicionArticulo[],
  canon: Map<string, ReposicionBucket[]>,
): ReposicionArticulo[] {
  const byKey = new Map(articulos.map((a) => [a.key, a]));
  const out = articulos.map((a) => {
    const ventasCp = canon.get(a.key);
    if (!ventasCp) return a;
    const next = { ...a, ventasCp };
    return { ...next, totales: calcularTotalesDesdeBuckets(next.stock, next.ventasCp, next.ventasProgramado) };
  });

  for (const [key, ventasCp] of canon) {
    const vendido = ventasCp.reduce((sum, b) => sum + b.pares, 0);
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
      ventasCp,
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