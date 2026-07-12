/**
 * Audita + backfill FK pilares (L·R·M·C) en todos los PP PROGRAMADO (categoria_id=3).
 * Uso: npx tsx scripts/repair_pp_programado_pilares_fk.ts [--audit-only] [ppId...]
 */
import fs from "fs";
import pg from "pg";
import { provisionPilaresFromProforma } from "../src/lib/pedido-proveedor/proforma-pilares-provision";
import { backfillPpdPilarFks } from "../src/lib/pedido-proveedor/ppd-pilares-fk";

const auditOnly = process.argv.includes("--audit-only");
const ppIdsArg = process.argv.slice(2).filter((a) => a !== "--audit-only").map(Number).filter(Number.isFinite);

async function audit(client: pg.PoolClient | pg.Pool) {
  const { rows } = await client.query(`
    SELECT pp.id, pp.numero_registro,
           COUNT(ppd.id)::int AS filas,
           COUNT(*) FILTER (WHERE ppd.linea_id IS NULL OR ppd.referencia_id IS NULL)::int AS sin_lr_fk,
           COUNT(*) FILTER (WHERE ppd.id_material IS NULL)::int AS sin_mat,
           COUNT(*) FILTER (WHERE ppd.linea_id IS NOT NULL AND ppd.referencia_id IS NOT NULL
                            AND ppd.id_material IS NOT NULL)::int AS mol_completa
    FROM pedido_proveedor pp
    JOIN pedido_proveedor_detalle ppd ON ppd.pedido_proveedor_id = pp.id
    WHERE pp.categoria_id = 3
      AND ppd.linea IS NOT NULL AND TRIM(ppd.linea) <> ''
    GROUP BY pp.id, pp.numero_registro
    ORDER BY sin_lr_fk DESC, pp.id
  `);
  return rows;
}

async function main() {
  const url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
  const pool = new pg.Pool({ connectionString: url });

  let ppIds = ppIdsArg;
  if (!ppIds.length) {
    const r = await pool.query<{ id: number }>(
      `SELECT DISTINCT pp.id::int AS id
       FROM pedido_proveedor pp
       JOIN pedido_proveedor_detalle ppd ON ppd.pedido_proveedor_id = pp.id
       WHERE pp.categoria_id = 3
       ORDER BY pp.id`,
    );
    ppIds = r.rows.map((x) => x.id);
  }

  console.log("=== AUDIT PRE ===");
  console.table(await audit(pool));

  if (auditOnly) {
    await pool.end();
    return;
  }

  for (const ppId of ppIds) {
    const gaps = await pool.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM pedido_proveedor_detalle
       WHERE pedido_proveedor_id = $1 AND (linea_id IS NULL OR referencia_id IS NULL)`,
      [ppId],
    );
    if ((gaps.rows[0]?.c ?? 0) === 0 && !process.argv.includes("--force")) {
      console.log(JSON.stringify({ ppId, skip: "FK ya completa (usá --force para refresh pilares)" }));
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const meta = await client.query<{ proveedor_importacion_id: number }>(
        `SELECT COALESCE(proveedor_importacion_id, 654)::int AS proveedor_importacion_id
         FROM pedido_proveedor WHERE id = $1`,
        [ppId],
      );
      const provId = meta.rows[0]?.proveedor_importacion_id ?? 654;

      const marcaRes = await client.query<{ id_marca: number; nom: string }>(
        "SELECT id_marca, UPPER(descp_marca) AS nom FROM marca_v2",
      );
      const marcaLookup = new Map<string, number>();
      for (const m of marcaRes.rows) if (m.nom) marcaLookup.set(m.nom, m.id_marca);

      const { rows } = await client.query(
        `SELECT DISTINCT ON (linea, referencia, material_code, color_code)
                linea AS linea_codigo_proveedor,
                referencia AS referencia_codigo_proveedor,
                material_code, color_code,
                descp_material AS material, descp_color AS color,
                COALESCE(grades_json->>'_brand', '') AS brand
         FROM pedido_proveedor_detalle
         WHERE pedido_proveedor_id = $1 AND linea IS NOT NULL AND TRIM(linea) <> ''
         ORDER BY linea, referencia, material_code, color_code`,
        [ppId],
      );

      const stats = await provisionPilaresFromProforma(client, provId, rows, marcaLookup);
      const fk = await backfillPpdPilarFks(client, ppId);
      await client.query("COMMIT");
      console.log(JSON.stringify({ ppId, stats, fk }));
    } catch (e) {
      await client.query("ROLLBACK");
      console.error(JSON.stringify({ ppId, error: String(e) }));
    } finally {
      client.release();
    }
  }

  console.log("\n=== AUDIT POST ===");
  console.table(await audit(pool));
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
