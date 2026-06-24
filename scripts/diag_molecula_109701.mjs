/**
 * Rastreo molécula 4202.500 · mat 24892 · color 109701 (109701 NAPA PER...)
 */
import fs from "fs";
import pg from "pg";

const CLIENTE = 2100;
const LINEA = "4202";
const REF = "500";
const MAT = "24892";
const COL = "109701";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const c = new pg.Client({ connectionString: url });
await c.connect();

try {
  const ids = await c.query(
    `
      SELECT l.id AS linea_id, r.id AS referencia_id, m.id AS material_id, col.id AS color_id,
             l.codigo_proveedor AS lc, r.codigo_proveedor AS rc,
             m.codigo_proveedor AS mc, col.codigo_proveedor AS cc
      FROM linea l
      JOIN referencia r ON r.linea_id = l.id AND r.codigo_proveedor = $2
      JOIN material m ON m.codigo_proveedor = $3
      JOIN color col ON col.codigo_proveedor = $4
      WHERE l.codigo_proveedor = $1
      LIMIT 1
    `,
    [LINEA, REF, MAT, COL],
  );
  const id = ids.rows[0];
  if (!id) {
    console.log("MOLECULA_NO_ENCONTRADA en pilares");
    process.exit(0);
  }

  const deposito = await c.query(
    `
      SELECT grada, cantidad, id
      FROM deposito_1_2100_tienda
      WHERE linea_id = $1 AND referencia_id = $2 AND material_id = $3 AND color_id = $4
      ORDER BY grada
    `,
    [id.linea_id, id.referencia_id, id.material_id, id.color_id],
  );

  const bandeja = await c.query(
    `
      SELECT b.id, b.staging_id, b.estado, b.grada, b.cantidad, b.activo, b.numero_fi_fa,
             b.cedula_cliente, b.snapshot_cliente, b.created_at
      FROM ticket_bandeja_cajero b
      WHERE b.cliente_id = $1
        AND b.linea_id = $2 AND b.referencia_id = $3
        AND b.material_id = $4 AND b.color_id = $5
      ORDER BY b.created_at DESC
    `,
    [CLIENTE, id.linea_id, id.referencia_id, id.material_id, id.color_id],
  );

  const bobeda = await c.query(
    `
      SELECT codigo_oro, estado, grada, cantidad, created_at, numero_fi_fa
      FROM bobeda_venta_pos
      WHERE cliente_id = $1
        AND linea_id = $2 AND referencia_id = $3
        AND material_id = $4 AND color_id = $5
      ORDER BY created_at DESC LIMIT 10
    `,
    [CLIENTE, id.linea_id, id.referencia_id, id.material_id, id.color_id],
  );

  const stagingLegacy = await c.query(
    `
      SELECT st.codigo_staging, st.estado, sl.grada, sl.cantidad, sl.activo
      FROM ticket_pos_staging_linea sl
      JOIN ticket_pos_staging st ON st.id = sl.staging_id
      WHERE st.cliente_id = $1
        AND sl.linea_id = $2 AND sl.referencia_id = $3
        AND sl.material_id = $4 AND sl.color_id = $5
    `,
    [CLIENTE, id.linea_id, id.referencia_id, id.material_id, id.color_id],
  );

  const depositoCodigos = await c.query(
    `
      SELECT linea_codigo_proveedor, referencia_codigo_proveedor,
             excel_material_code, excel_color_code, grada, cantidad, id
      FROM deposito_1_2100_tienda
      WHERE linea_codigo_proveedor = $1
        AND referencia_codigo_proveedor = $2
        AND (excel_material_code::text = $3 OR material_id = $4)
        AND (excel_color_code::text = $5 OR color_id = $6)
      ORDER BY grada
    `,
    [LINEA, REF, MAT, id.material_id, COL, id.color_id],
  );

  const retail = await c.query(
    `
      SELECT grada, sum(cantidad)::float8 AS pares, count(*)::int AS filas
      FROM registro_st_vt_rc_reposicion
      WHERE cliente_id = $1 AND lower(btrim(tipo_movimiento)) = 'stock'
        AND linea_codigo_proveedor::text = $2
        AND referencia_codigo_proveedor::text = $3
        AND excel_material_code::text = $4
        AND excel_color_code::text = $5
      GROUP BY grada ORDER BY grada
    `,
    [CLIENTE, LINEA, REF, MAT, COL],
  );

  const totalPar = deposito.rows.reduce((s, r) => s + Number(r.cantidad), 0);
  const totalParCodigos = depositoCodigos.rows.reduce((s, r) => s + Number(r.cantidad), 0);

  const filasIds = await c.query(
    `SELECT id, linea_id, referencia_id, material_id, color_id, grada, cantidad
     FROM deposito_1_2100_tienda WHERE id IN (290900, 290901)`,
  );

  console.log(JSON.stringify({
    pilares: id,
    deposito_2100_filas: deposito.rows,
    deposito_por_codigos_excel: depositoCodigos.rows,
    deposito_total_pares: totalPar,
    deposito_total_pares_codigos: totalParCodigos,
    retail_fuente_st: retail.rows,
    vendible: deposito.rows.filter((r) => Number(r.cantidad) > 0),
    deposito_fk_check: filasIds.rows,
    bandeja_historial: bandeja.rows,
    bobeda_historial: bobeda.rows,
    staging_legacy: stagingLegacy.rows,
    veredicto:
      bandeja.rows.length > 0
        ? "EN_BANDEJA — revisar estado POS"
        : bobeda.rows.length > 0
          ? "EN_BOBEDA_ORO — ya facturado/empaque"
          : totalPar <= 0 && totalParCodigos <= 0 && retail.rows.some((r) => Number(r.pares) > 0)
            ? "CONSUMIDO_EN_PRUEBAS — deposito en 0 pero retail tiene stock; sync deposito restaura pares"
            : totalPar <= 0 && totalParCodigos <= 0
              ? "STOCK_CERO — sin stock en deposito ni retail"
              : "STOCK_OK",
  }, null, 2));
} finally {
  await c.end();
}
