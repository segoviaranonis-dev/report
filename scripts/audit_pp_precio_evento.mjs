/**
 * Auditoría: PP ↔ precio_evento (candado en_uso)
 * node scripts/audit_pp_precio_evento.mjs [pp_id]
 */
import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
const m = env.match(/^DATABASE_URL=(.+)$/m);
if (!m) {
  console.error("NO DATABASE_URL");
  process.exit(1);
}
const url = m[1].trim().replace(/^"|"$/g, "");
const ppFilter = process.argv[2] ? Number(process.argv[2]) : null;

const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
});

const client = await pool.connect();
try {
  const resumen = await client.query(`
    SELECT pe.estado, COUNT(*)::int AS n
    FROM precio_evento pe
    GROUP BY pe.estado
    ORDER BY n DESC
  `);
  console.log("\n=== precio_evento por estado ===");
  resumen.rows.forEach((r) => console.log(`  ${r.estado}: ${r.n}`));

  const borradores = await client.query(`
    SELECT pe.id, pe.nombre_evento, pe.estado,
           COALESCE(pl.n, 0)::int AS skus
    FROM precio_evento pe
    LEFT JOIN (SELECT evento_id, COUNT(*) n FROM precio_lista GROUP BY evento_id) pl ON pl.evento_id = pe.id
    WHERE pe.estado NOT IN ('cerrado', 'validado')
       OR COALESCE(pl.n, 0) = 0
    ORDER BY pe.created_at DESC
    LIMIT 60
  `);
  console.log(`\n=== Listados abiertos / sin SKUs (max 60) ===`);
  borradores.rows.forEach((r) =>
    console.log(`  #${r.id} · ${r.estado} · ${r.skus} SKUs · ${r.nombre_evento}`),
  );

  const ppSql = ppFilter
    ? `WHERE pp.id = $1`
    : "";
  const ppParams = ppFilter ? [ppFilter] : [];

  const pps = await client.query(
    `
    SELECT pp.id, pp.numero_registro, pp.estado AS pp_estado,
           icp.precio_evento_id,
           pe.nombre_evento, pe.estado AS evento_estado,
           COALESCE(pl.n, 0)::int AS skus
    FROM pedido_proveedor pp
    LEFT JOIN LATERAL (
      SELECT precio_evento_id
      FROM intencion_compra_pedido
      WHERE pedido_proveedor_id = pp.id AND precio_evento_id IS NOT NULL
      ORDER BY id DESC
      LIMIT 1
    ) icp ON true
    LEFT JOIN precio_evento pe ON pe.id = icp.precio_evento_id
    LEFT JOIN (SELECT evento_id, COUNT(*) n FROM precio_lista GROUP BY evento_id) pl ON pl.evento_id = pe.id
    ${ppSql}
    ORDER BY pp.id
    `,
    ppParams,
  );

  console.log(`\n=== PP ↔ precio_evento ${ppFilter ? `(PP #${ppFilter})` : "(todos)"} ===`);
  for (const r of pps.rows) {
    const candado = r.precio_evento_id ? "🔒 en_uso" : "🔓 sin listado";
    console.log(
      `  PP #${r.id} ${r.numero_registro ?? ""} [${r.pp_estado}] → evento #${r.precio_evento_id ?? "—"} ${r.nombre_evento ?? ""} (${r.evento_estado ?? "—"}, ${r.skus} SKUs) ${candado}`,
    );
  }

  const eventosEnUso = await client.query(`
    SELECT DISTINCT pe.id, pe.nombre_evento, pe.estado,
           array_agg(DISTINCT pp.numero_registro) FILTER (WHERE pp.numero_registro IS NOT NULL) AS pps,
           array_agg(DISTINCT ic.numero_registro) FILTER (WHERE ic.numero_registro IS NOT NULL) AS ics
    FROM precio_evento pe
    LEFT JOIN intencion_compra ic ON ic.precio_evento_id = pe.id
    LEFT JOIN intencion_compra_pedido icp ON icp.precio_evento_id = pe.id
    LEFT JOIN pedido_proveedor pp ON pp.id = icp.pedido_proveedor_id
    WHERE ic.precio_evento_id IS NOT NULL OR icp.precio_evento_id IS NOT NULL
    GROUP BY pe.id, pe.nombre_evento, pe.estado
    ORDER BY pe.id DESC
  `);
  console.log(`\n=== Eventos con candado (referenciados IC/PP) — ${eventosEnUso.rows.length} ===`);
  eventosEnUso.rows.forEach((r) => {
    console.log(
      `  #${r.id} · ${r.estado} · ${r.nombre_evento}\n    PP: ${(r.pps ?? []).join(", ") || "—"}\n    IC: ${(r.ics ?? []).join(", ") || "—"}`,
    );
  });
} finally {
  client.release();
  await pool.end();
}
