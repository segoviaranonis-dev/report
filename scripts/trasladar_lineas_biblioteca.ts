/**
 * Traslada líneas entre casos en biblioteca BCL + sync PELE evento.
 * Uso: npx tsx scripts/trasladar_lineas_biblioteca.ts <bibId> <eventoId> <casoOrigen> <casoDestino> <cod1> [cod2...]
 * Ej: npx tsx scripts/trasladar_lineas_biblioteca.ts 8 45 BR-VZ-MD-ML-MKA-O CARTERAS 10118 10119
 */
import fs from "fs";
import pg from "pg";
import { persistirLineasCaso } from "../src/lib/motor-precios/biblioteca-editor";

const args = process.argv.slice(2);
const bibId = Number(args[0]);
const eventoId = Number(args[1]);
const casoOrigenNom = args[2];
const casoDestinoNom = args[3];
const codigos = args.slice(4).map((c) => String(Math.trunc(Number(c)))).filter(Boolean);

if (!bibId || !eventoId || !casoOrigenNom || !casoDestinoNom || !codigos.length) {
  console.error(
    "Uso: npx tsx scripts/trasladar_lineas_biblioteca.ts <bibId> <eventoId> <casoOrigen> <casoDestino> <cod...>",
  );
  process.exit(1);
}

const url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();

async function main() {
const pool = new pg.Pool({ connectionString: url });
const provId = 654;

const casos = await pool.query<{ id: number; nombre_caso: string }>(
  `SELECT id::int, nombre_caso FROM caso_precio_biblioteca
   WHERE biblioteca_id = $1 AND activo = true`,
  [bibId],
);
const origen = casos.rows.find((c) => c.nombre_caso === casoOrigenNom);
const destino = casos.rows.find((c) => c.nombre_caso === casoDestinoNom);
if (!origen || !destino) {
  console.error("Casos no encontrados:", casos.rows.map((c) => c.nombre_caso));
  process.exit(1);
}

const mapRes = await pool.query<{ caso_biblioteca_id: number; cod: string }>(
  `SELECT bcl.caso_biblioteca_id::int, l.codigo_proveedor::text AS cod
   FROM biblioteca_caso_linea bcl
   JOIN linea l ON l.id = bcl.linea_id
   WHERE bcl.biblioteca_id = $1`,
  [bibId],
);
const porCaso = new Map<number, string[]>();
for (const r of mapRes.rows) {
  const cod = String(Math.trunc(Number(r.cod)));
  const arr = porCaso.get(r.caso_biblioteca_id) ?? [];
  arr.push(cod);
  porCaso.set(r.caso_biblioteca_id, arr);
}

const origenLineas = (porCaso.get(origen.id) ?? []).filter((c) => !codigos.includes(c));
const destinoSet = new Set(porCaso.get(destino.id) ?? []);
for (const c of codigos) destinoSet.add(c);
const destinoLineas = [...destinoSet].sort((a, b) => Number(a) - Number(b));

console.log("Mover", codigos.join(", "), "de", casoOrigenNom, "→", casoDestinoNom);
console.log("Origen antes:", (porCaso.get(origen.id) ?? []).length, "→ después:", origenLineas.length);
console.log("Destino antes:", (porCaso.get(destino.id) ?? []).length, "→ después:", destinoLineas.length);

await persistirLineasCaso(pool, bibId, origen.id, provId, origenLineas);
await persistirLineasCaso(pool, bibId, destino.id, provId, destinoLineas);

// PELE evento — caso destino para líneas movidas
const pecDest = await pool.query<{ id: number }>(
  `SELECT id::int FROM precio_evento_caso WHERE evento_id = $1 AND nombre_caso = $2 LIMIT 1`,
  [eventoId, casoDestinoNom],
);
const pecOrigen = await pool.query<{ id: number }>(
  `SELECT id::int FROM precio_evento_caso WHERE evento_id = $1 AND nombre_caso = $2 LIMIT 1`,
  [eventoId, casoOrigenNom],
);
const casoPeleDest = pecDest.rows[0]?.id;
const casoPeleOrig = pecOrigen.rows[0]?.id;

if (casoPeleDest) {
  const codesInt = codigos.map((c) => parseInt(c, 10));
  await pool.query(
    `DELETE FROM precio_evento_linea_excepcion pele
     USING linea l
     WHERE pele.evento_id = $1 AND pele.linea_id = l.id
       AND l.proveedor_id = $2 AND l.codigo_proveedor = ANY($3::bigint[])`,
    [eventoId, provId, codesInt],
  );
  await pool.query(
    `INSERT INTO precio_evento_linea_excepcion (caso_id, linea_id, evento_id)
     SELECT $1, l.id, $2 FROM linea l
     WHERE l.proveedor_id = $3 AND l.codigo_proveedor = ANY($4::bigint[])
     ON CONFLICT DO NOTHING`,
    [casoPeleDest, eventoId, provId, codesInt],
  );
  console.log("PELE actualizado →", casoDestinoNom, "caso_id", casoPeleDest);
} else {
  console.warn("Sin PELE destino en evento", eventoId, "— aplicar biblioteca al evento manualmente");
}

// Verificar
const check = await pool.query(
  `SELECT l.codigo_proveedor::text AS cod, cpb.nombre_caso
   FROM linea l
   JOIN biblioteca_caso_linea bcl ON bcl.linea_id = l.id AND bcl.biblioteca_id = $1
   JOIN caso_precio_biblioteca cpb ON cpb.id = bcl.caso_biblioteca_id
   WHERE l.codigo_proveedor = ANY($2::bigint[])`,
  [bibId, codigos.map((c) => parseInt(c, 10))],
);
console.log("Verificación BCL:", check.rows);

await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
