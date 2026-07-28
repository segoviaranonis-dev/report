/**
 * Pipeline PE sdrm Node — paridad Python import_pe_sdrm_pipeline
 * (purge → staging+pilares → PPD → am_* DPE desde sdrm_cod_grupo_dim).
 */
import type { Pool, PoolClient } from "pg";
import { parseGradaAbierta638 } from "@/lib/deposito-rimec/grada-abierta-638";
import {
  batchLabelFromFilename,
  expandPeSdrmCsv,
  type PeSdrmExpandedLine,
} from "@/lib/stock-pronta-entrega/pe-sdrm-pilares";
import { getStockProntaEntregaResumen } from "@/lib/stock-pronta-entrega/queries-resumen";

const PE_QUINCENA = "Pronta entrega";
const STAGING = "pe_sdrm_node_staging";

export type PeSdrmPipelineResult = {
  ok: true;
  batch: string;
  dry_run: boolean;
  replace_pe_universe: boolean;
  engine: "node";
  filas_expandidas: number;
  inserted_staging: number;
  fk_miss: number;
  ppd_inserted: number;
  am_backfilled: number;
  purge?: Record<string, number>;
  resumen: Awaited<ReturnType<typeof getStockProntaEntregaResumen>> | null;
};

async function purgePeUniverse(client: PoolClient): Promise<Record<string, number>> {
  const { rows: ppRows } = await client.query<{ id: string }>(
    `
    SELECT pp.id::text AS id FROM public.pedido_proveedor pp
    JOIN public.quincena_arribo qa ON qa.id = pp.quincena_arribo_id
    WHERE pp.entidad_comercial = 'STOCK'
      AND lower(trim(qa.descripcion)) = lower($1)
    `,
    [PE_QUINCENA],
  );
  const ppIds = ppRows.map((r) => Number(r.id));
  let ppd_deleted = 0;
  let pp_deleted = 0;
  let pp_kept_with_fi = 0;

  if (ppIds.length) {
    const delPpd = await client.query(
      `DELETE FROM public.pedido_proveedor_detalle WHERE pedido_proveedor_id = ANY($1::bigint[])`,
      [ppIds],
    );
    ppd_deleted = delPpd.rowCount ?? 0;

    const { rows: freeRows } = await client.query<{ id: string }>(
      `
      SELECT pp.id::text AS id FROM public.pedido_proveedor pp
      WHERE pp.id = ANY($1::bigint[])
        AND NOT EXISTS (SELECT 1 FROM public.factura_interna fi WHERE fi.pp_id = pp.id)
        AND NOT EXISTS (
          SELECT 1 FROM public.intencion_compra_pedido icp
          WHERE icp.pedido_proveedor_id = pp.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.venta_transito vt WHERE vt.pedido_proveedor_id = pp.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.compra_legal_pedido clp
          WHERE clp.pedido_proveedor_id = pp.id
        )
      `,
      [ppIds],
    );
    const freeIds = freeRows.map((r) => Number(r.id));
    pp_kept_with_fi = ppIds.length - freeIds.length;
    if (freeIds.length) {
      await client.query(
        `DELETE FROM public.stock_pe_staging_migrated WHERE pp_id = ANY($1::bigint[])`,
        [freeIds],
      );
      await client.query(`DELETE FROM public.pedido_proveedor_log WHERE pp_id = ANY($1::bigint[])`, [
        freeIds,
      ]);
      const delPp = await client.query(
        `DELETE FROM public.pedido_proveedor WHERE id = ANY($1::bigint[])`,
        [freeIds],
      );
      pp_deleted = delPp.rowCount ?? 0;
    }
  }

  const mapped = await client.query(`DELETE FROM public.stock_pe_staging_migrated`);
  const staging = await client.query(`DELETE FROM public.stock_pronta_entrega_rimec`);
  return {
    pp_deleted,
    pp_kept_with_fi,
    ppd_deleted,
    mapped_deleted: mapped.rowCount ?? 0,
    staging_deleted: staging.rowCount ?? 0,
  };
}

