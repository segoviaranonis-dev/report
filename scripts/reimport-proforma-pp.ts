/**
 * CLI — borrar + reimportar proforma programado (solo PPD, sin FI automática).
 * Uso: npx tsx scripts/reimport-proforma-pp.ts <ppId> <ruta.xlsx> [numero_proforma]
 */
import fs from "node:fs";
import path from "node:path";

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

import { getRimecPool } from "../src/lib/rimec/pool";
import { borrarImportacionPp } from "../src/lib/pedido-proveedor/borrar-import";
import {
  importProformaProgramadoTs,
  previewImportProformaProgramadoTs,
} from "../src/lib/pedido-proveedor/proforma-programado-engine";

async function main() {
  const ppId = Number(process.argv[2]);
  const filePath = process.argv[3];
  const proforma = process.argv[4] ?? "8051/2026";

  if (!Number.isFinite(ppId) || !filePath) {
    console.error("Uso: npx tsx scripts/reimport-proforma-pp.ts <ppId> <ruta.xlsx> [proforma]");
    process.exit(1);
  }

  const buffer = fs.readFileSync(filePath);
  process.env.PP_PROFORMA_USE_TS = "1";

  console.log(`\n=== Preview PP-${ppId} ===`);
  const preview = await previewImportProformaProgramadoTs(ppId, buffer);
  console.log("ok:", preview.ok);
  console.log("total_pares:", preview.total_pares);
  console.log("grupos:", preview.emparejamientos?.length ?? 0);
  if (preview.errores?.length) {
    console.log("errores:", preview.errores.slice(0, 15));
    if (preview.errores.length > 15) console.log(`… +${preview.errores.length - 15} más`);
  }
  if (!preview.ok) {
    process.exit(2);
  }

  const pool = getRimecPool();
  console.log("\n=== Borrar importación previa ===");
  const del = await borrarImportacionPp(pool, ppId);
  if (!del.ok) {
    console.error("Borrado falló:", del.error);
    process.exit(3);
  }
  console.log(del.message);

  console.log("\n=== Import PPD (sin FI) ===");
  const result = await importProformaProgramadoTs(ppId, buffer, proforma, { phase: "ppd" });
  console.log(JSON.stringify(result, null, 2));

  // Verificar shop 286 en PPD
  const { rows } = await pool.query<{ marca: string; pares: string; n: string }>(
    `SELECT UPPER(TRIM(mv.descp_marca)) AS marca,
            SUM(ppd.cantidad_pares)::int AS pares,
            COUNT(*)::int AS n
     FROM pedido_proveedor_detalle ppd
     LEFT JOIN marca_v2 mv ON mv.id_marca = ppd.id_marca
     WHERE ppd.pedido_proveedor_id = $1
       AND COALESCE(NULLIF(TRIM(ppd.grades_json->>'_shop'), ''), '') = '286'
     GROUP BY 1 ORDER BY 1`,
    [ppId],
  );
  console.log("\n=== PPD shop 286 post-import ===");
  for (const r of rows) console.log(`  ${r.marca}: ${r.pares} pares (${r.n} filas)`);
  if (!rows.length) console.log("  (sin filas)");

  process.exit(result.ok ? 0 : 4);
}

main().catch((e) => {
  console.error(e);
  process.exit(99);
});
