/**
 * Reparación retroactiva PP PROGRAMADO con stock:
 * 1. provisionPilaresFromProforma (idempotente)
 * 2. backfillPpdPilarFks + id_marca desde linea
 * 3. _shop: snapshot → infer IC+PPD si falta snapshot
 *
 * Uso: npx tsx scripts/repair_programado_retroactivo.ts [--dry-run] [ppId...]
 */
import fs from "fs";
import pg from "pg";
import { provisionPilaresFromProforma } from "../src/lib/pedido-proveedor/proforma-pilares-provision";
import { backfillPpdPilarFks } from "../src/lib/pedido-proveedor/ppd-pilares-fk";
import {
  backfillPpdShopFromSnapshot,
  inferAndPersistProformaFromPpd,
  loadProformaFilas,
} from "../src/lib/pedido-proveedor/proforma-snapshot";

const dryRun = process.argv.includes("--dry-run");
const ppIdsArg = process.argv
  .slice(2)
  .filter((a) => a !== "--dry-run")
  .map(Number)
  .filter(Number.isFinite);

async function countShopZero(client: pg.PoolClient, ppId: number): Promise<number> {
  const { rows } = await client.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM pedido_proveedor_detalle
     WHERE pedido_proveedor_id = $1
       AND COALESCE(NULLIF(TRIM(grades_json->>'_shop'), ''), '0') = '0'`,
    [ppId],
  );
  return rows[0]?.c ?? 0;
}

async function main() {
  const url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
  if (!url) throw new Error("DATABASE_URL missing");
  const pool = new pg.Pool({ connectionString: url });

  let ppIds = ppIdsArg;
  if (!ppIds.length) {
    const r = await pool.query<{ id: number }>(
      `SELECT pp.id::int AS id
       FROM pedido_proveedor pp
       WHERE pp.categoria_id = 3
         AND EXISTS (SELECT 1 FROM pedido_proveedor_detalle d WHERE d.pedido_proveedor_id = pp.id)
       ORDER BY pp.id`,
    );
    ppIds = r.rows.map((x) => x.id);
  }

  console.log(dryRun ? "=== DRY RUN ===" : "=== REPARACIÓN RETROACTIVA ===");
  console.log("PPs:", ppIds.join(", "));

  const report: unknown[] = [];

  for (const ppId of ppIds) {
    const client = await pool.connect();
    const shopAntes = await countShopZero(client, ppId);
    try {
      if (dryRun) {
        const snap = await loadProformaFilas(client, ppId);
        report.push({
          ppId,
          shop_cero_antes: shopAntes,
          tiene_snapshot: Boolean(snap?.length),
          accion: shopAntes > 0 ? (snap?.length ? "backfill_shop" : "infer_shop") : "pilares_only",
        });
        continue;
      }

      await client.query("BEGIN");

      const meta = await client.query<{ proveedor_importacion_id: number; numero_registro: string }>(
        `SELECT COALESCE(proveedor_importacion_id, 654)::int AS proveedor_importacion_id, numero_registro
         FROM pedido_proveedor WHERE id = $1`,
        [ppId],
      );
      const provId = meta.rows[0]?.proveedor_importacion_id ?? 654;
      const nro = meta.rows[0]?.numero_registro ?? `PP-${ppId}`;

      const marcaRes = await client.query<{ id_marca: number; nom: string }>(
        "SELECT id_marca, UPPER(descp_marca) AS nom FROM marca_v2",
      );
      const marcaLookup = new Map<string, number>();
      for (const m of marcaRes.rows) if (m.nom) marcaLookup.set(m.nom, m.id_marca);

      const { rows: molRows } = await client.query(
        `SELECT DISTINCT ON (linea, referencia, material_code, color_code)
                linea AS linea_codigo_proveedor,
                referencia AS referencia_codigo_proveedor,
                material_code, color_code,
                descp_material AS material,
                descp_color AS color,
                COALESCE(grades_json->>'_brand', '') AS brand
         FROM pedido_proveedor_detalle
         WHERE pedido_proveedor_id = $1 AND linea IS NOT NULL AND TRIM(linea) <> ''
         ORDER BY linea, referencia, material_code, color_code`,
        [ppId],
      );

      const pilaresStats = await provisionPilaresFromProforma(client, provId, molRows, marcaLookup);
      const fk = await backfillPpdPilarFks(client, ppId);

      const marUpd = await client.query(
        `UPDATE pedido_proveedor_detalle ppd
         SET id_marca = COALESCE(l.marca_id, ppd.id_marca)
         FROM linea l
         WHERE ppd.pedido_proveedor_id = $1
           AND ppd.linea_id = l.id
           AND l.marca_id IS NOT NULL`,
        [ppId],
      );

      let shopAccion = "ninguna";
      let shopBackfill = 0;
      const snap = await loadProformaFilas(client, ppId);
      if (shopAntes > 0) {
        if (snap?.length) {
          shopBackfill = await backfillPpdShopFromSnapshot(client, ppId);
          shopAccion = "backfill_snapshot";
        } else {
          const inferred = await inferAndPersistProformaFromPpd(client, ppId);
          shopBackfill = inferred?.n_backfill ?? 0;
          shopAccion = inferred ? "infer_ic_ppd" : "infer_falló";
        }
      }

      await client.query("COMMIT");

      const shopDespues = await countShopZero(client, ppId);
      const row = {
        ppId,
        nro,
        pilaresStats,
        fk,
        marca_rows: marUpd.rowCount ?? 0,
        shop_accion: shopAccion,
        shop_backfill: shopBackfill,
        shop_cero_antes: shopAntes,
        shop_cero_despues: shopDespues,
      };
      report.push(row);
      console.log(JSON.stringify(row));
    } catch (e) {
      await client.query("ROLLBACK");
      const err = e instanceof Error ? e.message : String(e);
      report.push({ ppId, error: err });
      console.error(JSON.stringify({ ppId, error: err }));
    } finally {
      client.release();
    }
  }

  if (!dryRun) {
    console.log("\n=== POST-AUDIT shop + FK ===");
    for (const ppId of ppIds) {
      const client = await pool.connect();
      try {
        const shop0 = await countShopZero(client, ppId);
        const fk = await client.query<{ sin_lr: number }>(
          `SELECT COUNT(*)::int AS sin_lr FROM pedido_proveedor_detalle
           WHERE pedido_proveedor_id = $1 AND (linea_id IS NULL OR referencia_id IS NULL)`,
          [ppId],
        );
        console.log(`PP-${ppId}: shop_cero=${shop0} sin_lr_fk=${fk.rows[0]?.sin_lr ?? "?"}`);
      } finally {
        client.release();
      }
    }
  }

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