async function ensureTempStaging(client: PoolClient) {
  await client.query(`
    CREATE TEMP TABLE IF NOT EXISTS ${STAGING} (
      deposito_codigo text,
      columna_stock_legal text,
      codigo_barras text,
      cod_art_proveedor text,
      cod_grupo text,
      proveedor_id bigint,
      tipo_v2_id smallint,
      linea_cod bigint,
      ref_cod bigint,
      mat_cod bigint,
      col_cod bigint,
      excel_mat text,
      excel_col text,
      grada text,
      cantidad numeric(14,3),
      precio_gs bigint,
      batch_label text,
      ramo text
    ) ON COMMIT DROP
  `);
  await client.query(`TRUNCATE ${STAGING}`);
}

async function loadTempStaging(client: PoolClient, lines: PeSdrmExpandedLine[]) {
  const CHUNK = 2000;
  for (let i = 0; i < lines.length; i += CHUNK) {
    const chunk = lines.slice(i, i + CHUNK);
    await client.query(
      `INSERT INTO ${STAGING} (
        deposito_codigo, columna_stock_legal, codigo_barras, cod_art_proveedor, cod_grupo,
        proveedor_id, tipo_v2_id, linea_cod, ref_cod, mat_cod, col_cod,
        excel_mat, excel_col, grada, cantidad, precio_gs, batch_label, ramo
      )
      SELECT * FROM unnest(
        $1::text[], $2::text[], $3::text[], $4::text[], $5::text[],
        $6::bigint[], $7::smallint[], $8::bigint[], $9::bigint[], $10::bigint[], $11::bigint[],
        $12::text[], $13::text[], $14::text[], $15::numeric[], $16::bigint[], $17::text[], $18::text[]
      )`,
      [
        chunk.map((r) => r.deposito_codigo),
        chunk.map((r) => r.columna_stock_legal),
        chunk.map((r) => r.codigo_barras),
        chunk.map((r) => r.cod_art_proveedor),
        chunk.map((r) => r.cod_grupo),
        chunk.map((r) => r.proveedor_id),
        chunk.map((r) => r.tipo_v2_id),
        chunk.map((r) => r.linea_cod),
        chunk.map((r) => r.ref_cod),
        chunk.map((r) => r.mat_cod),
        chunk.map((r) => r.col_cod),
        chunk.map((r) => r.excel_mat),
        chunk.map((r) => r.excel_col),
        chunk.map((r) => r.grada),
        chunk.map((r) => r.cantidad),
        chunk.map((r) => r.precio_gs),
        chunk.map((r) => r.batch_label),
        chunk.map((r) => r.ramo),
      ],
    );
  }
}

async function provisionPilares(client: PoolClient) {
  await client.query(`
    INSERT INTO public.material (codigo_proveedor, proveedor_id, activo)
    SELECT DISTINCT s.mat_cod, s.proveedor_id, true FROM ${STAGING} s
    ON CONFLICT (proveedor_id, codigo_proveedor) DO NOTHING
  `);
  await client.query(`
    INSERT INTO public.color (codigo_proveedor, proveedor_id, activo)
    SELECT DISTINCT s.col_cod, s.proveedor_id, true FROM ${STAGING} s
    WHERE s.col_cod IS NOT NULL
    ON CONFLICT (proveedor_id, codigo_proveedor) DO NOTHING
  `);
  await client.query(`
    INSERT INTO public.linea (codigo_proveedor, proveedor_id, activo)
    SELECT DISTINCT s.linea_cod, s.proveedor_id, true FROM ${STAGING} s
    ON CONFLICT (proveedor_id, codigo_proveedor) DO NOTHING
  `);
  await client.query(`
    INSERT INTO public.referencia (codigo_proveedor, linea_id, proveedor_id, activo)
    SELECT DISTINCT s.ref_cod, l.id, s.proveedor_id, true
    FROM ${STAGING} s
    JOIN public.linea l ON l.proveedor_id = s.proveedor_id AND l.codigo_proveedor = s.linea_cod
    ON CONFLICT (proveedor_id, linea_id, codigo_proveedor) DO NOTHING
  `);
  await client.query(`
    INSERT INTO public.linea_referencia (proveedor_id, linea_id, referencia_id, activo)
    SELECT DISTINCT s.proveedor_id, l.id, r.id, true
    FROM ${STAGING} s
    JOIN public.linea l ON l.proveedor_id = s.proveedor_id AND l.codigo_proveedor = s.linea_cod
    JOIN public.referencia r ON r.proveedor_id = s.proveedor_id AND r.linea_id = l.id
      AND r.codigo_proveedor = s.ref_cod
    ON CONFLICT (proveedor_id, linea_id, referencia_id) DO NOTHING
  `);
}

