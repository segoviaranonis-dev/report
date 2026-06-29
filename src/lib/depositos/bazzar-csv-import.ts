/**
 * Import CSV POS Bazzar → tablas deposito_* (ciclo propio · sin Retail).
 * Espejo operativo de scripts/import_bazzar_csv_deposito.mjs
 */

import type { Pool, PoolClient } from "pg";
import type {
  ExpandStats,
  FileImportResult,
  ImportCsvBatchResult,
  ImportCsvMode,
  TablaImportResult,
} from "@/lib/depositos/bazzar-csv-import-types";
export type {
  ExpandStats,
  FileImportResult,
  ImportCsvBatchResult,
  ImportCsvMode,
  TablaImportResult,
} from "@/lib/depositos/bazzar-csv-import-types";
import {
  buildDepositMapForEnte,
  parseBazzarCsvFilename,
  type BazzarCsvEnteTarget,
  type EnteBazzar,
} from "@/lib/depositos/bazzar-csv-ente-map";
import {
  PROVEEDOR_CALZADO,
  PROVEEDOR_CONFECCIONES,
  resolvePilaresCodigos,
  validateMatrizTienda,
  type PilaresCodigosResueltos,
} from "@/lib/depositos/pilar-proveedor-index";
import { bulkReplaceTabla } from "@/lib/depositos/bazzar-csv-bulk-import";
import { parseLpnPrecioVenta } from "@/lib/depositos/precio-venta";

export type CsvImportLine = {
  codigo_barras: string;
  cod_grupo: string;
  grada: string;
  cantidad: number;
  precio_unitario: number | null;
  cliente_id: number;
  batch_label: string;
  pilares: PilaresCodigosResueltos;
};

function parseGrada(raw: string, ramo: PilaresCodigosResueltos["ramo"]): string {
  const s = String(raw ?? "").trim();
  if (ramo === "confecciones") {
    const m = s.match(/(\d{1,2})/);
    return m ? m[1] : s;
  }
  const m = s.match(/(\d{2})/);
  return m ? m[1] : s;
}

function qty(raw: string): number {
  const n = Number(String(raw ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}

export function parsePipeCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const headers = lines[0].split("|").map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split("|");
    const rec: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) rec[headers[j]] = (parts[j] ?? "").trim();
    rows.push(rec);
  }
  return rows;
}

export function expandCsvRows(
  csvRows: Record<string, string>[],
  batchLabel: string,
  depositMap: BazzarCsvEnteTarget[],
): { buckets: Map<string, { meta: BazzarCsvEnteTarget; lines: CsvImportLine[] }>; stats: ExpandStats } {
  const buckets = new Map(
    depositMap.map((m) => [m.tabla, { meta: m, lines: [] as CsvImportLine[] }]),
  );
  const stats: ExpandStats = {
    skipped_parse: 0,
    skipped_matriz: 0,
    calzado: 0,
    confecciones: 0,
    matriz_reasons: {},
  };

  for (const row of csvRows) {
    const codGrupo = row["COD.GRUPO"] || row["GRUPO"] || "";
    const pilares = resolvePilaresCodigos({
      cod_art_proveedor: row["COD.ART.PROVEEDOR"] ?? "",
      cod_grupo: codGrupo,
      cod_material: row["COD.MATERIAL"] ?? "",
      cod_color: row["COD.COLOR"] ?? "",
    });
    if (!pilares) {
      stats.skipped_parse += 1;
      continue;
    }

    const grada = parseGrada(row["DESCRIPCION GRADA"] ?? "", pilares.ramo);
    const precio = parseLpnPrecioVenta(row["LPN"] ?? "");

    for (const m of depositMap) {
      const cantidad = qty(row[m.csvColumn] ?? "");
      if (cantidad <= 0) continue;

      const matriz = validateMatrizTienda(m.cliente_id, pilares.tipo_v2_id, null, codGrupo);
      if (!matriz.ok) {
        stats.skipped_matriz += cantidad;
        stats.matriz_reasons[matriz.reason] = (stats.matriz_reasons[matriz.reason] ?? 0) + cantidad;
        continue;
      }

      if (pilares.ramo === "calzado") stats.calzado += cantidad;
      else stats.confecciones += cantidad;

      buckets.get(m.tabla)!.lines.push({
        codigo_barras: row["CODIGO ARTICULO"] ?? "",
        cod_grupo: codGrupo,
        grada,
        cantidad,
        precio_unitario: precio,
        cliente_id: m.cliente_id,
        batch_label: batchLabel,
        pilares,
      });
    }
  }

  return { buckets, stats };
}

