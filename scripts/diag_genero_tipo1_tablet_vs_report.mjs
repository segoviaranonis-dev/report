/**
 * Discrepancia género Report vs Tablet + tipo_1 — Fernando 2100
 */
import fs from "fs";
import pg from "pg";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const c = new pg.Client({ connectionString: url });
await c.connect();

try {
  const reportGenero = await c.query(`
    SELECT g.descripcion AS genero,
           COUNT(*) FILTER (WHERE d.cantidad > 0)::int AS skus_vendibles,
           COALESCE(SUM(d.cantidad) FILTER (WHERE d.cantidad > 0), 0)::float8 AS pares_vendibles,
           COUNT(*)::int AS filas_total,
           COALESCE(SUM(d.cantidad), 0)::float8 AS pares_total
    FROM deposito_1_2100_tienda d
    LEFT JOIN genero g ON g.id = d.genero_id
    WHERE COALESCE(d.tipo_v2_id, 1) = 1
    GROUP BY g.descripcion
    ORDER BY pares_total DESC
  `);

  const tabletGenero = await c.query(`
    SELECT COALESCE(NULLIF(btrim(g.descripcion::text), ''), '(sin género)') AS genero,
           COUNT(*)::int AS skus_vendibles,
           COALESCE(SUM(s.cantidad), 0)::float8 AS pares_vendibles
    FROM deposito_1_2100_tienda s
    LEFT JOIN linea l ON l.id = s.linea_id AND COALESCE(l.activo, true) = true
    LEFT JOIN referencia ref ON ref.id = s.referencia_id
    LEFT JOIN linea_referencia lr ON lr.linea_id = s.linea_id AND lr.referencia_id = s.referencia_id
    LEFT JOIN genero g ON g.id = COALESCE(l.genero_id, s.genero_id)
    WHERE s.cantidad > 0 AND COALESCE(s.tipo_v2_id, 1) = 1
    GROUP BY 1 ORDER BY 2 DESC
  `);

  const tipo1Wrong = await c.query(`
    SELECT COALESCE(t1_dep.descp_tipo_1, '(null)') AS tipo1_desde_deposito_s,
           COALESCE(t1_ok.descp_tipo_1, '(null)') AS tipo1_desde_lr,
           COUNT(*) FILTER (WHERE s.cantidad > 0)::int AS skus
    FROM deposito_1_2100_tienda s
    LEFT JOIN linea_referencia lr ON lr.linea_id = s.linea_id AND lr.referencia_id = s.referencia_id
    LEFT JOIN tipo_1 t1_dep ON t1_dep.id_tipo_1 = s.tipo_1_id
    LEFT JOIN tipo_1 t1_ok ON t1_ok.id_tipo_1 = lr.tipo_1_id
    WHERE COALESCE(s.tipo_v2_id, 1) = 1 AND s.cantidad > 0
    GROUP BY 1, 2
    ORDER BY skus DESC
    LIMIT 15
  `);

  const tipo1Vendible = await c.query(`
    SELECT COALESCE(NULLIF(btrim(t1.descp_tipo_1::text), ''), '(sin tipo1)') AS tipo1,
           COUNT(*)::int AS skus,
           COALESCE(SUM(s.cantidad), 0)::float8 AS pares
    FROM deposito_1_2100_tienda s
    LEFT JOIN linea l ON l.id = s.linea_id
    LEFT JOIN linea_referencia lr ON lr.linea_id = s.linea_id AND lr.referencia_id = s.referencia_id
    LEFT JOIN tipo_1 t1 ON t1.id_tipo_1 = lr.tipo_1_id
    WHERE s.cantidad > 0 AND COALESCE(s.tipo_v2_id, 1) = 1
    GROUP BY 1 ORDER BY pares DESC
  `);

  console.log(JSON.stringify({
    report_por_deposito_genero_id: reportGenero.rows,
    tablet_por_linea_coalesce_genero: tabletGenero.rows,
    tipo1_bug_linea_vs_lr: tipo1Wrong.rows,
    tipo1_canonico_lr_vendible: tipo1Vendible.rows,
  }, null, 2));
} finally {
  await c.end();
}