async function insertStock(client: PoolClient, batch: string, archivo: string): Promise<number> {
  const r = await client.query(
    `
    INSERT INTO public.stock_pronta_entrega_rimec (
      deposito_codigo, columna_stock_legal, almacen_id, codigo_barras, cod_art_proveedor, cod_grupo,
      proveedor_id, tipo_v2_id, linea_id, referencia_id, material_id, color_id,
      linea_codigo_proveedor, referencia_codigo_proveedor,
      excel_material_code, excel_color_code, grada,
      cantidad, cantidad_importada, precio_unitario_gs,
      batch_label, archivo_origen, origen_holding
    )
    SELECT
      s.deposito_codigo, s.columna_stock_legal, 4, s.codigo_barras, s.cod_art_proveedor, s.cod_grupo,
      s.proveedor_id, s.tipo_v2_id, l.id, r.id, mat.id, col.id,
      s.linea_cod, s.ref_cod, s.excel_mat, s.excel_col, s.grada,
      s.cantidad, s.cantidad, s.precio_gs,
      s.batch_label, $1, 'RIMEC_CSV_SDRM'
    FROM ${STAGING} s
    INNER JOIN public.linea l
      ON l.proveedor_id = s.proveedor_id AND l.codigo_proveedor = s.linea_cod
    INNER JOIN public.referencia r
      ON r.proveedor_id = s.proveedor_id AND r.linea_id = l.id AND r.codigo_proveedor = s.ref_cod
    INNER JOIN public.material mat
      ON mat.proveedor_id = s.proveedor_id AND mat.codigo_proveedor = s.mat_cod
    INNER JOIN public.color col
      ON col.proveedor_id = s.proveedor_id AND col.codigo_proveedor = s.col_cod
    WHERE s.batch_label = $2
    ON CONFLICT (deposito_codigo, codigo_barras) DO UPDATE SET
      cantidad = EXCLUDED.cantidad,
      cantidad_importada = EXCLUDED.cantidad_importada,
      precio_unitario_gs = EXCLUDED.precio_unitario_gs,
      columna_stock_legal = EXCLUDED.columna_stock_legal,
      linea_id = EXCLUDED.linea_id,
      referencia_id = EXCLUDED.referencia_id,
      material_id = EXCLUDED.material_id,
      color_id = EXCLUDED.color_id,
      cod_grupo = EXCLUDED.cod_grupo,
      updated_at = now()
    `,
    [archivo, batch],
  );
  return r.rowCount ?? 0;
}

async function ensureQuincena(client: PoolClient): Promise<number> {
  const { rows } = await client.query<{ id: string }>(
    `
    SELECT id::text AS id FROM public.quincena_arribo
    WHERE lower(trim(descripcion)) = lower($1) LIMIT 1
    `,
    [PE_QUINCENA],
  );
  if (rows[0]) return Number(rows[0].id);
  const { rows: next } = await client.query<{ n: string }>(
    `SELECT COALESCE(MAX(id), 0) + 1 AS n FROM public.quincena_arribo`,
  );
  const id = Number(next[0]?.n ?? 1);
  await client.query(`INSERT INTO public.quincena_arribo (id, descripcion) VALUES ($1, $2)`, [
    id,
    PE_QUINCENA,
  ]);
  return id;
}

