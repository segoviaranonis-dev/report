/** Simula filtro Programado PP-8051 — debe devolver 912 filas PPD. */
import fs from "fs";
import pg from "pg";

const dbUrl = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const pool = new pg.Pool({ connectionString: dbUrl });

const { rows: productos } = await pool.query(`
  SELECT pp.id::int AS pp_id, pp.numero_proforma AS proforma,
    GREATEST(0, COALESCE(ppd.cantidad_pares,0)-COALESCE(ppd.pares_vendidos,0))::int AS cantidad,
    COALESCE(ppd.pares_vendidos,0)::int AS pares_vendidos
  FROM pedido_proveedor_detalle ppd
  JOIN pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
  WHERE pp.categoria_id = 3 AND ppd.referencia IS NOT NULL
`);

const incluir = (r) => r.cantidad > 0 || r.pares_vendidos > 0;
const pp28 = productos.filter((r) => r.pp_id === 28 && incluir(r));
const q8051 = productos.filter(
  (r) => incluir(r) && String(r.proforma || "").toLowerCase().includes("8051"),
);

console.log(
  JSON.stringify(
    {
      total_api: productos.length,
      pp28_filtrado: pp28.length,
      buscar_8051: q8051.length,
      vendido_pp28: pp28.reduce((s, p) => s + p.pares_vendidos, 0),
    },
    null,
    2,
  ),
);
await pool.end();
