import fs from "fs";
import pg from "pg";

const url = fs.readFileSync("c:/Users/hecto/Nexus_Core/report/.env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const pool = new pg.Pool({ connectionString: url });

const { rows } = await pool.query(`
  WITH pp_cat AS (
    SELECT
      pp.id AS pp_id,
      COALESCE(
        pp.categoria_id,
        (
          SELECT ic.categoria_id
          FROM intencion_compra_pedido icp
          JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
          WHERE icp.pedido_proveedor_id = pp.id
          ORDER BY icp.id
          LIMIT 1
        )
      ) AS categoria_id
    FROM pedido_proveedor pp
  )
  SELECT
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE COALESCE(v.pares_vendidos, 0) > 0)::int AS con_vendido,
    COUNT(*) FILTER (WHERE UPPER(TRIM(COALESCE(v.caso_precio, v.descp_caso, ''))) = 'PROMOCIONAL')::int AS promocional_total,
    COUNT(*) FILTER (
      WHERE UPPER(TRIM(COALESCE(v.caso_precio, v.descp_caso, ''))) = 'PROMOCIONAL'
        AND COALESCE(v.pares_vendidos, 0) > 0
    )::int AS promocional_vendido
  FROM v_stock_rimec v
  JOIN pp_cat pc ON pc.pp_id = v.pp_id
  WHERE v.origen_tipo = 'TRÁNSITO_PP'
    AND (v.saldo_pares > 0 OR COALESCE(v.pares_vendidos, 0) > 0)
    AND pc.categoria_id = 2
`);

console.log("Transito CP stats:", rows[0]);

const sample = await pool.query(`
  WITH pp_cat AS (
    SELECT pp.id AS pp_id, COALESCE(pp.categoria_id, (
      SELECT ic.categoria_id FROM intencion_compra_pedido icp
      JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
      WHERE icp.pedido_proveedor_id = pp.id ORDER BY icp.id LIMIT 1
    )) AS categoria_id FROM pedido_proveedor pp
  )
  SELECT DISTINCT UPPER(TRIM(COALESCE(v.caso_precio, v.descp_caso, ''))) AS caso,
         COUNT(*)::int AS n,
         SUM(COALESCE(v.pares_vendidos, 0))::float AS vendido
  FROM v_stock_rimec v
  JOIN pp_cat pc ON pc.pp_id = v.pp_id
  WHERE v.origen_tipo = 'TRÁNSITO_PP'
    AND (v.saldo_pares > 0 OR COALESCE(v.pares_vendidos, 0) > 0)
    AND pc.categoria_id = 2
  GROUP BY 1
  ORDER BY n DESC
  LIMIT 15
`);
console.log("Casos top:", sample.rows);

const bib = await pool.query(`
  SELECT id, nombre_caso, lineas
  FROM precio_biblioteca_caso
  WHERE biblioteca_id = 1505 AND UPPER(TRIM(nombre_caso)) LIKE '%PROMO%'
`);
for (const c of bib.rows) {
  const lineas = c.lineas ?? [];
  console.log("BCL", c.nombre_caso, "lineas", lineas.length, "sample", lineas.slice(0, 3));
}

await pool.end();