async function ensurePpHeaders(
  client: PoolClient,
  quincenaId: number,
  batch: string,
): Promise<Map<string, number>> {
  const { rows } = await client.query<{
    deposito_codigo: string;
    batch_label: string;
    proveedor_id: string;
    uds: string;
  }>(
    `
    SELECT s.deposito_codigo, s.batch_label, s.proveedor_id::text,
           COALESCE(SUM(s.cantidad), 0)::text AS uds
    FROM public.stock_pronta_entrega_rimec s
    WHERE s.cantidad > 0 AND s.batch_label = $1
    GROUP BY s.deposito_codigo, s.batch_label, s.proveedor_id
    `,
    [batch],
  );
  const map = new Map<string, number>();
  const year = new Date().getFullYear();
  for (const g of rows) {
    const deposito = g.deposito_codigo;
    const proveedorId = Number(g.proveedor_id);
    const key = `${deposito}|${batch}|${proveedorId}`;
    const numero = `PE-${deposito}-${batch}-${proveedorId}`;
    const { rows: ex } = await client.query<{ id: string }>(
      `SELECT id::text AS id FROM public.pedido_proveedor WHERE numero_registro = $1 LIMIT 1`,
      [numero],
    );
    if (ex[0]) {
      map.set(key, Number(ex[0].id));
      continue;
    }
    const pares = Math.trunc(Number(g.uds) || 0);
    const { rows: ins } = await client.query<{ id: string }>(
      `
      INSERT INTO public.pedido_proveedor (
        numero_registro, anio_fiscal,
        proveedor_importacion_id, entidad_comercial,
        fecha_pedido, quincena_arribo_id,
        estado, estado_transito, categoria_id,
        numero_proforma, deposito_codigo,
        pares_comprometidos, notas
      ) VALUES (
        $1, $2, $3, 'STOCK', CURRENT_DATE, $4,
        'CERRADO', 'EN_DEPOSITO', 1,
        $5, $6, $7, $8
      ) RETURNING id::text AS id
      `,
      [
        numero,
        year,
        proveedorId,
        quincenaId,
        batch,
        deposito,
        pares,
        `Import CSV PE · batch=${batch} · dep=${deposito} · Node`,
      ],
    );
    map.set(key, Number(ins[0].id));
  }
  return map;
}