async function assertSinBandejaAbierta(client: PoolClient, cliente_id: number): Promise<void> {
  const r = await client.query<{ n: number }>(
    `SELECT COUNT(DISTINCT staging_id)::int AS n
     FROM public.ticket_bandeja_cajero
     WHERE cliente_id = $1 AND estado = 'ABIERTO' AND activo = true`,
    [cliente_id],
  );
  if ((r.rows[0]?.n ?? 0) > 0) {
    throw new Error(`cliente_id ${cliente_id}: bandeja POS ABIERTA — cerrar antes de import CSV`);
  }
}

const INSERT_CALZADO_SQL = (tabla: string) => `
INSERT INTO public.${tabla} (
  codigo_barras, linea_codigo_proveedor, referencia_codigo_proveedor,
  excel_material_code, excel_color_code,
  linea_id, referencia_id, material_id, color_id,
  grada, cantidad, precio_unitario, monto,
  marca_id, genero_id, grupo_estilo_id, tipo_1_id, tipo_v2_id,
  cliente_id, tipo_movimiento, origen_holding, batch_label,
  fecha_mov, created_at, created_by, archivo_origen
)
SELECT
  $1, CAST($2 AS bigint), CAST($3 AS bigint), $4, $5,
  l.id, r.id, mat.id, col.id,
  $6, $7::numeric, $8::numeric,
  CASE WHEN $8::numeric IS NOT NULL THEN ($7::numeric * $8::numeric) ELSE NULL END,
  l.marca_id, l.genero_id, lr.grupo_estilo_id, lr.tipo_1_id,
  1,
  $9, 'stock', 'BAZZAR_CSV', $10,
  CURRENT_DATE, NOW(), 'import_bazzar_csv_web', $11
FROM public.linea l
INNER JOIN public.referencia r
  ON r.linea_id = l.id
  AND r.proveedor_id = ${PROVEEDOR_CALZADO}
  AND r.codigo_proveedor = CAST($3 AS bigint)
INNER JOIN public.material mat
  ON mat.proveedor_id = ${PROVEEDOR_CALZADO}
  AND mat.codigo_proveedor = CAST($12 AS bigint)
INNER JOIN public.color col
  ON col.proveedor_id = ${PROVEEDOR_CALZADO}
  AND col.codigo_proveedor = CAST($13 AS bigint)
LEFT JOIN public.linea_referencia lr
  ON lr.linea_id = l.id AND lr.referencia_id = r.id
WHERE l.proveedor_id = ${PROVEEDOR_CALZADO}
  AND l.codigo_proveedor = CAST($2 AS bigint)
RETURNING id
`;

const INSERT_CONFECCIONES_SQL = (tabla: string) => `
INSERT INTO public.${tabla} (
  codigo_barras, linea_codigo_proveedor, referencia_codigo_proveedor,
  excel_material_code, excel_color_code,
  linea_id, referencia_id, material_id, color_id,
  grada, cantidad, precio_unitario, monto,
  marca_id, genero_id, grupo_estilo_id, tipo_1_id, tipo_v2_id,
  cliente_id, tipo_movimiento, origen_holding, batch_label,
  fecha_mov, created_at, created_by, archivo_origen
)
SELECT
  $1, CAST($15 AS bigint), CAST($12 AS bigint), $4, $5,
  l.id, r.id, mat.id, col.id,
  $6, $7::numeric, $8::numeric,
  CASE WHEN $8::numeric IS NOT NULL THEN ($7::numeric * $8::numeric) ELSE NULL END,
  l.marca_id, l.genero_id, lr.grupo_estilo_id, lr.tipo_1_id,
  2,
  $9, 'stock', 'BAZZAR_CSV', $10,
  CURRENT_DATE, NOW(), 'import_bazzar_csv_web', $11
FROM public.linea l
INNER JOIN public.referencia r
  ON r.linea_id = l.id
  AND r.proveedor_id = ${PROVEEDOR_CONFECCIONES}
  AND r.codigo_proveedor = CAST($12 AS bigint)
INNER JOIN public.material mat
  ON mat.proveedor_id = ${PROVEEDOR_CONFECCIONES}
  AND mat.codigo_proveedor = CAST($13 AS bigint)
LEFT JOIN public.color col
  ON col.proveedor_id = ${PROVEEDOR_CONFECCIONES}
  AND col.codigo_proveedor = CAST($14 AS bigint)
LEFT JOIN public.linea_referencia lr
  ON lr.linea_id = l.id AND lr.referencia_id = r.id
WHERE l.proveedor_id = ${PROVEEDOR_CONFECCIONES}
  AND l.codigo_proveedor = CAST($15 AS bigint)
RETURNING id
`;

