import fs from "fs";
import pg from "pg";

const url = fs.readFileSync("c:/Users/hecto/Nexus_Core/report/.env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const c = new pg.Client({ connectionString: url });
await c.connect();

const matDiff = await c.query(`
  SELECT COUNT(DISTINCT ppd.material_code)::int AS n
  FROM pedido_proveedor_detalle ppd
  JOIN material m ON m.codigo_proveedor::text = ppd.material_code AND m.proveedor_id = 654
  WHERE ppd.pedido_proveedor_id = 25
    AND ppd.descp_material IS NOT NULL AND TRIM(ppd.descp_material) <> ''
    AND COALESCE(TRIM(m.descripcion), '') <> TRIM(ppd.descp_material)
`);

const colTono = await c.query(`
  SELECT COUNT(*)::int AS sin_tono
  FROM pedido_proveedor_detalle ppd
  JOIN color col ON col.codigo_proveedor::text = ppd.color_code AND col.proveedor_id = 654
  WHERE ppd.pedido_proveedor_id = 25
    AND (col.tono_canon IS NULL OR btrim(col.tono_canon->>'etiqueta') = '')
    AND ppd.descp_color IS NOT NULL AND TRIM(ppd.descp_color) <> ''
`);

console.log(JSON.stringify({ matDescDiff: matDiff.rows[0], colSinTono: colTono.rows[0] }, null, 2));
await c.end();
