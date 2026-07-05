/**
 * Import CSV bulk — REPLACE en segundos (staging temp + INSERT…SELECT).
 * Pilares: upsert por lote SQL indexado (sin N+1).
 */

import type { PoolClient } from "pg";
import type { CsvImportLine } from "@/lib/depositos/bazzar-csv-import";
import type { PilaresProvisionStats } from "@/lib/depositos/bazzar-csv-import-types";
import { PROVEEDOR_CALZADO, PROVEEDOR_CONFECCIONES } from "@/lib/depositos/pilar-proveedor-index";

const STAGING = "bazzar_csv_staging";

async function ensureStaging(client: PoolClient) {
  await client.query(`
    CREATE TEMP TABLE IF NOT EXISTS ${STAGING} (
      codigo_barras text,
      linea_cod bigint,
      ref_cod bigint,
      mat_cod bigint,
      col_cod bigint,
      excel_mat text,
      excel_col text,
      grada text,
      cantidad int,
      precio numeric,
      cliente_id int,
      batch_label text,
      proveedor_id bigint,
      ramo smallint,
      cod_grupo text
    ) ON COMMIT DROP
  `);
  await client.query(`TRUNCATE ${STAGING}`);
}

function lineToRow(line: CsvImportLine) {
  const p = line.pilares;
  const isCalzado = p.ramo === "calzado";
  return {
    codigo_barras: line.codigo_barras,
    linea_cod: isCalzado ? p.linea_codigo_proveedor : p.linea_codigo_bigint,
    ref_cod: isCalzado ? p.referencia_codigo_proveedor : p.referencia_codigo_bigint,
    mat_cod: p.material_codigo_bigint,
    col_cod: p.color_codigo_bigint,
    excel_mat: p.excel_material_code,
    excel_col: p.excel_color_code,
    grada: line.grada,
    cantidad: line.cantidad,
    precio: line.precio_unitario,
    cliente_id: line.cliente_id,
    batch_label: line.batch_label,
    proveedor_id: String(p.proveedor_id),
    ramo: isCalzado ? 1 : 2,
    cod_grupo: line.cod_grupo,
  };
}

async function loadStaging(client: PoolClient, lines: CsvImportLine[]) {
  const CHUNK = 2000;
  for (let i = 0; i < lines.length; i += CHUNK) {
    const chunk = lines.slice(i, i + CHUNK);
    const rows = chunk.map(lineToRow);
    await client.query(
      `INSERT INTO ${STAGING} (
        codigo_barras, linea_cod, ref_cod, mat_cod, col_cod,
        excel_mat, excel_col, grada, cantidad, precio,
        cliente_id, batch_label, proveedor_id, ramo, cod_grupo
      )
      SELECT * FROM unnest(
        $1::text[], $2::bigint[], $3::bigint[], $4::bigint[], $5::bigint[],
        $6::text[], $7::text[], $8::text[], $9::int[], $10::numeric[],
        $11::int[], $12::text[], $13::bigint[], $14::smallint[], $15::text[]
      )`,
      [
        rows.map((r) => r.codigo_barras),
        rows.map((r) => r.linea_cod),
        rows.map((r) => r.ref_cod),
        rows.map((r) => r.mat_cod),
        rows.map((r) => r.col_cod),
        rows.map((r) => r.excel_mat),
        rows.map((r) => r.excel_col),
        rows.map((r) => r.grada),
        rows.map((r) => r.cantidad),
        rows.map((r) => r.precio),
        rows.map((r) => r.cliente_id),
        rows.map((r) => r.batch_label),
        rows.map((r) => r.proveedor_id),
        rows.map((r) => r.ramo),
        rows.map((r) => r.cod_grupo),
      ],
    );
  }
}

