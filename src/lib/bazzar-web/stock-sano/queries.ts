/**
 * Protocolo Stock Sano — vista v_stock_sano_deposito + historial ALM_WEB_01
 */
import { getRimecPool } from "@/lib/rimec/pool";
import { ALM_WEB_BAZAR } from "@/lib/bazzar-web/compra-web/constants";
import type { StockSanoHistorialRow, StockSanoPayload, StockSanoRow } from "./types";

export async function getStockSanoDeposito(almacenId = ALM_WEB_BAZAR): Promise<StockSanoPayload> {
  const pool = getRimecPool();

  const alm = await pool.query<{ id: number; nombre: string; protocolo_activo: boolean | null }>(
    `
    SELECT a.id::int, a.nombre, sa.protocolo_activo
    FROM almacen a
    LEFT JOIN stock_sano_almacen sa ON sa.almacen_id = a.id
    WHERE a.id = $1
    `,
    [almacenId],
  );
  const almacen = alm.rows[0];
  if (!almacen) {
    throw new Error(`Almacén ${almacenId} no encontrado`);
  }

  const { rows } = await pool.query<{
    almacen_id: number;
    almacen_nombre: string;
    combinacion_id: number;
    linea: string;
    referencia: string;
    material: string;
    color: string;
    talla: string;
    stock_pares: number;
    stock_sano_id: number | null;
    precio_venta: string | null;
    lpn: string | null;
    caso_codigo: string | null;
    markup_pct: string | null;
    estado_stock_sano: StockSanoRow["estado_stock_sano"];
    protocolo_activo: boolean | null;
  }>(
    `
    SELECT *
    FROM v_stock_sano_deposito
    WHERE almacen_id = $1
    ORDER BY linea, referencia, material, color, talla
    `,
    [almacenId],
  );

  const filas: StockSanoRow[] = rows.map((r) => ({
    almacen_id: r.almacen_id,
    almacen_nombre: r.almacen_nombre,
    combinacion_id: r.combinacion_id,
    linea: r.linea,
    referencia: r.referencia,
    material: r.material,
    color: r.color,
    talla: r.talla,
    stock_pares: Number(r.stock_pares) || 0,
    stock_sano_id: r.stock_sano_id,
    precio_venta: r.precio_venta != null ? Number(r.precio_venta) : null,
    lpn: r.lpn != null ? Number(r.lpn) : null,
    caso_codigo: r.caso_codigo,
    markup_pct: r.markup_pct != null ? Number(r.markup_pct) : null,
    estado_stock_sano: r.estado_stock_sano,
    protocolo_activo: r.protocolo_activo,
  }));

  const tripletas = new Set(filas.map((f) => `${f.linea}|${f.referencia}|${f.material}`)).size;
  const metricas = {
    filas: filas.length,
    pares: filas.reduce((s, f) => s + f.stock_pares, 0),
    sano: filas.filter((f) => f.estado_stock_sano === "SANO").length,
    sin_protocolo: filas.filter((f) => f.estado_stock_sano !== "SANO").length,
    tripletas,
  };

  const hist = await pool.query<{
    id: number;
    evento: string;
    decision: string | null;
    linea_codigo: string;
    referencia_codigo: string;
    material: string | null;
    precio_anterior: string | null;
    precio_aplicado: string | null;
    lpn_entrante: string | null;
    caso_entrante: string | null;
    notas: string | null;
    created_at: string;
  }>(
    `
    SELECT
      h.id,
      h.evento,
      h.decision,
      l.codigo_proveedor::text AS linea_codigo,
      r.codigo_proveedor::text AS referencia_codigo,
      mat.descripcion AS material,
      h.precio_anterior::float,
      h.precio_aplicado::float,
      h.lpn_entrante::float,
      h.caso_entrante,
      h.notas,
      h.created_at::text
    FROM stock_sano_historial h
    JOIN linea l ON l.id = h.linea_id
    JOIN referencia r ON r.id = h.referencia_id
    LEFT JOIN material mat ON mat.id = h.material_id
    WHERE h.almacen_id = $1
    ORDER BY h.created_at DESC
    LIMIT 50
    `,
    [almacenId],
  );

  const historial: StockSanoHistorialRow[] = hist.rows.map((h) => ({
    id: h.id,
    evento: h.evento,
    decision: h.decision,
    linea_codigo: h.linea_codigo,
    referencia_codigo: h.referencia_codigo,
    material: h.material,
    precio_anterior: h.precio_anterior != null ? Number(h.precio_anterior) : null,
    precio_aplicado: h.precio_aplicado != null ? Number(h.precio_aplicado) : null,
    lpn_entrante: h.lpn_entrante != null ? Number(h.lpn_entrante) : null,
    caso_entrante: h.caso_entrante,
    notas: h.notas,
    created_at: h.created_at,
  }));

  return {
    configured: true,
    almacen: {
      id: almacen.id,
      nombre: almacen.nombre,
      protocolo_activo: Boolean(almacen.protocolo_activo),
    },
    metricas,
    filas,
    historial,
  };
}
