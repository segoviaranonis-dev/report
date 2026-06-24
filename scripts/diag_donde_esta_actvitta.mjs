/**
 * ¿Dónde están los pares ACTVITTA 4202.500? — depósito vs bandeja vs staging legacy
 */
import fs from "fs";
import pg from "pg";

const CLIENTE = 2100;
const LINEA = "4202";
const REF = "500";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  const stock = await client.query(
    `
      SELECT d.grada, sum(d.cantidad)::float8 AS pares
      FROM deposito_1_2100_tienda d
      JOIN linea l ON l.id = d.linea_id
      JOIN referencia r ON r.id = d.referencia_id
      WHERE l.codigo_proveedor = $1 AND r.codigo_proveedor = $2
      GROUP BY d.grada
      ORDER BY d.grada
    `,
    [LINEA, REF],
  );
  const stockPos = await client.query(
    `
      SELECT coalesce(sum(d.cantidad),0)::float8 AS pares_vendibles
      FROM deposito_1_2100_tienda d
      JOIN linea l ON l.id = d.linea_id
      JOIN referencia r ON r.id = d.referencia_id
      WHERE l.codigo_proveedor = $1 AND r.codigo_proveedor = $2 AND d.cantidad > 0
    `,
    [LINEA, REF],
  );

  const bandeja = await client.query(
    `
      SELECT b.id, b.staging_id, b.estado, b.grada, b.cantidad, b.numero_fi_fa,
             b.cedula_cliente, b.snapshot_cliente, b.created_at
      FROM ticket_bandeja_cajero b
      JOIN linea l ON l.id = b.linea_id
      JOIN referencia r ON r.id = b.referencia_id
      WHERE b.cliente_id = $1
        AND l.codigo_proveedor = $2 AND r.codigo_proveedor = $3
        AND b.activo = true
      ORDER BY b.created_at DESC
    `,
    [CLIENTE, LINEA, REF],
  );

  const bandejaResumen = await client.query(
    `
      SELECT staging_id, estado, numero_fi_fa, count(*)::int AS filas,
             sum(cantidad)::int AS pares,
             max(snapshot_cliente->>'nombre') AS nombre,
             max(snapshot_cliente->>'apellido') AS apellido,
             max(cedula_cliente) AS cedula
      FROM ticket_bandeja_cajero
      WHERE cliente_id = $1 AND activo = true
      GROUP BY staging_id, estado, numero_fi_fa
      ORDER BY max(created_at) DESC
    `,
    [CLIENTE],
  );

  const stagingLegacy = await client.query(`
    SELECT st.id, st.codigo_staging, st.estado, st.cedula_cliente, st.snapshot_cliente,
           sl.grada, sl.cantidad, sl.activo
    FROM ticket_pos_staging st
    JOIN ticket_pos_staging_linea sl ON sl.staging_id = st.id
    JOIN linea l ON l.id = sl.linea_id
    JOIN referencia r ON r.id = sl.referencia_id
    WHERE st.cliente_id = $1
      AND l.codigo_proveedor = $2 AND r.codigo_proveedor = $3
      AND sl.activo = true AND sl.cantidad > 0
    ORDER BY st.created_at DESC
  `, [CLIENTE, LINEA, REF]);

  const stagingAll = await client.query(`
    SELECT id, codigo_staging, estado, cedula_cliente, snapshot_cliente, created_at
    FROM ticket_pos_staging
    WHERE cliente_id = $1 AND estado NOT IN ('CANCELADO')
    ORDER BY created_at DESC LIMIT 10
  `, [CLIENTE]);

  const actvittaStock = await client.query(`
    SELECT count(*) FILTER (WHERE d.cantidad > 0)::int AS skus,
           coalesce(sum(d.cantidad) FILTER (WHERE d.cantidad > 0), 0)::float8 AS pares
    FROM deposito_1_2100_tienda d
    JOIN linea l ON l.id = d.linea_id
    LEFT JOIN marca_v2 mv ON mv.id_marca = l.marca_id
    WHERE upper(trim(mv.descp_marca::text)) = 'ACTVITTA'
  `);

  const reservadoBandeja = await client.query(`
    SELECT coalesce(sum(cantidad),0)::int AS pares
    FROM ticket_bandeja_cajero
    WHERE cliente_id = $1 AND activo = true AND estado IN ('ABIERTO','PENDIENTE_CAJA','CSV_DESCARGADO')
  `, [CLIENTE]);

  console.log(JSON.stringify({
    actvitta_deposito_2100: actvittaStock.rows[0],
    sku_4202_500_por_grada: stock.rows,
    sku_4202_500_pares_vendibles: stockPos.rows[0]?.pares_vendibles,
    bandeja_filas_4202_500: bandeja.rows,
    bandeja_lotes_tienda: bandejaResumen.rows,
    staging_legacy_lineas_4202_500: stagingLegacy.rows,
    staging_legacy_cabeceras: stagingAll.rows,
    pares_reservados_bandeja_total: reservadoBandeja.rows[0]?.pares,
  }, null, 2));
} finally {
  await client.end();
}