async function migratePpd(
  client: PoolClient,
  ppMap: Map<string, number>,
  batch: string,
): Promise<{ inserted: number; skipped: number }> {
  const { rows } = await client.query<{
    id: string;
    deposito_codigo: string;
    batch_label: string;
    proveedor_id: string;
    excel_material_code: string | null;
    excel_color_code: string | null;
    cod_art_proveedor: string | null;
    codigo_barras: string | null;
    grada: string | null;
    cantidad: string;
    cantidad_importada: string | null;
    precio_unitario_gs: string | null;
    linea_cod: string | null;
    ref_cod: string | null;
    mat_cod: string | null;
    col_cod: string | null;
    descp_mat: string | null;
    descp_col: string | null;
    marca_id: string | null;
  }>(
    `
    SELECT
      s.id::text AS id, s.deposito_codigo, s.batch_label, s.proveedor_id::text,
      s.excel_material_code, s.excel_color_code,
      s.cod_art_proveedor, s.codigo_barras, s.grada,
      s.cantidad::text, s.cantidad_importada::text, s.precio_unitario_gs::text,
      l.codigo_proveedor::text AS linea_cod,
      r.codigo_proveedor::text AS ref_cod,
      m.codigo_proveedor::text AS mat_cod,
      c.codigo_proveedor::text AS col_cod,
      m.descripcion AS descp_mat,
      c.nombre AS descp_col,
      l.marca_id::text AS marca_id
    FROM public.stock_pronta_entrega_rimec s
    LEFT JOIN public.linea l ON l.id = s.linea_id
    LEFT JOIN public.referencia r ON r.id = s.referencia_id
    LEFT JOIN public.material m ON m.id = s.material_id
    LEFT JOIN public.color c ON c.id = s.color_id
    WHERE s.cantidad > 0
      AND s.batch_label = $1
      AND NOT EXISTS (
        SELECT 1 FROM public.stock_pe_staging_migrated m2 WHERE m2.staging_id = s.id
      )
    ORDER BY s.id
    `,
    [batch],
  );

  let inserted = 0;
  let skipped = 0;
  const CHUNK = 400;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const values: unknown[] = [];
    const placeholders: string[] = [];
    const meta: { stagingId: number; ppId: number }[] = [];
    let p = 1;

    for (const row of chunk) {
      const proveedorId = Number(row.proveedor_id);
      const key = `${row.deposito_codigo}|${row.batch_label}|${proveedorId}`;
      const ppId = ppMap.get(key);
      if (!ppId) {
        skipped++;
        continue;
      }
      const qtyImportada = Number(row.cantidad_importada ?? row.cantidad);
      const qtySaldo = Number(row.cantidad);
      if (qtySaldo <= 0) {
        skipped++;
        continue;
      }
      const qtyImp = qtyImportada > 0 ? qtyImportada : qtySaldo;
      const paresVendidos = Math.max(0, qtyImp - qtySaldo);
      const parsed =
        proveedorId === 638 ? parseGradaAbierta638(row.grada, qtySaldo) : null;
      const modo = parsed?.modo_venta ?? "CAJA_CERRADA";
      const grades = parsed ? JSON.stringify(parsed.grades_json) : null;
      const stagingId = Number(row.id);

      placeholders.push(
        `($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},0,$${p++}::numeric,$${p++}::numeric,$${p++}::numeric,$${p++},$${p++},$${p++}::bigint,$${p++}::jsonb,$${p++},$${p++},$${p++}::int)`,
      );
      values.push(
        ppId,
        String(row.linea_cod ?? "").trim(),
        String(row.ref_cod ?? "0").trim(),
        String(row.mat_cod ?? row.excel_material_code ?? "0").trim(),
        row.descp_mat || row.excel_material_code || "",
        String(row.col_cod ?? row.excel_color_code ?? "0").trim(),
        row.descp_col || row.excel_color_code || "",
        row.marca_id ? Number(row.marca_id) : null,
        String(row.grada ?? ""),
        String(row.cod_art_proveedor || row.codigo_barras || ""),
        qtyImp,
        qtyImp,
        paresVendidos,
        row.precio_unitario_gs ? Number(row.precio_unitario_gs) : null,
        row.precio_unitario_gs ? Number(row.precio_unitario_gs) : null,
        stagingId,
        grades,
        modo,
        parsed?.talle ?? null,
        parsed ? Math.max(1, Math.trunc(parsed.unidadVenta)) : null,
      );
      meta.push({ stagingId, ppId });
    }

    if (!placeholders.length) continue;

    const { rows: ret } = await client.query<{
      id: string;
      fila_origen_f9: string;
      pedido_proveedor_id: string;
    }>(
      `
      INSERT INTO public.pedido_proveedor_detalle (
        pedido_proveedor_id,
        linea, referencia,
        material_code, descp_material,
        color_code, descp_color,
        id_marca, grada, nombre,
        cantidad_cajas, cantidad_pares, cantidad, pares_vendidos,
        unit_fob_ajustado, precio_lpn, fila_origen_f9,
        grades_json, am_modo_venta, am_talle, am_unidad_venta
      ) VALUES ${placeholders.join(",")}
      RETURNING id::text AS id, fila_origen_f9::text, pedido_proveedor_id::text
      `,
      values,
    );

    if (ret.length) {
      await client.query(
        `
        INSERT INTO public.stock_pe_staging_migrated (staging_id, ppd_id, pp_id)
        SELECT * FROM unnest($1::bigint[], $2::bigint[], $3::bigint[])
        ON CONFLICT (staging_id) DO NOTHING
        `,
        [
          ret.map((r) => Number(r.fila_origen_f9)),
          ret.map((r) => Number(r.id)),
          ret.map((r) => Number(r.pedido_proveedor_id)),
        ],
      );
    }
    inserted += ret.length;
  }

  await client.query(
    `
    UPDATE public.carrito_item ci
    SET det_id = m.ppd_id, pp_id = m.pp_id
    FROM public.stock_pe_staging_migrated m
    WHERE ci.det_id = 800000000 + m.staging_id
    `,
  );

  return { inserted, skipped };
}