async function provisionPilaresBulk(client: PoolClient): Promise<PilaresProvisionStats> {
  const t0 = Date.now();
  const stats: PilaresProvisionStats = {
    lineas: 0,
    referencias: 0,
    materiales: 0,
    colores: 0,
    linea_referencia: 0,
    duracion_ms: 0,
  };

  const mat = await client.query<{ n: number }>(`
    WITH ins AS (
      INSERT INTO public.material (codigo_proveedor, proveedor_id, activo)
      SELECT DISTINCT mat_cod, proveedor_id, true FROM ${STAGING}
      ON CONFLICT (proveedor_id, codigo_proveedor) DO NOTHING
      RETURNING 1
    ) SELECT COUNT(*)::int AS n FROM ins
  `);
  stats.materiales = mat.rows[0]?.n ?? 0;

  const col = await client.query<{ n: number }>(`
    WITH ins AS (
      INSERT INTO public.color (codigo_proveedor, proveedor_id, activo)
      SELECT DISTINCT col_cod, proveedor_id, true FROM ${STAGING}
      WHERE col_cod IS NOT NULL
      ON CONFLICT (proveedor_id, codigo_proveedor) DO NOTHING
      RETURNING 1
    ) SELECT COUNT(*)::int AS n FROM ins
  `);
  stats.colores = col.rows[0]?.n ?? 0;

  const lineaCalz = await client.query<{ n: number }>(`
    WITH need AS (
      SELECT DISTINCT s.linea_cod, s.proveedor_id,
        CASE LPAD(TRIM(s.cod_grupo), 2, '0')
          WHEN '01' THEN 1 WHEN '02' THEN 2 WHEN '03' THEN 3 WHEN '04' THEN 4
          WHEN '05' THEN 5 WHEN '06' THEN 6 WHEN '07' THEN 7 WHEN '08' THEN 8
          WHEN '09' THEN 9 WHEN '10' THEN 10 WHEN '11' THEN 11 WHEN '12' THEN 12
          WHEN '13' THEN 13 WHEN '14' THEN 14 WHEN '15' THEN 15
          ELSE NULL END AS marca_hint
      FROM ${STAGING} s
      WHERE s.ramo = 1 AND s.proveedor_id = ${PROVEEDOR_CALZADO}
    ),
    ins AS (
      INSERT INTO public.linea (codigo_proveedor, proveedor_id, marca_id, genero_id, grupo_estilo_id, activo)
      SELECT n.linea_cod, n.proveedor_id,
        COALESCE(n.marca_hint, tpl.marca_id),
        tpl.genero_id,
        tpl.grupo_estilo_id,
        true
      FROM need n
      LEFT JOIN LATERAL (
        SELECT l.marca_id, l.genero_id, l.grupo_estilo_id
        FROM public.linea l
        WHERE l.proveedor_id = n.proveedor_id
          AND l.codigo_proveedor < n.linea_cod
          AND trim(l.codigo_proveedor::text) ~ '^[0-9]+$'
        ORDER BY l.codigo_proveedor DESC
        LIMIT 1
      ) tpl ON true
      WHERE NOT EXISTS (
        SELECT 1 FROM public.linea l
        WHERE l.proveedor_id = n.proveedor_id AND l.codigo_proveedor = n.linea_cod
      )
      ON CONFLICT (proveedor_id, codigo_proveedor) DO NOTHING
      RETURNING 1
    )
    SELECT COUNT(*)::int AS n FROM ins
  `);
  stats.lineas += lineaCalz.rows[0]?.n ?? 0;

  const lineaConf = await client.query<{ n: number }>(`
    WITH need AS (
      SELECT DISTINCT s.linea_cod, s.proveedor_id,
        CASE LPAD(TRIM(s.cod_grupo), 2, '0')
          WHEN '01' THEN 1 WHEN '02' THEN 2 WHEN '03' THEN 3 WHEN '04' THEN 4
          WHEN '05' THEN 5 WHEN '06' THEN 6 WHEN '07' THEN 7 WHEN '08' THEN 8
          WHEN '09' THEN 9 WHEN '10' THEN 10 WHEN '11' THEN 11 WHEN '12' THEN 12
          WHEN '13' THEN 13 WHEN '14' THEN 14 WHEN '15' THEN 15
          ELSE NULL END AS marca_hint
      FROM ${STAGING} s
      WHERE s.ramo = 2 AND s.proveedor_id = ${PROVEEDOR_CONFECCIONES}
    ),
    ins AS (
      INSERT INTO public.linea (codigo_proveedor, proveedor_id, marca_id, activo)
      SELECT n.linea_cod, n.proveedor_id, n.marca_hint, true
      FROM need n
      WHERE NOT EXISTS (
        SELECT 1 FROM public.linea l
        WHERE l.proveedor_id = n.proveedor_id AND l.codigo_proveedor = n.linea_cod
      )
      ON CONFLICT (proveedor_id, codigo_proveedor) DO NOTHING
      RETURNING 1
    )
    SELECT COUNT(*)::int AS n FROM ins
  `);
  stats.lineas += lineaConf.rows[0]?.n ?? 0;

  const ref = await client.query<{ n: number }>(`
    WITH pairs AS (
      SELECT DISTINCT s.proveedor_id, s.linea_cod, s.ref_cod FROM ${STAGING} s
    ),
    ins AS (
      INSERT INTO public.referencia (codigo_proveedor, linea_id, proveedor_id, activo)
      SELECT p.ref_cod, l.id, p.proveedor_id, true
      FROM pairs p
      INNER JOIN public.linea l
        ON l.proveedor_id = p.proveedor_id AND l.codigo_proveedor = p.linea_cod
      ON CONFLICT (proveedor_id, linea_id, codigo_proveedor) DO NOTHING
      RETURNING 1
    )
    SELECT COUNT(*)::int AS n FROM ins
  `);
  stats.referencias = ref.rows[0]?.n ?? 0;

  const lr = await client.query<{ n: number }>(`
    WITH pairs AS (
      SELECT DISTINCT s.proveedor_id, l.id AS linea_id, r.id AS referencia_id, l.grupo_estilo_id
      FROM ${STAGING} s
      INNER JOIN public.linea l ON l.proveedor_id = s.proveedor_id AND l.codigo_proveedor = s.linea_cod
      INNER JOIN public.referencia r
        ON r.proveedor_id = s.proveedor_id AND r.linea_id = l.id AND r.codigo_proveedor = s.ref_cod
    ),
    ins AS (
      INSERT INTO public.linea_referencia (proveedor_id, linea_id, referencia_id, grupo_estilo_id, activo)
      SELECT p.proveedor_id, p.linea_id, p.referencia_id, p.grupo_estilo_id, true
      FROM pairs p
      WHERE NOT EXISTS (
        SELECT 1 FROM public.linea_referencia lr
        WHERE lr.proveedor_id = p.proveedor_id
          AND lr.linea_id = p.linea_id AND lr.referencia_id = p.referencia_id
      )
      RETURNING 1
    )
    SELECT COUNT(*)::int AS n FROM ins
  `);
  stats.linea_referencia = lr.rows[0]?.n ?? 0;

  stats.duracion_ms = Date.now() - t0;
  return stats;
}

