import pg from "pg";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) {
  console.error("NO DATABASE_URL");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

const ppRes = await pool.query(`
  SELECT pp.id, pp.numero_registro, pp.estado, pp.estado_transito, pp.categoria_id, pp.quincena_arribo_id,
    (SELECT COUNT(*) FROM pedido_proveedor_detalle ppd WHERE ppd.pedido_proveedor_id=pp.id AND ppd.referencia IS NOT NULL) AS moleculas,
    (SELECT COALESCE(SUM(cantidad_pares),0) FROM pedido_proveedor_detalle ppd WHERE ppd.pedido_proveedor_id=pp.id) AS pares
  FROM pedido_proveedor pp WHERE pp.id = 14
`);
console.log("PP:", ppRes.rows[0]);

const evRes = await pool.query(`
  SELECT pe.id, pe.nombre_evento, pe.estado, COUNT(pl.id)::int AS n_precios
  FROM intencion_compra_pedido icp
  JOIN precio_evento pe ON pe.id = icp.precio_evento_id
  LEFT JOIN precio_lista pl ON pl.evento_id = pe.id
  WHERE icp.pedido_proveedor_id = 14
  GROUP BY pe.id, pe.nombre_evento, pe.estado
`);
console.log("EVENTO:", evRes.rows);

try {
  const vRes = await pool.query(`SELECT COUNT(*)::int AS n FROM v_stock_rimec WHERE pp_id = 14`);
  console.log("v_stock_rimec pp_id=14:", vRes.rows[0]);
} catch (e) {
  console.log("v_stock_rimec error:", e.message);
}

const transito = await pool.query(`
  SELECT id, numero_registro, estado_transito FROM pedido_proveedor WHERE estado_transito = 'EN_TRANSITO' ORDER BY id
`);
console.log("PP EN_TRANSITO:", transito.rows);

const rls = await pool.query(`
  SELECT pol.polname, pg_get_expr(pol.polqual, pol.polrelid) AS qual
  FROM pg_policy pol
  JOIN pg_class cls ON cls.oid = pol.polrelid
  WHERE cls.relname IN ('pedido_proveedor', 'pedido_proveedor_detalle')
`);
console.log("RLS:", rls.rows);

const ppd14 = await pool.query(`
  SELECT COUNT(*)::int n, COUNT(*) FILTER (WHERE referencia IS NULL)::int sin_ref
  FROM pedido_proveedor_detalle WHERE pedido_proveedor_id = 14
`);
console.log("PPD14:", ppd14.rows[0]);

const ppdAll = await pool.query(`
  SELECT pp.id, pp.numero_registro, COUNT(ppd.id)::int AS n_ppd
  FROM pedido_proveedor pp
  JOIN pedido_proveedor_detalle ppd ON ppd.pedido_proveedor_id = pp.id
  WHERE pp.estado_transito = 'EN_TRANSITO' AND ppd.referencia IS NOT NULL
  GROUP BY pp.id, pp.numero_registro
  ORDER BY pp.id
`);
console.log("PPD por PP EN_TRANSITO:", ppdAll.rows);
const total = ppdAll.rows.reduce((s, r) => s + r.n_ppd, 0);
console.log("TOTAL PPD filas (estadisticas):", total);

await pool.end();