async function backfillAmDpe(client: PoolClient, batch: string): Promise<number> {
  const r = await client.query(
    `
    WITH src AS (
      SELECT
        ppd.id AS ppd_id,
        pe_stg.cod_grupo,
        COALESCE(cg.cadena_comercial, 'REGULAR') AS cadena,
        COALESCE(cg.es_liquidacion, false) AS es_liq
      FROM public.pedido_proveedor_detalle ppd
      JOIN public.pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
      JOIN LATERAL (
        SELECT NULLIF(btrim(s.cod_grupo), '') AS cod_grupo
        FROM public.stock_pe_staging_migrated m
        JOIN public.stock_pronta_entrega_rimec s ON s.id = m.staging_id
        WHERE m.ppd_id = ppd.id
        ORDER BY s.id
        LIMIT 1
      ) pe_stg ON pe_stg.cod_grupo IS NOT NULL
      LEFT JOIN public.sdrm_cod_grupo_dim cg ON cg.cod_grupo = pe_stg.cod_grupo
      WHERE pp.entidad_comercial = 'STOCK'
        AND lower(btrim(pp.numero_proforma)) = lower($1)
    )
    UPDATE public.pedido_proveedor_detalle ppd
    SET
      am_cod_grupo = src.cod_grupo,
      am_cadena_comercial = src.cadena,
      am_es_liquidacion = src.es_liq
    FROM src
    WHERE ppd.id = src.ppd_id
    `,
    [batch],
  );
  return r.rowCount ?? 0;
}

export async function runPeSdrmPipeline(
  pool: Pool,
  opts: {
    filename: string;
    contentLatin1: string;
    replacePeUniverse?: boolean;
    dryRun?: boolean;
  },
): Promise<PeSdrmPipelineResult> {
  const batch = batchLabelFromFilename(opts.filename);
  const lines = expandPeSdrmCsv(opts.contentLatin1, opts.filename);
  if (!lines.length) {
    throw new Error("0 filas expandibles tras parseo — revisar CSV sdrm (pipe | · latin-1)");
  }

  if (opts.dryRun) {
    return {
      ok: true,
      batch,
      dry_run: true,
      replace_pe_universe: false,
      engine: "node",
      filas_expandidas: lines.length,
      inserted_staging: 0,
      fk_miss: 0,
      ppd_inserted: 0,
      am_backfilled: 0,
      resumen: null,
    };
  }

  const client = await pool.connect();
  let purge: Record<string, number> | undefined;
  try {
    await client.query("BEGIN");
    if (opts.replacePeUniverse) {
      purge = await purgePeUniverse(client);
    } else {
      await client.query(`DELETE FROM public.stock_pronta_entrega_rimec WHERE batch_label = $1`, [
        batch,
      ]);
    }

    await ensureTempStaging(client);
    await loadTempStaging(client, lines);
    await provisionPilares(client);
    const inserted = await insertStock(client, batch, opts.filename);
    const fk_miss = lines.length - inserted;

    const quincenaId = await ensureQuincena(client);
    const ppMap = await ensurePpHeaders(client, quincenaId, batch);
    const { inserted: ppd_inserted } = await migratePpd(client, ppMap, batch);
    const am_backfilled = await backfillAmDpe(client, batch);

    await client.query("COMMIT");

    const resumen = await getStockProntaEntregaResumen(pool, { batch });
    return {
      ok: true,
      batch,
      dry_run: false,
      replace_pe_universe: !!opts.replacePeUniverse,
      engine: "node",
      filas_expandidas: lines.length,
      inserted_staging: inserted,
      fk_miss,
      ppd_inserted,
      am_backfilled,
      purge,
      resumen,
    };
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
}
