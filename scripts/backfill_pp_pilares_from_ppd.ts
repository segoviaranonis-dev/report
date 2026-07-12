/** Backfill pilares desde PPD ya importado (sin re-subir Excel). */
import fs from "fs";
import pg from "pg";
import { provisionPilaresFromProforma } from "../src/lib/pedido-proveedor/proforma-pilares-provision";
import { backfillPpdPilarFks } from "../src/lib/pedido-proveedor/ppd-pilares-fk";

async function main() {
  const ppIds = process.argv.slice(2).map(Number).filter(Number.isFinite);
  if (!ppIds.length) {
    console.error("Uso: npx tsx scripts/backfill_pp_pilares_from_ppd.ts <ppId> [...]");
    process.exit(1);
  }

  const url = fs
    .readFileSync("c:/Users/hecto/Nexus_Core/report/.env.local", "utf8")
    .match(/^DATABASE_URL=(.+)$/m)?.[1]
    ?.trim();

  const c = new pg.Client({ connectionString: url });
  await c.connect();

  for (const ppId of ppIds) {
    await c.query("BEGIN");
    try {
      const meta = await c.query<{ proveedor_importacion_id: number }>(
        `SELECT COALESCE(proveedor_importacion_id, 654)::int AS proveedor_importacion_id
         FROM pedido_proveedor WHERE id = $1`,
        [ppId],
      );
      const provId = meta.rows[0]?.proveedor_importacion_id ?? 654;

      const marcaRes = await c.query<{ id_marca: number; nom: string }>(
        "SELECT id_marca, UPPER(descp_marca) AS nom FROM marca_v2",
      );
      const marcaLookup = new Map<string, number>();
      for (const m of marcaRes.rows) {
        if (m.nom) marcaLookup.set(m.nom, m.id_marca);
      }

      const { rows } = await c.query(
        `SELECT DISTINCT ON (linea, referencia, material_code, color_code)
                linea AS linea_codigo_proveedor,
                referencia AS referencia_codigo_proveedor,
                material_code,
                color_code,
                descp_material AS material,
                descp_color AS color,
                COALESCE(grades_json->>'_brand', '') AS brand
         FROM pedido_proveedor_detalle
         WHERE pedido_proveedor_id = $1 AND linea IS NOT NULL AND TRIM(linea) <> ''
         ORDER BY linea, referencia, material_code, color_code`,
        [ppId],
      );

      const stats = await provisionPilaresFromProforma(c, provId, rows, marcaLookup);
      const fk = await backfillPpdPilarFks(c, ppId);
      await c.query("COMMIT");
      console.log(JSON.stringify({ ppId, stats, fk }, null, 2));
    } catch (e) {
      await c.query("ROLLBACK");
      console.error(JSON.stringify({ ppId, error: String(e) }));
    }
  }

  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
