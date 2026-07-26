/** Qué eventos motor cubren los SKUs (L+R) del PP. */
import fs from "fs";
import pg from "pg";

const url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const pool = new pg.Pool({ connectionString: url });
const ppId = Number(process.argv[2] ?? 38);

const { rows: skus } = await pool.query(
  `SELECT DISTINCT ppd.linea, ppd.referencia
   FROM factura_interna_detalle fid
   JOIN factura_interna fi ON fi.id = fid.factura_id
   JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
   WHERE fi.pp_id = $1`,
  [ppId],
);
console.log(`PP-${ppId}: ${skus.length} moléculas L+R únicas en FI\n`);

const { rows: evs } = await pool.query(
  `SELECT pe.id, pe.nombre_evento, COUNT(pl.id)::int AS n_precios
   FROM precio_evento pe
   JOIN precio_lista pl ON pl.evento_id = pe.id
   GROUP BY pe.id, pe.nombre_evento
   HAVING COUNT(pl.id) > 50
   ORDER BY pe.id DESC
   LIMIT 50`,
);

const results = [];
for (const ev of evs) {
  let hit = 0;
  for (const s of skus) {
    const r = await pool.query(
      `SELECT 1 FROM precio_lista
       WHERE evento_id = $1 AND TRIM(linea_codigo) = TRIM($2) AND TRIM(referencia_codigo) = TRIM($3)
       LIMIT 1`,
      [ev.id, s.linea, s.referencia],
    );
    if (r.rowCount) hit++;
  }
  if (hit > 0) {
    results.push({
      id: ev.id,
      nombre: ev.nombre_evento,
      hit,
      pct: Math.round((hit / skus.length) * 100),
      n: ev.n_precios,
    });
  }
}
results.sort((a, b) => b.hit - a.hit);

console.log("Eventos con al menos 1 match:");
for (const r of results.slice(0, 20)) {
  console.log(`  #${r.id} · ${r.hit}/${skus.length} (${r.pct}%) · ${r.n} SKUs listado · ${r.nombre}`);
}

const probar = [27, 28, 29, 30, 45, 47, 56];
console.log("\nComparativa listados que probaste:");
for (const id of probar) {
  const r = results.find((x) => Number(x.id) === id);
  console.log(`  #${id}: ${r ? `${r.hit}/${skus.length} (${r.pct}%)` : "0% — NO contiene moléculas del PP"}`);
}

await pool.end();
