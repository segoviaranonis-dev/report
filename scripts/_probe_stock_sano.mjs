import fs from "fs";
import pg from "pg";

const env = fs.readFileSync(".env.local", "utf8");
const m = env.match(/^DATABASE_URL=(.+)$/m);
const url = m?.[1]?.trim().replace(/^["']|["']$/g, "");
if (!url) {
  console.error("DATABASE_URL not found");
  process.exit(1);
}
const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
});

try {
  const tables = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND (table_name ILIKE '%stock%sano%' OR table_name ILIKE '%sano%' OR table_name ILIKE '%deposito_precio%')
    ORDER BY 1
  `);
  console.log("TABLAS STOCK SANO:", tables.rows);

  const neto = await pool.query(`
    WITH s AS (
      SELECT md.combinacion_id, SUM(
        CASE
          WHEN m.tipo = 'INGRESO_COMPRA' AND m.almacen_destino_id = 1 THEN md.cantidad * md.signo
          WHEN m.tipo = 'VENTA_WEB' AND m.almacen_origen_id = 1 THEN -md.cantidad
          ELSE 0
        END
      )::int AS stock
      FROM movimiento_detalle md
      JOIN movimiento m ON m.id = md.movimiento_id
      WHERE m.estado = 'CONFIRMADO'
        AND (
          (m.tipo = 'INGRESO_COMPRA' AND m.almacen_destino_id = 1) OR
          (m.tipo = 'VENTA_WEB' AND m.almacen_origen_id = 1)
        )
      GROUP BY md.combinacion_id
      HAVING SUM(
        CASE
          WHEN m.tipo = 'INGRESO_COMPRA' AND m.almacen_destino_id = 1 THEN md.cantidad * md.signo
          WHEN m.tipo = 'VENTA_WEB' AND m.almacen_origen_id = 1 THEN -md.cantidad
          ELSE 0
        END
      ) > 0
    )
    SELECT COUNT(*)::int AS skus, SUM(stock)::int AS pares FROM s
  `);
  console.log("STOCK NETO ALM_WEB_01:", neto.rows[0]);

  const ingreso = await pool.query(`
    SELECT SUM(md.cantidad * md.signo)::int AS pares
    FROM movimiento_detalle md
    JOIN movimiento m ON m.id = md.movimiento_id
    WHERE m.almacen_destino_id = 1 AND m.estado = 'CONFIRMADO' AND m.tipo = 'INGRESO_COMPRA'
  `);
  console.log("PARES INGRESO BRUTO:", ingreso.rows[0]);

  const lista = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name ILIKE '%lista%precio%'
  `);
  console.log("TABLAS lista precio:", lista.rows);

  const lista2 = await pool.query(`SELECT * FROM lista_precio LIMIT 5`).catch((e) => ({ rows: [], err: e.message }));
  console.log("lista_precio rows:", lista2.rows, lista2.err || "");

  const alm = await pool.query(`SELECT * FROM almacen ORDER BY id LIMIT 10`).catch((e) => ({ rows: [], err: e.message }));
  console.log("almacen:", alm.rows, alm.err || "");

  const precios = await pool.query(`
    SELECT COUNT(*)::int AS n FROM precio WHERE fecha_hasta IS NULL
  `);
  console.log("precio vigentes:", precios.rows[0]);

  const reglas = await pool.query(`SELECT COUNT(*)::int AS n FROM caso_precio_web_regla WHERE activo=true`);
  console.log("reglas activas:", reglas.rows[0]);

  const catalogo = await pool.query(`
    WITH det AS (
      SELECT
        c.id AS combinacion_id,
        l.id AS linea_id,
        r.id AS referencia_id,
        mat.id AS material_id,
        l.codigo_proveedor::text AS linea,
        r.codigo_proveedor::text AS referencia,
        COALESCE(mat.descripcion, '—') AS material,
        SUM(md.cantidad * md.signo)::int AS stock,
        pl.lpn,
        pl.nombre_caso_aplicado AS caso_precio
      FROM movimiento_detalle md
      JOIN movimiento m ON m.id = md.movimiento_id
      JOIN traspaso tr ON tr.numero_registro = m.documento_ref
      JOIN combinacion c ON c.id = md.combinacion_id
      JOIN linea l ON l.id = c.linea_id
      JOIN referencia r ON r.id = c.referencia_id
      LEFT JOIN material mat ON mat.id = c.material_id
      LEFT JOIN pedido_proveedor pp ON pp.id = (tr.snapshot_json->>'id_pp')::int
      LEFT JOIN intencion_compra_pedido icp ON icp.pedido_proveedor_id = pp.id
      LEFT JOIN LATERAL (
        SELECT pl2.lpn, pl2.nombre_caso_aplicado
        FROM precio_lista pl2
        WHERE pl2.evento_id = icp.precio_evento_id
          AND pl2.linea_id = l.id
          AND pl2.referencia_id = r.id
          AND pl2.material_id = mat.id
        LIMIT 1
      ) pl ON true
      WHERE m.almacen_destino_id = 1 AND m.estado = 'CONFIRMADO' AND m.tipo = 'INGRESO_COMPRA'
      GROUP BY c.id, l.id, r.id, mat.id, l.codigo_proveedor, r.codigo_proveedor, mat.descripcion, pl.lpn, pl.nombre_caso_aplicado
      HAVING SUM(md.cantidad * md.signo) > 0
    )
    SELECT
      COUNT(*)::int AS combinaciones,
      SUM(stock)::int AS pares,
      COUNT(*) FILTER (WHERE lpn IS NOT NULL)::int AS con_lpn,
      COUNT(DISTINCT (linea_id, referencia_id, material_id))::int AS tripletas
    FROM det
  `);
  console.log("CATALOGO ingreso:", catalogo.rows[0]);

  const fn = await pool.query(`SELECT fn_precio_venta_web(100000, 'DEFAULT') AS p`).catch((e) => ({ rows: [{ err: e.message }] }));
  console.log("fn_precio_venta_web test:", fn.rows[0]);

  const v = await pool.query(`
    SELECT estado_stock_sano, COUNT(*)::int AS filas, SUM(stock_pares)::int AS pares
    FROM v_stock_sano_deposito WHERE almacen_id = 1
    GROUP BY estado_stock_sano
  `);
  console.log("v_stock_sano:", v.rows);

  const dep = await pool.query(`SELECT COUNT(*)::int AS n FROM stock_sano_deposito WHERE almacen_id=1`);
  console.log("stock_sano_deposito:", dep.rows[0]);

  const prec = await pool.query(`SELECT COUNT(*)::int AS n FROM precio WHERE fecha_hasta IS NULL`);
  console.log("precio vigentes post:", prec.rows[0]);
} catch (e) {
  console.error("ERR:", e.message);
} finally {
  await pool.end();
}