const INSERT_CALZADO_BULK = (tabla: string) => `
INSERT INTO public.${tabla} (
  codigo_barras, linea_codigo_proveedor, referencia_codigo_proveedor,
  excel_material_code, excel_color_code,
  linea_id, referencia_id, material_id, color_id,
  grada, cantidad, cantidad_importada, precio_unitario, monto,
  marca_id, genero_id, grupo_estilo_id, tipo_1_id, tipo_v2_id,
  cliente_id, tipo_movimiento, origen_holding, batch_label,
  fecha_mov, created_at, created_by, archivo_origen
)
SELECT
  s.codigo_barras, s.linea_cod, s.ref_cod, s.excel_mat, s.excel_col,
  l.id, r.id, mat.id, col.id,
  s.grada, s.cantidad, s.cantidad, s.precio,
  CASE WHEN s.precio IS NOT NULL THEN s.cantidad * s.precio ELSE NULL END,
  l.marca_id, l.genero_id, lr.grupo_estilo_id, lr.tipo_1_id,
  1,
  s.cliente_id, 'stock', 'BAZZAR_CSV', s.batch_label,
  CURRENT_DATE, NOW(), 'import_bazzar_csv_web', s.batch_label
FROM ${STAGING} s
INNER JOIN public.linea l
  ON l.proveedor_id = ${PROVEEDOR_CALZADO} AND l.codigo_proveedor = s.linea_cod
INNER JOIN public.referencia r
  ON r.proveedor_id = ${PROVEEDOR_CALZADO} AND r.linea_id = l.id AND r.codigo_proveedor = s.ref_cod
INNER JOIN public.material mat
  ON mat.proveedor_id = ${PROVEEDOR_CALZADO} AND mat.codigo_proveedor = s.mat_cod
INNER JOIN public.color col
  ON col.proveedor_id = ${PROVEEDOR_CALZADO} AND col.codigo_proveedor = s.col_cod
LEFT JOIN public.linea_referencia lr
  ON lr.linea_id = l.id AND lr.referencia_id = r.id
WHERE s.ramo = 1
`;

