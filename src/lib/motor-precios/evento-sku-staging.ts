import type { Pool } from "pg";
import type { SkuStagingRow } from "./excel-proveedor";

let skuTableChecked = false;
let skuTableExists = false;

async function ensureSkuTable(pool: Pool): Promise<boolean> {
  if (skuTableChecked) return skuTableExists;
  const { rows } = await pool.query<{ ok: boolean }>(
    `SELECT to_regclass('public.precio_evento_sku_excel') IS NOT NULL AS ok`,
  );
  skuTableExists = rows[0]?.ok === true;
  skuTableChecked = true;
  return skuTableExists;
}

export async function guardarSkusExcel(pool: Pool, eventoId: number, skus: SkuStagingRow[]): Promise<number> {
  if (!(await ensureSkuTable(pool))) {
    throw new Error(
      "Tabla precio_evento_sku_excel no existe — ejecutá node scripts/run_migration_120.mjs en report/",
    );
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM precio_evento_sku_excel WHERE evento_id = $1`, [eventoId]);
    if (skus.length) {
      const values: unknown[] = [];
      const chunks: string[] = [];
      skus.forEach((s, i) => {
        const b = i * 7;
        chunks.push(
          `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7})`,
        );
        values.push(
          eventoId,
          s.marca,
          s.linea,
          s.referencia,
          s.material,
          s.descripcion ?? "",
          s.fob_fabrica,
        );
      });
      await client.query(
        `INSERT INTO precio_evento_sku_excel
           (evento_id, marca, linea, referencia, material, descripcion, fob_fabrica)
         VALUES ${chunks.join(", ")}`,
        values,
      );
    }
    await client.query("COMMIT");
    return skus.length;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function contarSkusExcel(pool: Pool, eventoId: number): Promise<number> {
  if (!(await ensureSkuTable(pool))) return 0;
  const { rows } = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM precio_evento_sku_excel WHERE evento_id = $1`,
    [eventoId],
  );
  return Number(rows[0]?.n ?? 0);
}

export async function cargarSkusExcel(pool: Pool, eventoId: number): Promise<SkuStagingRow[]> {
  if (!(await ensureSkuTable(pool))) return [];
  const { rows } = await pool.query<{
    marca: string;
    linea: string;
    referencia: string;
    material: string;
    descripcion: string;
    fob_fabrica: string;
  }>(
    `SELECT marca, linea, referencia, material, descripcion, fob_fabrica
     FROM precio_evento_sku_excel
     WHERE evento_id = $1
     ORDER BY id`,
    [eventoId],
  );
  return rows.map((r) => ({
    marca: r.marca,
    linea: r.linea,
    referencia: r.referencia,
    material: r.material,
    descripcion: r.descripcion,
    fob_fabrica: Number(r.fob_fabrica),
  }));
}
