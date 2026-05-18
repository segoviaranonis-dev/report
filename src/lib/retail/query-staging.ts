import { getRimecPool } from "@/lib/rimec/pool";
import type { RetailBatchSummary } from "@/lib/retail/types";
import { RETAIL_STAGING_SELECT_SQL, type RetailStagingRow } from "@/lib/retail/staging-row";

export async function listRetailBatches(limit = 50): Promise<RetailBatchSummary[]> {
  const pool = getRimecPool();
  const { rows } = await pool.query<{
    batch_id: string;
    batch_label: string;
    archivo_origen: string;
    fecha_min: string | null;
    fecha_max: string | null;
    filas: number;
    cargado_en: string | null;
  }>(`
    SELECT
      batch_id::text AS batch_id,
      COALESCE(batch_label, '') AS batch_label,
      COALESCE(archivo_origen, '') AS archivo_origen,
      MIN(fecha_mov)::text AS fecha_min,
      MAX(fecha_mov)::text AS fecha_max,
      COUNT(*)::int AS filas,
      MAX(created_at)::text AS cargado_en
    FROM public.retail_multitienda_staging
    GROUP BY batch_id, batch_label, archivo_origen
    ORDER BY MAX(created_at) DESC NULLS LAST
    LIMIT $1
  `, [limit]);

  return rows.map((r) => ({
    batchId: r.batch_id,
    batchLabel: r.batch_label,
    archivoOrigen: r.archivo_origen,
    fechaMin: r.fecha_min,
    fechaMax: r.fecha_max,
    filas: r.filas,
    cargadoEn: r.cargado_en,
  }));
}

export async function resolveRetailBatchId(batchId?: string | null): Promise<string | null> {
  if (batchId?.trim()) return batchId.trim();
  const pool = getRimecPool();
  const { rows } = await pool.query<{ batch_id: string }>(`
    SELECT batch_id::text AS batch_id
    FROM public.retail_multitienda_staging
    GROUP BY batch_id
    ORDER BY MAX(created_at) DESC NULLS LAST
    LIMIT 1
  `);
  return rows[0]?.batch_id ?? null;
}

export async function loadRetailStagingBatch(batchId: string): Promise<RetailStagingRow[]> {
  const pool = getRimecPool();
  const { rows } = await pool.query<RetailStagingRow>(
    `${RETAIL_STAGING_SELECT_SQL}
     WHERE s.batch_id = CAST($1 AS uuid)`,
    [batchId],
  );
  return rows;
}
