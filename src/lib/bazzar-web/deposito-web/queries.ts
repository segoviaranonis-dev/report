/**
 * Depósito Web — gemelo modules/deposito_web/logic.py
 */
import { getRimecPool } from "@/lib/rimec/pool";
import { ALM_WEB_BAZAR } from "@/lib/bazzar-web/compra-web/constants";
import type { DepositoResumenRow, DepositoStockRow } from "./types";

/** get_resumen_web — agrupado marca + 5 pilares (sin talla) */
export async function getResumenWeb(): Promise<DepositoResumenRow[]> {
  const pool = getRimecPool();
  const { rows } = await pool.query<{
    marca: string;
    linea: string;
    referencia: string;
    material: string;
    color: string;
    stock_total: string | number;
  }>(
    `
    SELECT
      COALESCE(mv.descp_marca, '—') AS marca,
      l.codigo_proveedor::text AS linea,
      r.codigo_proveedor::text AS referencia,
      COALESCE(mat.descripcion, '—') AS material,
      COALESCE(col.nombre, '—') AS color,
      SUM(md.cantidad * md.signo) AS stock_total
    FROM movimiento_detalle md
    JOIN movimiento m ON m.id = md.movimiento_id
    JOIN combinacion c ON c.id = md.combinacion_id
    JOIN linea l ON l.id = c.linea_id
    JOIN referencia r ON r.id = c.referencia_id
    LEFT JOIN material mat ON mat.id = c.material_id
    LEFT JOIN color col ON col.id = c.color_id
    LEFT JOIN traspaso tr ON tr.numero_registro = m.documento_ref
    LEFT JOIN marca_v2 mv ON mv.id_marca = COALESCE(
      (tr.snapshot_json->>'id_marca')::int,
      l.marca_id
    )
    WHERE m.almacen_destino_id = $1
      AND m.estado = 'CONFIRMADO'
      AND m.tipo = 'INGRESO_COMPRA'
    GROUP BY mv.descp_marca, l.codigo_proveedor, r.codigo_proveedor, mat.descripcion, col.nombre
    HAVING SUM(md.cantidad * md.signo) > 0
    ORDER BY mv.descp_marca, l.codigo_proveedor, r.codigo_proveedor
    `,
    [ALM_WEB_BAZAR],
  );

  return rows.map((r) => ({
    marca: r.marca,
    linea: r.linea,
    referencia: r.referencia,
    material: r.material,
    color: r.color,
    stock_total: Number(r.stock_total) || 0,
  }));
}

/** get_stock_web — incluye talla */
export async function getStockWeb(): Promise<DepositoStockRow[]> {
  const pool = getRimecPool();
  const { rows } = await pool.query<{
    marca: string;
    linea: string;
    referencia: string;
    material: string;
    color: string;
    talla: string;
    stock: string | number;
  }>(
    `
    SELECT
      COALESCE(mv.descp_marca, '—') AS marca,
      l.codigo_proveedor::text AS linea,
      r.codigo_proveedor::text AS referencia,
      COALESCE(mat.descripcion, '—') AS material,
      COALESCE(col.nombre, '—') AS color,
      tl.talla_etiqueta AS talla,
      SUM(md.cantidad * md.signo) AS stock
    FROM movimiento_detalle md
    JOIN movimiento m ON m.id = md.movimiento_id
    JOIN combinacion c ON c.id = md.combinacion_id
    JOIN linea l ON l.id = c.linea_id
    JOIN referencia r ON r.id = c.referencia_id
    LEFT JOIN material mat ON mat.id = c.material_id
    LEFT JOIN color col ON col.id = c.color_id
    JOIN talla tl ON tl.id = c.talla_id
    LEFT JOIN traspaso tr ON tr.numero_registro = m.documento_ref
    LEFT JOIN marca_v2 mv ON mv.id_marca = COALESCE(
      (tr.snapshot_json->>'id_marca')::int,
      l.marca_id
    )
    WHERE m.almacen_destino_id = $1
      AND m.estado = 'CONFIRMADO'
      AND m.tipo = 'INGRESO_COMPRA'
    GROUP BY mv.descp_marca, l.codigo_proveedor, r.codigo_proveedor, mat.descripcion, col.nombre, tl.talla_etiqueta
    HAVING SUM(md.cantidad * md.signo) > 0
    ORDER BY mv.descp_marca, l.codigo_proveedor, r.codigo_proveedor, tl.talla_etiqueta
    `,
    [ALM_WEB_BAZAR],
  );

  return rows.map((r) => ({
    marca: r.marca,
    linea: r.linea,
    referencia: r.referencia,
    material: r.material,
    color: r.color,
    talla: r.talla,
    stock: Number(r.stock) || 0,
  }));
}

export async function fetchDepositoWebData() {
  const [resumen, detalle] = await Promise.all([getResumenWeb(), getStockWeb()]);
  const pares = resumen.reduce((acc, r) => acc + r.stock_total, 0);
  return {
    resumen,
    detalle,
    metricas: {
      articulos: resumen.length,
      pares,
    },
  };
}
