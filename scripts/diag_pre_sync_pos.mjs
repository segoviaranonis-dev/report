/**
 * Auditoría pre-sync: tablas transaccionales POS + paridad depósito vs retail.
 * Uso: node scripts/diag_pre_sync_pos.mjs [cliente_id]
 */
import fs from "fs";
import pg from "pg";

const CLIENTE = Number(process.argv[2] || 2100);
const TABLA = `deposito_1_${CLIENTE}_tienda`;

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) {
  console.error("DATABASE_URL no encontrada");
  process.exit(1);
}

const c = new pg.Client({ connectionString: url });
await c.connect();

try {
  const tx = await c.query(`
    SELECT
      (SELECT count(*)::int FROM ticket_bandeja_cajero) AS bandeja_total,
      (SELECT count(*)::int FROM ticket_bandeja_cajero WHERE activo = true) AS bandeja_activo,
      (SELECT count(DISTINCT staging_id)::int FROM ticket_bandeja_cajero
         WHERE estado = 'ABIERTO' AND activo = true AND staging_id IS NOT NULL) AS bandeja_abierto_lotes,
      (SELECT count(*)::int FROM ticket_bandeja_cajero WHERE estado = 'PENDIENTE_CAJA' AND activo = true) AS bandeja_pendiente_caja,
      (SELECT count(*)::int FROM bobeda_venta_pos) AS bobeda,
      (SELECT count(*)::int FROM ticket_venta_pos) AS ticket_venta_legacy,
      (SELECT count(*)::int FROM ticket_pos_staging) AS staging_hdr,
      (SELECT count(*)::int FROM ticket_pos_staging_linea) AS staging_linea,
      (SELECT count(*)::int FROM pos_fi_fa_counter) AS fi_fa_counters
  `);

  const deposito = await c.query(`
    SELECT count(*)::int AS filas,
           COALESCE(sum(cantidad), 0)::float8 AS pares,
           count(*) FILTER (WHERE cantidad > 0)::int AS skus_vendibles,
           COALESCE(sum(cantidad) FILTER (WHERE cantidad > 0), 0)::float8 AS pares_vendibles,
           count(*) FILTER (WHERE cantidad = 0)::int AS filas_cero
    FROM ${TABLA}
  `);

  const retail = await c.query(
    `
      SELECT count(*)::int AS filas,
             COALESCE(sum(r.cantidad), 0)::float8 AS pares
      FROM registro_st_vt_rc_reposicion r
      INNER JOIN tiendas_marcas tm ON tm.cliente_id = $1
        AND tm.marca_id = r.marca_id AND tm.activo = true
      WHERE r.cliente_id = $1 AND lower(btrim(r.tipo_movimiento)) = 'stock'
    `,
    [CLIENTE],
  );

  const syncPreview = await c.query(
    `
      SELECT
        (SELECT count(*)::int FROM ${TABLA}) AS borraria,
        (SELECT count(*)::int FROM registro_st_vt_rc_reposicion r
          INNER JOIN tiendas_marcas tm ON tm.cliente_id = $1
            AND tm.marca_id = r.marca_id AND tm.activo = true
          WHERE r.cliente_id = $1 AND lower(btrim(r.tipo_movimiento)) = 'stock') AS insertaria
    `,
    [CLIENTE],
  );

  const bloqueo = Number(tx.rows[0].bandeja_abierto_lotes) > 0;

  const txEmpty =
    tx.rows[0].bandeja_total === 0 &&
    tx.rows[0].bobeda === 0 &&
    tx.rows[0].ticket_venta_legacy === 0 &&
    tx.rows[0].staging_hdr === 0 &&
    tx.rows[0].staging_linea === 0 &&
    tx.rows[0].fi_fa_counters === 0;

  console.log(JSON.stringify({
    cliente_id: CLIENTE,
    tabla_deposito: TABLA,
    tablas_transaccionales: tx.rows[0],
    transaccionales_vacias: txEmpty,
    sync_bloqueado_por_abierto: bloqueo,
    deposito_actual: deposito.rows[0],
    retail_fuente_st: retail.rows[0],
    sync_preview: syncPreview.rows[0],
    paridad_pares: Number(deposito.rows[0].pares) === Number(retail.rows[0].pares),
    veredicto_sync:
      bloqueo
        ? "BLOQUEADO — hay facturas ABIERTAS en bandeja; cerrar/cancelar antes"
        : txEmpty
          ? Number(deposito.rows[0].pares) === Number(retail.rows[0].pares)
            ? "OK — transaccionales vacías; depósito ya coincide con retail (sync opcional)"
            : "LISTO — transaccionales vacías; sync restaurará depósito desde retail"
          : "PRECAUCIÓN — hay filas transaccionales; reset POS antes de sync si querés corte limpio",
    notas: [
      "Sync = DELETE total depósito + INSERT desde registro_st (no transacción única en código)",
      "Sync NO toca bandeja/bobeda/staging",
      "Sync NO bloquea por PENDIENTE_CAJA, solo ABIERTO",
      "Reset POS restaura stock desde bandeja activa antes de borrar transaccionales",
    ],
  }, null, 2));
} finally {
  await c.end();
}