const INSERT_CONFECCIONES_BULK = (tabla: string) => `
INSERT INTO public.${tabla} (
  codigo_barras, linea_codigo_proveedor, referencia_codigo_proveedor,
  excel_material_code, excel_color_code,
  linea_id, referencia_id, material_id, color_id,
  grada, cantidad, cantidad_importada, precio_unitario, monto,
  marca_id, genero_id, grupo_estilo_id, tipo_1_id, tipo_v2_id,
  cliente_id, tipo_movimiento, origen_holding, batch_label,
  fecha_mov, created_at, created_by, archivo_origen
)
SELECT
  s.codigo_barras, s.linea_cod, s.ref_cod, s.excel_mat, s.excel_col,
  l.id, r.id, mat.id, col.id,
  s.grada, s.cantidad, s.cantidad, s.precio,
  CASE WHEN s.precio IS NOT NULL THEN s.cantidad * s.precio ELSE NULL END,
  l.marca_id, l.genero_id, lr.grupo_estilo_id, lr.tipo_1_id,
  2,
  s.cliente_id, 'stock', 'BAZZAR_CSV', s.batch_label,
  CURRENT_DATE, NOW(), 'import_bazzar_csv_web', s.batch_label
FROM ${STAGING} s
INNER JOIN public.linea l
  ON l.proveedor_id = ${PROVEEDOR_CONFECCIONES} AND l.codigo_proveedor = s.linea_cod
INNER JOIN public.referencia r
  ON r.proveedor_id = ${PROVEEDOR_CONFECCIONES} AND r.linea_id = l.id AND r.codigo_proveedor = s.ref_cod
INNER JOIN public.material mat
  ON mat.proveedor_id = ${PROVEEDOR_CONFECCIONES} AND mat.codigo_proveedor = s.mat_cod
LEFT JOIN public.color col
  ON col.proveedor_id = ${PROVEEDOR_CONFECCIONES} AND col.codigo_proveedor = s.col_cod
LEFT JOIN public.linea_referencia lr
  ON lr.linea_id = l.id AND lr.referencia_id = r.id
WHERE s.ramo = 2 AND s.col_cod IS NOT NULL
`;

export async function bulkReplaceTabla(
  client: PoolClient,
  tabla: string,
  lines: CsvImportLine[],
): Promise<{
  deleted: number;
  inserted: number;
  fk_miss: number;
  pilares: PilaresProvisionStats;
  deposito_duracion_ms: number;
}> {
  await ensureStaging(client);
  await loadStaging(client, lines);

  const pilares = await provisionPilaresBulk(client);

  const tDep = Date.now();
  const del = await client.query(`DELETE FROM public.${tabla}`);
  const calz = await client.query(INSERT_CALZADO_BULK(tabla));
  const conf = await client.query(INSERT_CONFECCIONES_BULK(tabla));
  const inserted = (calz.rowCount ?? 0) + (conf.rowCount ?? 0);

  return {
    deleted: del.rowCount ?? 0,
    inserted,
    fk_miss: Math.max(0, lines.length - inserted),
    pilares,
    deposito_duracion_ms: Date.now() - tDep,
  };
}
