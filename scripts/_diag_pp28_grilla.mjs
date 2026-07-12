import fs from "fs";
import pg from "pg";

const dbUrl = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const pool = new pg.Pool({ connectionString: dbUrl });

const ppId = 28;
const { rows: ppRows } = await pool.query(
  "SELECT id, numero_registro, numero_proforma, quincena_arribo_id, categoria_id FROM pedido_proveedor WHERE id = $1",
  [ppId],
);
const { rows: catRows } = await pool.query(
  `
  WITH pp_cat AS (
    SELECT pp.id AS pp_id,
      COALESCE(pp.categoria_id, (
        SELECT ic.categoria_id FROM intencion_compra_pedido icp
        JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
        WHERE icp.pedido_proveedor_id = pp.id ORDER BY icp.id LIMIT 1
      )) AS categoria_id
    FROM pedido_proveedor pp
  )
  SELECT * FROM pp_cat WHERE pp_id = $1
  `,
  [ppId],
);
const { rows: ppdRows } = await pool.query(
  `
  SELECT COUNT(*)::int AS n,
    SUM(COALESCE(cantidad_pares,0))::int AS ini,
    SUM(COALESCE(pares_vendidos,0))::int AS vend,
    SUM(GREATEST(0, COALESCE(cantidad_pares,0)-COALESCE(pares_vendidos,0)))::int AS saldo
  FROM pedido_proveedor_detalle WHERE pedido_proveedor_id = $1
  `,
  [ppId],
);
const { rows: visibleRows } = await pool.query(
  `
  SELECT COUNT(*)::int AS n FROM pedido_proveedor_detalle ppd
  WHERE pedido_proveedor_id = $1 AND referencia IS NOT NULL AND linea IS NOT NULL
    AND (GREATEST(0, COALESCE(cantidad_pares,0)-GREATEST(COALESCE(pares_vendidos,0),0)) > 0
      OR GREATEST(COALESCE(pares_vendidos,0),0) > 0)
  `,
  [ppId],
);
const { rows: proformas } = await pool.query(
  `
  SELECT pp.id, pp.numero_registro, pp.numero_proforma
  FROM pedido_proveedor pp
  WHERE pp.categoria_id = 3 OR EXISTS (
    SELECT 1 FROM intencion_compra_pedido icp
    JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
    WHERE icp.pedido_proveedor_id = pp.id AND ic.categoria_id = 3
  )
  ORDER BY pp.id
  `,
);

console.log(
  JSON.stringify(
    { pp: ppRows[0], pp_cat: catRows[0], ppd: ppdRows[0], visible: visibleRows[0], proformas_count: proformas.length, proformas_sample: proformas.filter((p) => String(p.numero_proforma || "").includes("8051")) },
    null,
    2,
  ),
);
await pool.end();
