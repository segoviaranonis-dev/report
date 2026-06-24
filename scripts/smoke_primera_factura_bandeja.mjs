/**
 * Smoke: primera factura interna en bandeja única (sin UI).
 * Verifica IDs numéricos, FI_FA:1, visible en cola caja.
 */
import fs from "fs";
import pg from "pg";

const CLIENTE = 2100;
const MARCA = "ACTVITTA";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const client = new pg.Client({ connectionString: url });
await client.connect();

function fail(msg) {
  console.error("SMOKE_FAIL", msg);
  process.exit(1);
}

try {
  // Limpieza previa
  await client.query(`DELETE FROM ticket_bandeja_cajero`);
  await client.query(`DELETE FROM pos_fi_fa_counter`);
  await client.query(`ALTER SEQUENCE ticket_bandeja_lote_id_seq RESTART WITH 1`);
  await client.query(`ALTER SEQUENCE ticket_bandeja_cajero_id_seq RESTART WITH 1`);

  const vend = await client.query(
    `SELECT id_vendedor, nombre_display FROM vendedor_bazzar WHERE cliente_id = $1 AND activo = true LIMIT 1`,
    [CLIENTE],
  );
  if (!vend.rows[0]) fail("Sin vendedor_bazzar en 2100");
  const vendedorId = Number(vend.rows[0].id_vendedor);

  const stock = await client.query(
    `
      SELECT d.linea_id, d.referencia_id, d.material_id, d.color_id, d.grada, d.cantidad,
             l.codigo_proveedor AS lc, r.codigo_proveedor AS rc
      FROM deposito_1_2100_tienda d
      JOIN linea l ON l.id = d.linea_id
      JOIN referencia r ON r.id = d.referencia_id
      WHERE l.codigo_proveedor = '4202' AND r.codigo_proveedor = '500'
        AND d.cantidad >= 1
      ORDER BY d.grada
      LIMIT 1
    `,
  );
  if (!stock.rows[0]) fail("Sin stock 4202.500 en depósito 2100 — el catálogo tampoco lo mostrará");
  const s = stock.rows[0];

  await client.query("BEGIN");

  const loteR = await client.query(`SELECT nextval('ticket_bandeja_lote_id_seq') AS id`);
  const loteId = Number(loteR.rows[0].id);

  const fiFaR = await client.query(
    `
      INSERT INTO pos_fi_fa_counter (cliente_id, last_num) VALUES ($1, 1)
      ON CONFLICT (cliente_id) DO UPDATE SET last_num = pos_fi_fa_counter.last_num + 1
      RETURNING last_num
    `,
    [CLIENTE],
  );
  const fiFa = Number(fiFaR.rows[0].last_num);

  const snap = JSON.stringify({
    linea_codigo: s.lc,
    referencia_codigo: s.rc,
    imagen_url: null,
  });
  const snapCli = JSON.stringify({ nombre: "Prueba", apellido: "Smoke", cedula: "1234567" });

  await client.query(
    `
      UPDATE deposito_1_2100_tienda SET cantidad = cantidad - 1
      WHERE linea_id = $1 AND referencia_id = $2 AND material_id = $3 AND color_id = $4
        AND btrim(grada::text) = $5 AND cantidad >= 1
    `,
    [s.linea_id, s.referencia_id, s.material_id, s.color_id, String(s.grada).trim()],
  );

  await client.query(
    `
      INSERT INTO ticket_bandeja_cajero (
        codigo_bandeja, cliente_id, marca, vendedor_nombre, vendedor_bazzar_id, staging_id,
        cedula_cliente, linea_id, referencia_id, material_id, color_id, grada, cantidad,
        estado, snapshot_json, snapshot_cliente, numero_fi_fa, activo
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,1,'PENDIENTE_CAJA',$13::jsonb,$14::jsonb,$15,true)
    `,
    [
      `POS-${CLIENTE}-${loteId}-SMOKE-1`,
      CLIENTE,
      MARCA,
      vend.rows[0].nombre_display,
      vendedorId,
      loteId,
      "1234567",
      s.linea_id,
      s.referencia_id,
      s.material_id,
      s.color_id,
      s.grada,
      snap,
      snapCli,
      fiFa,
    ],
  );

  await client.query("COMMIT");

  const check = await client.query(`
    SELECT staging_id, numero_fi_fa, estado, cliente_id, marca
    FROM ticket_bandeja_cajero
    WHERE staging_id = $1
  `, [loteId]);

  const row = check.rows[0];
  if (!row) fail("Fila no insertada");
  if (Number(row.staging_id) !== 1) fail(`lote esperado 1, got ${row.staging_id}`);
  if (Number(row.numero_fi_fa) !== 1) fail(`FI_FA esperado 1, got ${row.numero_fi_fa}`);
  if (row.estado !== "PENDIENTE_CAJA") fail(`estado esperado PENDIENTE_CAJA, got ${row.estado}`);
  if (Number(row.cliente_id) !== CLIENTE) fail("cliente_id incorrecto");

  const caja = await client.query(`
    SELECT count(*)::int AS n FROM ticket_bandeja_cajero
    WHERE cliente_id = $1 AND estado = 'PENDIENTE_CAJA' AND activo = true
  `, [CLIENTE]);

  console.log("SMOKE_OK", {
    lote_id: Number(row.staging_id),
    fi_fa: Number(row.numero_fi_fa),
    display: `Prueba Smoke - FI_FA: ${row.numero_fi_fa}`,
    sku: `${s.lc}.${s.rc} G.${s.grada}`,
    filas_caja_2100: caja.rows[0].n,
    stock_catalogo_4202: "OK (había stock antes del smoke — restaurá con sync retail si hace falta)",
  });

  // Rollback venta smoke para dejar BD limpia de nuevo
  await client.query(`DELETE FROM ticket_bandeja_cajero WHERE staging_id = $1`, [loteId]);
  await client.query(`DELETE FROM pos_fi_fa_counter WHERE cliente_id = $1`, [CLIENTE]);
  await client.query(`ALTER SEQUENCE ticket_bandeja_lote_id_seq RESTART WITH 1`);
  console.log("SMOKE_CLEANED — BD lista para primera venta real (FI_FA: 1, lote: 1)");
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  fail(e instanceof Error ? e.message : String(e));
} finally {
  await client.end();
}
