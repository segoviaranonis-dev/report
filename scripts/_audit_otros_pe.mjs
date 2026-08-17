import fs from "fs";
import pg from "pg";

const url = fs
  .readFileSync("c:/Users/hecto/Nexus_Core/report/.env.local", "utf8")
  .match(/^DATABASE_URL=(.+)$/m)[1]
  .trim();
const c = new pg.Client({ connectionString: url });
await c.connect();

const maestroE = await c.query(`
  SELECT id_grupo_estilo, descp_grupo_estilo
  FROM grupo_estilo_v2
  WHERE UPPER(TRIM(descp_grupo_estilo)) LIKE '%OTRO%'
  ORDER BY 1
`);
console.log("MAESTRO estilo OTRO*", maestroE.rows);

const maestroT = await c.query(`
  SELECT id_tipo_1, descp_tipo_1
  FROM tipo_1
  WHERE UPPER(TRIM(descp_tipo_1)) LIKE '%OTRO%'
  ORDER BY 1
`);
console.log("MAESTRO tipo1 OTRO*", maestroT.rows);

const peConfEstilo = await c.query(`
  SELECT UPPER(TRIM(COALESCE(ge.descp_grupo_estilo, '(null)'))) AS estilo, COUNT(*)::int AS n
  FROM stock_pronta_entrega_rimec s
  LEFT JOIN linea_referencia lr
    ON lr.linea_id = s.linea_id AND lr.referencia_id = s.referencia_id
  LEFT JOIN grupo_estilo_v2 ge ON ge.id_grupo_estilo = lr.grupo_estilo_id
  WHERE COALESCE(s.tipo_v2_id, 2) = 2
  GROUP BY 1
  ORDER BY n DESC
`);
console.log("PE confecciones estilos", peConfEstilo.rows);

const peConfTipo = await c.query(`
  SELECT UPPER(TRIM(COALESCE(t1.descp_tipo_1, '(null)'))) AS tipo1, COUNT(*)::int AS n
  FROM stock_pronta_entrega_rimec s
  LEFT JOIN linea_referencia lr
    ON lr.linea_id = s.linea_id AND lr.referencia_id = s.referencia_id
  LEFT JOIN tipo_1 t1 ON t1.id_tipo_1 = lr.tipo_1_id
  WHERE COALESCE(s.tipo_v2_id, 2) = 2
  GROUP BY 1
  ORDER BY n DESC
`);
console.log("PE confecciones tipo1", peConfTipo.rows);

const peCalzEstiloOtros = await c.query(`
  SELECT UPPER(TRIM(COALESCE(ge.descp_grupo_estilo, '(null)'))) AS estilo, COUNT(*)::int AS n
  FROM stock_pronta_entrega_rimec s
  LEFT JOIN linea_referencia lr
    ON lr.linea_id = s.linea_id AND lr.referencia_id = s.referencia_id
  LEFT JOIN grupo_estilo_v2 ge ON ge.id_grupo_estilo = lr.grupo_estilo_id
  WHERE COALESCE(s.tipo_v2_id, 1) = 1
    AND UPPER(TRIM(COALESCE(ge.descp_grupo_estilo, ''))) LIKE '%OTRO%'
  GROUP BY 1
  ORDER BY n DESC
`);
console.log("PE calzado estilo OTRO*", peCalzEstiloOtros.rows);

const peCalzTipoOtros = await c.query(`
  SELECT UPPER(TRIM(COALESCE(t1.descp_tipo_1, '(null)'))) AS tipo1, COUNT(*)::int AS n
  FROM stock_pronta_entrega_rimec s
  LEFT JOIN linea_referencia lr
    ON lr.linea_id = s.linea_id AND lr.referencia_id = s.referencia_id
  LEFT JOIN tipo_1 t1 ON t1.id_tipo_1 = lr.tipo_1_id
  WHERE COALESCE(s.tipo_v2_id, 1) = 1
    AND UPPER(TRIM(COALESCE(t1.descp_tipo_1, ''))) LIKE '%OTRO%'
  GROUP BY 1
  ORDER BY n DESC
`);
console.log("PE calzado tipo1 OTRO*", peCalzTipoOtros.rows);

const peAnyOtros = await c.query(`
  SELECT
    COUNT(*) FILTER (
      WHERE UPPER(TRIM(COALESCE(ge.descp_grupo_estilo, ''))) = 'OTROS'
    )::int AS estilo_otros,
    COUNT(*) FILTER (
      WHERE UPPER(TRIM(COALESCE(t1.descp_tipo_1, ''))) = 'OTROS'
    )::int AS tipo1_otros,
    COUNT(*) FILTER (WHERE lr.grupo_estilo_id = 600000)::int AS fk_estilo_600000,
    COUNT(*)::int AS total
  FROM stock_pronta_entrega_rimec s
  LEFT JOIN linea_referencia lr
    ON lr.linea_id = s.linea_id AND lr.referencia_id = s.referencia_id
  LEFT JOIN grupo_estilo_v2 ge ON ge.id_grupo_estilo = lr.grupo_estilo_id
  LEFT JOIN tipo_1 t1 ON t1.id_tipo_1 = lr.tipo_1_id
`);
console.log("PE ALL exact OTROS", peAnyOtros.rows[0]);

const lrOtros = await c.query(`
  SELECT COUNT(*)::int AS lr_con_estilo_otros
  FROM linea_referencia
  WHERE grupo_estilo_id = 600000
`);
console.log("LR con estilo OTROS", lrOtros.rows[0]);

await c.end();
