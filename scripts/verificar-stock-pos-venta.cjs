/**
 * Verifica que el descuento de stock ocurre en staging (venta tablet), no en ORO.
 * Uso: node scripts/verificar-stock-pos-venta.cjs [staging_id]
 */
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env.local");
const dbUrl = fs.readFileSync(envPath, "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const stagingId = Number(process.argv[2] || 1);

const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

(async () => {
  const st = await pool.query(
    `SELECT id, codigo_staging, cliente_id, estado, promovido_at, created_at FROM ticket_pos_staging WHERE id=$1`,
    [stagingId],
  );
  const lines = await pool.query(
    `SELECT linea_id, referencia_id, material_id, color_id, grada, cantidad, snapshot_json
     FROM ticket_pos_staging_linea WHERE staging_id=$1 AND activo=true`,
    [stagingId],
  );
  const oro = await pool.query(
    `SELECT COUNT(*)::int AS n FROM ticket_venta_pos WHERE staging_id=$1`,
    [stagingId],
  );

  const tabla = `deposito_1_${st.rows[0]?.cliente_id ?? 2100}_tienda`;
  const stockChecks = [];
  for (const l of lines.rows) {
    const q = await pool.query(
      `SELECT COALESCE(SUM(cantidad),0)::int AS cant FROM public.${tabla}
       WHERE linea_id=$1 AND referencia_id=$2 AND material_id=$3 AND color_id=$4 AND grada::text=$5`,
      [l.linea_id, l.referencia_id, l.material_id, l.color_id, l.grada],
    );
    stockChecks.push({
      grada: l.grada,
      vendido: l.cantidad,
      stock_actual_deposito: q.rows[0]?.cant ?? 0,
      imagen_en_staging: Boolean(l.snapshot_json?.imagen_url),
    });
  }

  console.log(
    JSON.stringify(
      {
        staging: st.rows[0],
        lineas_staging: lines.rows.length,
        tickets_oro: oro.rows[0]?.n,
        regla: "stock baja en crearStagingDesdeCarrito (CERRAR); promoverStagingAOro NO decrementa",
        stock_deposito_por_linea: stockChecks,
      },
      null,
      2,
    ),
  );
  await pool.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
