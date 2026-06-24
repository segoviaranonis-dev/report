import fs from "fs";
import pg from "pg";

const url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const c = new pg.Client({ connectionString: url });
await c.connect();

try {
  const sameMat = await c.query(`
    SELECT col.codigo_proveedor AS color, d.grada, d.cantidad
    FROM deposito_1_2100_tienda d
    JOIN color col ON col.id = d.color_id
    JOIN material m ON m.id = d.material_id
    WHERE m.codigo_proveedor = '24892' AND d.linea_id = 459 AND d.referencia_id = 3897
    ORDER BY col.codigo_proveedor, d.grada
  `);

  const siblings = await c.query(`
    SELECT m.codigo_proveedor AS mat, col.codigo_proveedor AS color, d.grada, d.cantidad
    FROM deposito_1_2100_tienda d
    JOIN linea l ON l.id = d.linea_id
    JOIN referencia r ON r.id = d.referencia_id
    JOIN material m ON m.id = d.material_id
    JOIN color col ON col.id = d.color_id
    WHERE l.codigo_proveedor = '4202' AND r.codigo_proveedor = '500' AND d.cantidad > 0
    ORDER BY m.codigo_proveedor, col.codigo_proveedor, d.grada
    LIMIT 40
  `);

  const ventas = await c.query(`
    SELECT id, created_at, estado FROM ticket_venta_pos
    WHERE cliente_id = 2100 ORDER BY created_at DESC LIMIT 5
  `);

  console.log(JSON.stringify({ sameMat24892: sameMat.rows, siblings4202_500: siblings.rows, ventas: ventas.rows }, null, 2));
} finally {
  await c.end();
}
