import fs from "fs";
import pg from "pg";

const url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const c = new pg.Client({ connectionString: url });
await c.connect();
const r = await c.query(
  `SELECT id, linea, referencia, grades_json, fila_origen_f9
   FROM pedido_proveedor_detalle WHERE pedido_proveedor_id = 28 LIMIT 3`,
);
console.log(JSON.stringify(r.rows, null, 2));
const snap = await c.query(`SELECT pp_id, jsonb_array_length(filas) n FROM pp_proforma_filas WHERE pp_id IN (26,28)`);
console.log("snap", snap.rows);
await c.end();
