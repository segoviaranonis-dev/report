import fs from "fs";
import pg from "pg";

const PEDIDOS_CON_PREFIJO_ASIGNADO = new Set(["4081", "4082", "4099"]);

function normalizarNumeroPedidoExterno(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";

  const ppMatch = s.match(/^PP\s*[-–]?\s*(.+)$/i);
  if (!ppMatch) return s;

  const numero = ppMatch[1].replace(/\s+/g, "");
  if (PEDIDOS_CON_PREFIJO_ASIGNADO.has(numero)) return `PP-${numero}`;
  return numero;
}

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) {
  throw new Error("DATABASE_URL no configurada en .env.local");
}

const pool = new pg.Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});
const client = await pool.connect();

try {
  await client.query("BEGIN");
  const { rows } = await client.query(`
    SELECT id, numero_registro, nro_pedido_externo
    FROM pedido_proveedor
    WHERE nro_pedido_externo IS NOT NULL
      AND btrim(nro_pedido_externo) <> ''
    ORDER BY id
    FOR UPDATE`);

  const cambios = [];
  for (const row of rows) {
    const anterior = String(row.nro_pedido_externo);
    const nuevo = normalizarNumeroPedidoExterno(anterior);
    if (nuevo === anterior) continue;

    await client.query(
      `UPDATE pedido_proveedor
       SET nro_pedido_externo = $1
       WHERE id = $2`,
      [nuevo || null, row.id],
    );
    cambios.push({
      id: row.id,
      pedido: row.numero_registro,
      anterior,
      nuevo,
    });
  }

  await client.query("COMMIT");
  console.table(cambios);

  const auditoria = await client.query(`
    SELECT id, numero_registro, nro_pedido_externo, quincena_arribo_id
    FROM pedido_proveedor
    WHERE nro_pedido_externo IS NOT NULL
      AND btrim(nro_pedido_externo) <> ''
    ORDER BY id`);
  console.table(auditoria.rows);
  console.log(`Limpieza confirmada: ${cambios.length} registro(s) actualizado(s).`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
