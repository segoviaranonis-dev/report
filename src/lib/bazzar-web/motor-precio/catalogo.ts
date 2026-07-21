/**
 * Guardián de precios — stock ALM_WEB_01 + LPN/caso del evento de ingreso + fn_precio_venta_web
 * OT-510 / Director: 3 pilares L+R+Material, markup por caso (ej. +50% → 100.000 → 150.000)
 */
import { getRimecPool } from "@/lib/rimec/pool";
import { ALM_WEB_BAZAR } from "@/lib/bazzar-web/compra-web/constants";
import { LPN_CASO_LATERAL_SQL, LPN_CASO_SELECT } from "./lpn-caso-sql";
import type { CatalogoPrecioRow } from "./types";

const CATALOGO_SQL = `
WITH det AS (
  SELECT
    l.codigo_proveedor::text AS linea,
    r.codigo_proveedor::text AS referencia,
    COALESCE(mat.descripcion, '—') AS material,
    c.id AS combinacion_id,
    SUM(md.cantidad * md.signo)::int AS stock,
    ${LPN_CASO_SELECT},
    (
      SELECT p.valor
      FROM precio p
      JOIN lista_precio lp ON lp.id = p.lista_id
      WHERE p.combinacion_id = c.id
        AND p.fecha_hasta IS NULL
        AND lp.tipo = 'WEB'
        AND lp.activa = true
      ORDER BY p.id DESC
      LIMIT 1
    ) AS precio_publicado
  FROM movimiento_detalle md
  JOIN movimiento m ON m.id = md.movimiento_id
  JOIN traspaso tr ON tr.numero_registro = m.documento_ref
  JOIN combinacion c ON c.id = md.combinacion_id
  JOIN linea l ON l.id = c.linea_id
  JOIN referencia r ON r.id = c.referencia_id
  LEFT JOIN material mat ON mat.id = c.material_id
  LEFT JOIN pedido_proveedor pp ON pp.id = NULLIF(tr.snapshot_json->>'id_pp', '')::int
  LEFT JOIN intencion_compra_pedido icp ON icp.pedido_proveedor_id = pp.id
  ${LPN_CASO_LATERAL_SQL}
  WHERE m.almacen_destino_id = $1
    AND m.estado = 'CONFIRMADO'
    AND m.tipo = 'INGRESO_COMPRA'
  GROUP BY l.codigo_proveedor, r.codigo_proveedor, mat.descripcion, c.id,
           pl.lpn, pl.nombre_caso_aplicado, pe_pl.lpn, pe_pl.caso_precio
  HAVING SUM(md.cantidad * md.signo) > 0
)
SELECT
  linea,
  referencia,
  material,
  SUM(stock)::int AS stock_pares,
  MAX(lpn)::float AS lpn,
  MAX(caso_precio) AS caso_precio,
  (
    SELECT markup_pct FROM caso_precio_web_regla cpr
    WHERE UPPER(TRIM(cpr.caso_codigo)) = UPPER(TRIM(COALESCE(MAX(caso_precio), 'DEFAULT')))
      AND cpr.activo = true
    LIMIT 1
  )::float AS markup_pct,
  fn_precio_venta_web(MAX(lpn), MAX(caso_precio))::float AS precio_web_calculado,
  MAX(precio_publicado)::float AS precio_web_publicado,
  COUNT(DISTINCT combinacion_id)::int AS combinaciones
FROM det
GROUP BY linea, referencia, material
ORDER BY linea, referencia, material
`;

