/** Diff depósito vs retail — filas donde cantidad difiere (cliente 2100). */
import fs from "fs";
import pg from "pg";

const url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const c = new pg.Client({ connectionString: url });
await c.connect();
try {
  const r = await c.query(`
    WITH retail AS (
      SELECT r.id, r.linea_codigo_proveedor, r.referencia_codigo_proveedor,
             r.excel_material_code, r.excel_color_code, r.grada,
             r.cantidad::float8 AS cant_retail
      FROM registro_st_vt_rc_reposicion r
      INNER JOIN tiendas_marcas tm ON tm.cliente_id = 2100
        AND tm.marca_id = r.marca_id AND tm.activo = true
      WHERE r.cliente_id = 2100 AND lower(btrim(r.tipo_movimiento)) = 'stock'
    ),
    dep AS (
      SELECT id, linea_codigo_proveedor, referencia_codigo_proveedor,
             excel_material_code, excel_color_code, grada, cantidad::float8 AS cant_dep
      FROM deposito_1_2100_tienda
    )
    SELECT d.linea_codigo_proveedor AS linea, d.referencia_codigo_proveedor AS ref,
           d.excel_material_code AS mat, d.excel_color_code AS color, d.grada,
           d.cant_dep, rt.cant_retail, (rt.cant_retail - d.cant_dep)::float8 AS delta
    FROM dep d
    JOIN retail rt ON rt.id = d.id
    WHERE d.cant_dep IS DISTINCT FROM rt.cant_retail
    ORDER BY abs(rt.cant_retail - d.cant_dep) DESC
    LIMIT 20
  `);
  const sum = await c.query(`
    WITH retail AS (
      SELECT r.id, r.cantidad::float8 AS cant_retail
      FROM registro_st_vt_rc_reposicion r
      INNER JOIN tiendas_marcas tm ON tm.cliente_id = 2100
        AND tm.marca_id = r.marca_id AND tm.activo = true
      WHERE r.cliente_id = 2100 AND lower(btrim(r.tipo_movimiento)) = 'stock'
    ),
    dep AS (SELECT id, cantidad::float8 AS cant_dep FROM deposito_1_2100_tienda)
    SELECT count(*)::int AS filas_distintas,
           coalesce(sum(rt.cant_retail - d.cant_dep), 0)::float8 AS pares_faltantes_en_deposito
    FROM dep d JOIN retail rt ON rt.id = d.id
    WHERE d.cant_dep IS DISTINCT FROM rt.cant_retail
  `);
  console.log(JSON.stringify({ resumen: sum.rows[0], muestra: r.rows }, null, 2));
} finally {
  await c.end();
}