const MERGE_ADD_SQL = (tabla: string) => `
UPDATE public.${tabla} d
SET cantidad = d.cantidad + $8,
    batch_label = $9,
    archivo_origen = $10,
    origen_holding = 'BAZZAR_CSV',
    created_at = NOW(),
    created_by = 'import_bazzar_csv_web'
WHERE d.cliente_id = $7
  AND d.grada = $6
  AND d.linea_id = (
    SELECT l.id FROM public.linea l
    WHERE l.proveedor_id = $11 AND l.codigo_proveedor = CAST($2 AS bigint)
    LIMIT 1
  )
  AND d.referencia_id = (
    SELECT r.id FROM public.referencia r
    WHERE r.proveedor_id = $11 AND r.codigo_proveedor = CAST($3 AS bigint)
    LIMIT 1
  )
  AND d.material_id = (
    SELECT mat.id FROM public.material mat
    WHERE mat.proveedor_id = $11 AND mat.codigo_proveedor = CAST($4 AS bigint)
    LIMIT 1
  )
  AND d.color_id IS NOT DISTINCT FROM (
    SELECT col.id FROM public.color col
    WHERE col.proveedor_id = $11 AND col.codigo_proveedor = CAST($5 AS bigint)
    LIMIT 1
  )
`;

async function importLine(
  client: PoolClient,
  tabla: string,
  line: CsvImportLine,
  mode: ImportCsvMode,
): Promise<"inserted" | "updated" | "miss"> {
  const p = line.pilares;
  const sqlCalz = INSERT_CALZADO_SQL(tabla);
  const sqlConf = INSERT_CONFECCIONES_SQL(tabla);

  if (mode === "merge") {
    const prov = p.ramo === "calzado" ? PROVEEDOR_CALZADO : PROVEEDOR_CONFECCIONES;
    if (p.ramo === "confecciones" && !p.color_codigo_bigint) return "miss";
    const upd = await client.query(MERGE_ADD_SQL(tabla), [
      line.codigo_barras,
      p.linea_codigo_proveedor,
      p.referencia_codigo_proveedor,
      p.excel_material_code,
      p.excel_color_code,
      line.grada,
      line.cliente_id,
      line.cantidad,
      line.batch_label,
      line.batch_label,
      prov,
    ]);
    if ((upd.rowCount ?? 0) > 0) return "updated";
  }

  let res;
  if (p.ramo === "calzado") {
    res = await client.query(sqlCalz, [
      line.codigo_barras,
      p.linea_codigo_proveedor,
      p.referencia_codigo_proveedor,
      p.excel_material_code,
      p.excel_color_code,
      line.grada,
      line.cantidad,
      line.precio_unitario,
      line.cliente_id,
      line.batch_label,
      line.batch_label,
      p.material_codigo_bigint,
      p.color_codigo_bigint,
    ]);
  } else {
    if (!p.color_codigo_bigint) return "miss";
    res = await client.query(sqlConf, [
      line.codigo_barras,
      p.linea_codigo_proveedor,
      p.referencia_codigo_proveedor,
      p.excel_material_code,
      p.excel_color_code,
      line.grada,
      line.cantidad,
      line.precio_unitario,
      line.cliente_id,
      line.batch_label,
      line.batch_label,
      p.referencia_codigo_bigint,
      p.material_codigo_bigint,
      p.color_codigo_bigint,
      p.linea_codigo_bigint,
    ]);
  }

  return (res.rowCount ?? 0) > 0 ? "inserted" : "miss";
}

