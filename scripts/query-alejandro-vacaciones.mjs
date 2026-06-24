import fs from "fs";
import pg from "pg";

function loadEnv() {
  try {
    const raw = fs.readFileSync(".env.local", "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^DATABASE_URL=(.+)$/);
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* ignore */
  }
  return process.env.DATABASE_URL;
}

const url = loadEnv();
if (!url) {
  console.error("NO_DATABASE_URL");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
});

const CI = "5659702";

const resumen = await pool.query(
  `SELECT f.nombre_completo, f.ci, v.dias_tomados, v.horas_tomadas, v.horas_pendientes,
          v.dias_pendientes, v.horas_totales, v.tipo_vacacion
   FROM vacaciones v
   JOIN funcionarios f ON f.id_funcionario = v.funcionario_id
   WHERE f.ci = $1 AND v.anio = 2026 AND v.activo = true`,
  [CI]
);

const detalle = await pool.query(
  `SELECT vd.fecha_inicio, vd.horas_tomadas, vd.dias_tomados, vd.estado, vd.created_at
   FROM vacaciones_detalle vd
   JOIN vacaciones v ON v.id_vacacion = vd.vacacion_id
   JOIN funcionarios f ON f.id_funcionario = v.funcionario_id
   WHERE f.ci = $1 AND v.anio = 2026
   ORDER BY vd.created_at DESC`,
  [CI]
);

console.log(JSON.stringify({ resumen: resumen.rows[0] ?? null, detalle: detalle.rows }, null, 2));
await pool.end();
