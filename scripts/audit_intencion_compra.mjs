/**
 * Rastreo completo IC — desde la primera hasta la actual.
 * Uso: node scripts/audit_intencion_compra.mjs
 */
import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");
const env = fs.readFileSync(envPath, "utf8");
const m = env.match(/^DATABASE_URL=(.+)$/m);
if (!m) {
  console.error("NO DATABASE_URL");
  process.exit(1);
}
const url = m[1].trim().replace(/^"|"$/g, "");
const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
});

const UBICACION = {
  PENDIENTE_OPERATIVO: "Bandeja IC · PENDIENTES (editable)",
  AUTORIZADO: "Historial IC · lista Digitación PENDIENTES",
  DIGITADO: "Digitación EN PROCESO o PP vinculado",
  DEVUELTO_ADMIN: "Bandeja IC · DEVUELTAS",
  ANULADO: "Historial IC · ANULADO (fin)",
};

const SQL = `
SELECT
  ic.id,
  ic.numero_registro,
  ic.estado,
  ic.fecha_registro,
  ic.fecha_llegada,
  ic.cantidad_total_pares AS pares,
  ic.monto_neto,
  pi.nombre AS proveedor,
  mv.descp_marca AS marca,
  cv.descp_cliente AS cliente,
  COALESCE(tv.descp_tipo, '—') AS tipo,
  COALESCE(cat.descp_categoria, '—') AS categoria,
  pe.nombre_evento AS evento_precio,
  icp.id AS puente_id,
      icp.nro_pedido_fabrica,
  pp.id AS pp_id,
  pp.numero_registro AS pp_nro,
  pp.estado AS pp_estado
FROM intencion_compra ic
JOIN proveedor_importacion pi ON pi.id = ic.id_proveedor
JOIN marca_v2 mv ON mv.id_marca = ic.id_marca
JOIN cliente_v2 cv ON cv.id_cliente = ic.id_cliente
LEFT JOIN tipo_v2 tv ON tv.id_tipo = ic.tipo_id
LEFT JOIN categoria_v2 cat ON cat.id_categoria = ic.categoria_id
LEFT JOIN precio_evento pe ON pe.id = ic.precio_evento_id
LEFT JOIN intencion_compra_pedido icp ON icp.intencion_compra_id = ic.id
LEFT JOIN pedido_proveedor pp ON pp.id = icp.pedido_proveedor_id
ORDER BY ic.id ASC
`;

const { rows } = await pool.query(SQL);

const { rows: stats } = await pool.query(`
  SELECT estado, COUNT(*)::int AS cnt
  FROM intencion_compra
  GROUP BY estado
  ORDER BY cnt DESC
`);

const { rows: maxRow } = await pool.query(`
  SELECT
    COUNT(*)::int AS total,
    MIN(id)::int AS min_id,
    MAX(id)::int AS max_id,
    MIN(numero_registro) AS min_nro,
    MAX(numero_registro) AS max_nro
  FROM intencion_compra
`);

console.log("=== RESUMEN intencion_compra ===");
console.log(JSON.stringify(maxRow[0], null, 2));
console.log("\nPor estado:");
for (const s of stats) console.log(`  ${s.estado}: ${s.cnt}`);

/** Detectar huecos en secuencia id */
const ids = rows.map((r) => Number(r.id));
const missingIds = [];
for (let i = ids[0]; i <= ids[ids.length - 1]; i++) {
  if (!ids.includes(i)) missingIds.push(i);
}

console.log(`\nTotal filas (con joins PP pueden duplicar IC): ${rows.length}`);
console.log(`ICs únicas por id: ${ids.length}`);
if (missingIds.length) console.log(`IDs faltantes en rango: ${missingIds.join(", ")}`);
else console.log("Secuencia id continua (sin huecos en PK).");

console.log("\n=== RASTREO IC (id → ubicación operativa) ===\n");

const seen = new Set();
for (const r of rows) {
  if (seen.has(r.id)) continue;
  seen.add(r.id);

  let ubicacion = UBICACION[r.estado] ?? r.estado;
  if (r.estado === "AUTORIZADO") ubicacion = UBICACION.AUTORIZADO;
  if (r.estado === "DIGITADO" && r.pp_id) {
    ubicacion = `PP ${r.pp_nro} (${r.pp_estado}) · nro fábrica ${r.nro_pedido_fabrica ?? "—"}`;
  } else if (r.estado === "DIGITADO" && !r.pp_id) {
    ubicacion = "DIGITADO sin fila intencion_compra_pedido (revisar)";
  }

  console.log(
    [
      `#${r.id}`,
      r.numero_registro,
      r.estado.padEnd(20),
      ubicacion,
      `| ${r.marca} · ${r.cliente} · ${r.pares ?? 0} pares`,
      r.evento_precio ? `| evt: ${r.evento_precio}` : "",
    ]
      .filter(Boolean)
      .join(" "),
  );
}

/** Secuencia numero_registro por año */
const byYear = {};
for (const r of rows) {
  if (seen.has(r.id) === false) continue;
}
for (const r of [...new Map(rows.map((x) => [x.id, x])).values()]) {
  const parts = String(r.numero_registro).match(/^IC-(\d{4})-(\d+)$/);
  if (!parts) continue;
  const y = parts[1];
  const seq = Number(parts[2]);
  if (!byYear[y]) byYear[y] = [];
  byYear[y].push(seq);
}

console.log("\n=== Secuencia numero_registro por año ===");
for (const [y, seqs] of Object.entries(byYear).sort()) {
  seqs.sort((a, b) => a - b);
  const gaps = [];
  for (let i = 1; i <= seqs[seqs.length - 1]; i++) {
    if (!seqs.includes(i)) gaps.push(i);
  }
  console.log(
    `  ${y}: ${seqs.length} ICs · rango IC-${y}-${String(seqs[0]).padStart(4, "0")} … IC-${y}-${String(seqs[seqs.length - 1]).padStart(4, "0")}` +
      (gaps.length ? ` · huecos: ${gaps.map((g) => String(g).padStart(4, "0")).join(", ")}` : " · sin huecos"),
  );
}

const outPath = path.join(__dirname, "..", "docs", "evidencia", "AUDIT_IC_RASTREO.json");
fs.writeFileSync(
  outPath,
  JSON.stringify(
    {
      generado: new Date().toISOString(),
      resumen: maxRow[0],
      por_estado: stats,
      ids_faltantes: missingIds,
      ics: [...new Map(rows.map((x) => [x.id, x])).values()].map((r) => ({
        id: r.id,
        numero_registro: r.numero_registro,
        estado: r.estado,
        ubicacion:
          r.estado === "DIGITADO" && r.pp_id
            ? `PP ${r.pp_nro} (${r.pp_estado})`
            : UBICACION[r.estado] ?? r.estado,
        marca: r.marca,
        cliente: r.cliente,
        pares: r.pares,
        pp_id: r.pp_id,
        pp_nro: r.pp_nro,
        pp_estado: r.pp_estado,
        evento_precio: r.evento_precio,
        fecha_registro: r.fecha_registro,
      })),
    },
    null,
    2,
  ),
);
console.log(`\nJSON: ${outPath}`);

await pool.end();