async function importTabla(
  pool: Pool,
  tabla: string,
  lines: CsvImportLine[],
  mode: ImportCsvMode,
  dryRun: boolean,
): Promise<TablaImportResult> {
  if (!lines.length) {
    return { tabla, cliente_id: 0, deleted: 0, inserted: 0, updated: 0, fk_miss: 0, filas_csv: 0 };
  }

  const cliente_id = lines[0].cliente_id;

  if (dryRun) {
    return {
      tabla,
      cliente_id,
      deleted: mode === "replace" ? -1 : 0,
      inserted: lines.length,
      updated: 0,
      fk_miss: 0,
      filas_csv: lines.length,
    };
  }

  const client = await pool.connect();
  let deleted = 0;
  let inserted = 0;
  let updated = 0;
  let fkMiss = 0;
  let pilares;
  let depositoDuracionMs = 0;

  try {
    await client.query("BEGIN");
    await assertSinBandejaAbierta(client, cliente_id);

    if (mode === "replace") {
      const bulk = await bulkReplaceTabla(client, tabla, lines);
      deleted = bulk.deleted;
      inserted = bulk.inserted;
      fkMiss = bulk.fk_miss;
      pilares = bulk.pilares;
      depositoDuracionMs = bulk.deposito_duracion_ms;
    } else {
      for (const line of lines) {
        const outcome = await importLine(client, tabla, line, mode);
        if (outcome === "inserted") inserted += 1;
        else if (outcome === "updated") updated += 1;
        else fkMiss += 1;
      }
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  return {
    tabla,
    cliente_id,
    deleted,
    inserted,
    updated,
    fk_miss: fkMiss,
    filas_csv: lines.length,
    pilares,
    deposito_duracion_ms: depositoDuracionMs,
  };
}

export function entePermitidoParaArchivo(
  filename: string,
  entesPermitidos: EnteBazzar[],
): { ok: true; ente: EnteBazzar } | { ok: false; reason: string } {
  const parsed = parseBazzarCsvFilename(filename);
  if (!parsed.ok) return parsed;
  if (!entesPermitidos.includes(parsed.ente)) {
    return {
      ok: false,
      reason: `Archivo ${filename} es ente ${parsed.ente} — no autorizado para tu sesión`,
    };
  }
  return { ok: true, ente: parsed.ente };
}

export async function importBazzarCsvFile(
  pool: Pool,
  filename: string,
  csvText: string,
  mode: ImportCsvMode,
  dryRun: boolean,
): Promise<Omit<FileImportResult, "ok" | "error">> {
  const parsed = parseBazzarCsvFilename(filename);
  if (!parsed.ok) throw new Error(parsed.reason);

  const depositMap = buildDepositMapForEnte(parsed.ente);
  const batchLabel = filename.replace(/\.[^.]+$/, "");
  const csvRows = parsePipeCsv(csvText);
  const { buckets, stats } = expandCsvRows(csvRows, batchLabel, depositMap);

  const tablas: TablaImportResult[] = [];
  for (const [tabla, { lines }] of buckets) {
    tablas.push(await importTabla(pool, tabla, lines, mode, dryRun));
  }

  return {
    filename,
    ente: parsed.ente,
    lote: parsed.lote,
    tablas,
    stats,
  };
}

export async function importBazzarCsvBatch(
  pool: Pool,
  files: { filename: string; content: string }[],
  mode: ImportCsvMode,
  dryRun: boolean,
): Promise<ImportCsvBatchResult> {
  const inicio = Date.now();
  const results: FileImportResult[] = [];

  for (const f of files) {
    try {
      const partial = await importBazzarCsvFile(pool, f.filename, f.content, mode, dryRun);
      results.push({ ...partial, ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      results.push({
        filename: f.filename,
        ente: "Fernando",
        lote: "",
        ok: false,
        error: msg,
        tablas: [],
        stats: {
          skipped_parse: 0,
          skipped_matriz: 0,
          calzado: 0,
          confecciones: 0,
          matriz_reasons: {},
        },
      });
    }
  }

  const success = results.every((r) => r.ok);
  let pilaresMs = 0;
  let depositoMs = 0;
  for (const f of results) {
    for (const t of f.tablas) {
      pilaresMs += t.pilares?.duracion_ms ?? 0;
      depositoMs += t.deposito_duracion_ms ?? 0;
    }
  }
  const totalMs = Date.now() - inicio;
  return {
    success,
    mode,
    dry_run: dryRun,
    files: results,
    duracion_ms: totalMs,
    timing: dryRun
      ? undefined
      : { total_ms: totalMs, pilares_ms: pilaresMs, deposito_ms: depositoMs },
    error: success ? undefined : results.find((r) => r.error)?.error,
  };
}