export async function getCatalogoPrecios(): Promise<CatalogoPrecioRow[]> {
  const pool = getRimecPool();
  const { rows } = await pool.query<{
    linea: string;
    referencia: string;
    material: string;
    stock_pares: number;
    lpn: number | null;
    caso_precio: string | null;
    markup_pct: number | null;
    precio_web_calculado: number | null;
    precio_web_publicado: number | null;
    combinaciones: number;
  }>(CATALOGO_SQL, [ALM_WEB_BAZAR]);

  return rows.map((r) => ({
    linea: r.linea,
    referencia: r.referencia,
    material: r.material,
    stock_pares: Number(r.stock_pares) || 0,
    lpn: r.lpn != null ? Number(r.lpn) : null,
    caso_precio: r.caso_precio,
    markup_pct: r.markup_pct != null ? Number(r.markup_pct) : null,
    precio_rimec_lpn: r.lpn != null ? Number(r.lpn) : null,
    precio_web_calculado:
      r.precio_web_calculado != null ? Number(r.precio_web_calculado) : null,
    precio_web_publicado:
      r.precio_web_publicado != null ? Number(r.precio_web_publicado) : null,
    combinaciones: Number(r.combinaciones) || 0,
    sin_precio: r.lpn == null || r.precio_web_calculado == null,
  }));
}

/** Publica precio_web calculado en lista WEB por combinación con stock */
export async function publicarPreciosWeb(): Promise<{
  ok: boolean;
  publicados: number;
  omitidos: number;
  error?: string;
}> {
  const pool = getRimecPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const lista = await client.query<{ id: number }>(
      `SELECT id FROM lista_precio WHERE tipo = 'WEB' AND activa = true ORDER BY id LIMIT 1`,
    );
    const listaId = lista.rows[0]?.id;
    if (!listaId) {
      await client.query("ROLLBACK");
      return { ok: false, publicados: 0, omitidos: 0, error: "No hay lista_precio WEB activa." };
    }

    const { rows: combos } = await client.query<{
      combinacion_id: number;
      lpn: number;
      caso_precio: string;
      precio: number;
    }>(
      `
      WITH det AS (
        SELECT
          c.id AS combinacion_id,
          ${LPN_CASO_SELECT},
          SUM(md.cantidad * md.signo) AS stock
        FROM movimiento_detalle md
        JOIN movimiento m ON m.id = md.movimiento_id
        JOIN traspaso tr ON tr.numero_registro = m.documento_ref
        JOIN combinacion c ON c.id = md.combinacion_id
        JOIN linea l ON l.id = c.linea_id
        JOIN referencia r ON r.id = c.referencia_id
        LEFT JOIN material mat ON mat.id = c.material_id
        LEFT JOIN pedido_proveedor pp ON pp.id = NULLIF(tr.snapshot_json->>'id_pp', '')::int
        LEFT JOIN intencion_compra_pedido icp ON icp.pedido_proveedor_id = pp.id
        ${LPN_CASO_LATERAL_SQL}
        WHERE m.almacen_destino_id = $1
          AND m.estado = 'CONFIRMADO'
          AND m.tipo = 'INGRESO_COMPRA'
        GROUP BY c.id, pl.lpn, pl.nombre_caso_aplicado, pe_pl.lpn, pe_pl.caso_precio
        HAVING SUM(md.cantidad * md.signo) > 0
      )
      SELECT
        combinacion_id,
        lpn::float AS lpn,
        caso_precio,
        fn_precio_venta_web(lpn, caso_precio)::float AS precio
      FROM det
      WHERE lpn IS NOT NULL AND caso_precio IS NOT NULL
      `,
      [ALM_WEB_BAZAR],
    );

    let publicados = 0;
    let omitidos = 0;

    for (const row of combos) {
      const precio = Number(row.precio);
      if (!Number.isFinite(precio) || precio <= 0) {
        omitidos += 1;
        continue;
      }

      await client.query(
        `
        UPDATE precio SET fecha_hasta = NOW()
        WHERE combinacion_id = $1 AND lista_id = $2 AND fecha_hasta IS NULL
        `,
        [row.combinacion_id, listaId],
      );

      await client.query(
        `
        INSERT INTO precio (combinacion_id, lista_id, valor, fecha_desde)
        VALUES ($1, $2, $3, NOW())
        `,
        [row.combinacion_id, listaId, precio],
      );
      publicados += 1;
    }

    await client.query("COMMIT");
    return { ok: true, publicados, omitidos };
  } catch (e) {
    await client.query("ROLLBACK");
    return {
      ok: false,
      publicados: 0,
      omitidos: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    client.release();
  }
}
