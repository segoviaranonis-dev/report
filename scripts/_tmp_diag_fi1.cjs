const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const dbUrl = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

(async () => {
  const st = await pool.query(
    `SELECT id, codigo_staging, estado, promovido_at, created_at FROM ticket_pos_staging WHERE id = 1`,
  );
  const oro = await pool.query(
    `SELECT codigo_ticket, estado, created_at, cedula_cliente, grada
     FROM ticket_venta_pos WHERE staging_id = 1 ORDER BY created_at`,
  );
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);
  const visible = oro.rows.filter((r) => {
    const e = String(r.estado).toUpperCase();
    return e === "EMITIDO" && new Date(r.created_at) >= todayUtc;
  });

  console.log(
    JSON.stringify(
      {
        staging: st.rows[0],
        oro_total: oro.rows.length,
        oro_rows: oro.rows,
        hoy_utc_desde: todayUtc.toISOString(),
        visible_bandeja_hoy: visible.length,
        causa_probable:
          visible.length === 0 && oro.rows.some((r) => String(r.estado).toUpperCase() === "EMITIDO")
            ? "Filtro solo EMITIDO de hoy (UTC) — ticket de ayer no aparece"
            : oro.rows.length === 0
              ? "Sin filas ORO — eliminado o cancelado"
              : "Revisar estado distinto de EMITIDO",
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
