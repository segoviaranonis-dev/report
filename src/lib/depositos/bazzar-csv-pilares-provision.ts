/**
 * Provisión pilares en import CSV Bazzar — ciego + herencia vecino (Retail 1.1 / 1.2).
 * Calzado 654 · confecciones 638 · sin descripción color (TONO después).
 */

import type { PoolClient } from "pg";
import type { CsvImportLine } from "@/lib/depositos/bazzar-csv-import";
import type { PilaresProvisionStats } from "@/lib/depositos/bazzar-csv-import-types";
import { GRUPO_ID_MARCA } from "@/lib/depositos/pilar-proveedor-index";

export type { PilaresProvisionStats };

type LineaTpl = {
  id: number;
  marca_id: number | null;
  genero_id: number | null;
  grupo_estilo_id: number | null;
};

type LrTpl = {
  grupo_estilo_id: number | null;
  tipo_1_id: number | null;
};

function uniqMolecules(lines: CsvImportLine[]): CsvImportLine[] {
  const map = new Map<string, CsvImportLine>();
  for (const l of lines) {
    const p = l.pilares;
    const k = `${p.proveedor_id}|${p.linea_codigo_proveedor}|${p.referencia_codigo_proveedor}|${p.excel_material_code}|${p.excel_color_code}`;
    if (!map.has(k)) map.set(k, l);
  }
  return Array.from(map.values()).sort((a, b) => {
    const la = Number(a.pilares.linea_codigo_proveedor) || 0;
    const lb = Number(b.pilares.linea_codigo_proveedor) || 0;
    if (la !== lb) return la - lb;
    const ra = Number(a.pilares.referencia_codigo_proveedor) || 0;
    const rb = Number(b.pilares.referencia_codigo_proveedor) || 0;
    return ra - rb;
  });
}

async function lineaExists(
  client: PoolClient,
  proveedorId: number,
  codigo: string,
): Promise<number | null> {
  const r = await client.query<{ id: string }>(
    `SELECT id::text FROM public.linea
     WHERE proveedor_id = $1 AND codigo_proveedor = CAST($2 AS bigint) LIMIT 1`,
    [proveedorId, codigo],
  );
  return r.rows[0]?.id ? Number(r.rows[0].id) : null;
}

async function fetchLowerLinea(
  client: PoolClient,
  proveedorId: number,
  lineNum: number,
): Promise<LineaTpl | null> {
  const r = await client.query<LineaTpl>(
    `SELECT l.id, l.marca_id, l.genero_id, l.grupo_estilo_id
     FROM public.linea l
     WHERE l.proveedor_id = $1
       AND l.codigo_proveedor < $2
       AND trim(l.codigo_proveedor::text) ~ '^[0-9]+$'
     ORDER BY l.codigo_proveedor DESC
     LIMIT 1`,
    [proveedorId, lineNum],
  );
  return r.rows[0] ?? null;
}

async function upsertMaterial(
  client: PoolClient,
  proveedorId: number,
  codigo: string,
): Promise<number> {
  const r = await client.query<{ id: string }>(
    `INSERT INTO public.material (codigo_proveedor, proveedor_id, activo)
     VALUES (CAST($1 AS bigint), $2, true)
     ON CONFLICT (proveedor_id, codigo_proveedor) DO NOTHING
     RETURNING id::text`,
    [codigo, proveedorId],
  );
  if (r.rows[0]?.id) return Number(r.rows[0].id);
  const ex = await client.query<{ id: string }>(
    `SELECT id::text FROM public.material
     WHERE proveedor_id = $1 AND codigo_proveedor = CAST($2 AS bigint) LIMIT 1`,
    [proveedorId, codigo],
  );
  return Number(ex.rows[0]!.id);
}

async function upsertColor(
  client: PoolClient,
  proveedorId: number,
  codigo: string,
): Promise<number | null> {
  if (!codigo) return null;
  const r = await client.query<{ id: string }>(
    `INSERT INTO public.color (codigo_proveedor, proveedor_id, activo)
     VALUES (CAST($1 AS bigint), $2, true)
     ON CONFLICT (proveedor_id, codigo_proveedor) DO NOTHING
     RETURNING id::text`,
    [codigo, proveedorId],
  );
  if (r.rows[0]?.id) return Number(r.rows[0].id);
  const ex = await client.query<{ id: string }>(
    `SELECT id::text FROM public.color
     WHERE proveedor_id = $1 AND codigo_proveedor = CAST($2 AS bigint) LIMIT 1`,
    [proveedorId, codigo],
  );
  return ex.rows[0]?.id ? Number(ex.rows[0].id) : null;
}

async function upsertLineaCalzado(
  client: PoolClient,
  codigo: string,
  proveedorId: number,
  codGrupo: string,
): Promise<number> {
  const existing = await lineaExists(client, proveedorId, codigo);
  if (existing) return existing;

  const lineNum = Number(codigo);
  const tpl = Number.isFinite(lineNum) ? await fetchLowerLinea(client, proveedorId, lineNum) : null;
  const g = codGrupo.trim().padStart(2, "0");
  const marcaHint = GRUPO_ID_MARCA[g] ?? null;

  let marcaId = tpl?.marca_id ?? marcaHint;
  let generoId = tpl?.genero_id ?? null;
  let grupoEstiloId = tpl?.grupo_estilo_id ?? null;
  if (marcaHint != null) marcaId = marcaHint;

  const r = await client.query<{ id: string }>(
    `INSERT INTO public.linea (
       codigo_proveedor, proveedor_id, marca_id, genero_id, grupo_estilo_id, activo
     ) VALUES (CAST($1 AS bigint), $2, $3, $4, $5, true)
     ON CONFLICT (proveedor_id, codigo_proveedor) DO UPDATE SET
       marca_id = COALESCE(linea.marca_id, EXCLUDED.marca_id),
       genero_id = COALESCE(linea.genero_id, EXCLUDED.genero_id),
       grupo_estilo_id = COALESCE(linea.grupo_estilo_id, EXCLUDED.grupo_estilo_id)
     RETURNING id::text`,
    [codigo, proveedorId, marcaId, generoId, grupoEstiloId],
  );
  return Number(r.rows[0]!.id);
}

async function upsertLineaConfeccion(
  client: PoolClient,
  codigoBigint: string,
  proveedorId: number,
  codGrupo: string,
): Promise<number> {
  const existing = await client.query<{ id: string }>(
    `SELECT id::text FROM public.linea
     WHERE proveedor_id = $1 AND codigo_proveedor = CAST($2 AS bigint) LIMIT 1`,
    [proveedorId, codigoBigint],
  );
  if (existing.rows[0]?.id) return Number(existing.rows[0].id);

  const g = codGrupo.trim().padStart(2, "0");
  const marcaId = GRUPO_ID_MARCA[g] ?? null;

  const r = await client.query<{ id: string }>(
    `INSERT INTO public.linea (codigo_proveedor, proveedor_id, marca_id, activo)
     VALUES (CAST($1 AS bigint), $2, $3, true)
     ON CONFLICT (proveedor_id, codigo_proveedor) DO NOTHING
     RETURNING id::text`,
    [codigoBigint, proveedorId, marcaId],
  );
  if (r.rows[0]?.id) return Number(r.rows[0].id);
  const ex = await client.query<{ id: string }>(
    `SELECT id::text FROM public.linea
     WHERE proveedor_id = $1 AND codigo_proveedor = CAST($2 AS bigint) LIMIT 1`,
    [proveedorId, codigoBigint],
  );
  return Number(ex.rows[0]!.id);
}

async function upsertReferencia(
  client: PoolClient,
  proveedorId: number,
  lineaId: number,
  refCodigo: string,
): Promise<number> {
  const r = await client.query<{ id: string }>(
    `INSERT INTO public.referencia (codigo_proveedor, linea_id, proveedor_id, activo)
     VALUES (CAST($1 AS bigint), $2, $3, true)
     ON CONFLICT (proveedor_id, linea_id, codigo_proveedor) DO NOTHING
     RETURNING id::text`,
    [refCodigo, lineaId, proveedorId],
  );
  if (r.rows[0]?.id) return Number(r.rows[0].id);
  const ex = await client.query<{ id: string }>(
    `SELECT id::text FROM public.referencia
     WHERE proveedor_id = $1 AND linea_id = $2 AND codigo_proveedor = CAST($3 AS bigint) LIMIT 1`,
    [proveedorId, lineaId, refCodigo],
  );
  return Number(ex.rows[0]!.id);
}

async function fetchLrTemplateSameLine(
  client: PoolClient,
  proveedorId: number,
  lineaId: number,
  refNum: number,
): Promise<LrTpl | null> {
  const r = await client.query<LrTpl>(
    `SELECT lr.grupo_estilo_id, lr.tipo_1_id
     FROM public.linea_referencia lr
     INNER JOIN public.referencia r ON r.id = lr.referencia_id AND r.proveedor_id = lr.proveedor_id
     WHERE lr.proveedor_id = $1 AND lr.linea_id = $2
       AND r.codigo_proveedor < $3
       AND trim(r.codigo_proveedor::text) ~ '^[0-9]+$'
     ORDER BY r.codigo_proveedor DESC
     LIMIT 1`,
    [proveedorId, lineaId, refNum],
  );
  return r.rows[0] ?? null;
}

async function upsertLineaReferencia(
  client: PoolClient,
  proveedorId: number,
  lineaId: number,
  referenciaId: number,
  refNum: number | null,
  fallbackGe: number | null,
): Promise<void> {
  const ex = await client.query(
    `SELECT 1 FROM public.linea_referencia
     WHERE proveedor_id = $1 AND linea_id = $2 AND referencia_id = $3 LIMIT 1`,
    [proveedorId, lineaId, referenciaId],
  );
  if (ex.rowCount) return;

  let ge = fallbackGe;
  let t1: number | null = null;
  if (refNum != null && Number.isFinite(refNum)) {
    const tpl = await fetchLrTemplateSameLine(client, proveedorId, lineaId, refNum);
    if (tpl) {
      ge = tpl.grupo_estilo_id ?? ge;
      t1 = tpl.tipo_1_id;
    }
  }

  await client.query(
    `INSERT INTO public.linea_referencia (
       proveedor_id, linea_id, referencia_id, grupo_estilo_id, tipo_1_id, activo
     ) VALUES ($1, $2, $3, $4, $5, true)`,
    [proveedorId, lineaId, referenciaId, ge, t1],
  );
}

/** Provisiona pilares únicos antes de INSERT depósito. */
export async function provisionPilaresForImportLines(
  client: PoolClient,
  lines: CsvImportLine[],
): Promise<PilaresProvisionStats> {
  const t0 = Date.now();
  const stats: PilaresProvisionStats = {
    lineas: 0,
    referencias: 0,
    materiales: 0,
    colores: 0,
    linea_referencia: 0,
    duracion_ms: 0,
  };

  const molecules = uniqMolecules(lines);

  for (const line of molecules) {
    const p = line.pilares;
    const prov = p.proveedor_id;

    const matBefore = await client.query(
      `SELECT 1 FROM public.material WHERE proveedor_id = $1 AND codigo_proveedor = CAST($2 AS bigint) LIMIT 1`,
      [prov, p.material_codigo_bigint],
    );
    await upsertMaterial(client, prov, p.material_codigo_bigint);
    if (!matBefore.rowCount) stats.materiales += 1;

    if (p.color_codigo_bigint) {
      const colBefore = await client.query(
        `SELECT 1 FROM public.color WHERE proveedor_id = $1 AND codigo_proveedor = CAST($2 AS bigint) LIMIT 1`,
        [prov, p.color_codigo_bigint],
      );
      await upsertColor(client, prov, p.color_codigo_bigint);
      if (!colBefore.rowCount) stats.colores += 1;
    }

    let lineaId: number;
    if (p.ramo === "calzado") {
      const before = await lineaExists(client, prov, p.linea_codigo_proveedor);
      lineaId = await upsertLineaCalzado(client, p.linea_codigo_proveedor, prov, line.cod_grupo);
      if (!before) stats.lineas += 1;
    } else {
      const before = await client.query(
        `SELECT 1 FROM public.linea WHERE proveedor_id = $1 AND codigo_proveedor = CAST($2 AS bigint) LIMIT 1`,
        [prov, p.linea_codigo_bigint],
      );
      lineaId = await upsertLineaConfeccion(client, p.linea_codigo_bigint, prov, line.cod_grupo);
      if (!before.rowCount) stats.lineas += 1;
    }

    const refCod =
      p.ramo === "calzado" ? p.referencia_codigo_proveedor : p.referencia_codigo_bigint;
    const refBefore = await client.query(
      `SELECT 1 FROM public.referencia
       WHERE proveedor_id = $1 AND linea_id = $2 AND codigo_proveedor = CAST($3 AS bigint) LIMIT 1`,
      [prov, lineaId, refCod],
    );
    const refId = await upsertReferencia(client, prov, lineaId, refCod);
    if (!refBefore.rowCount) stats.referencias += 1;

    const refNum =
      p.ramo === "calzado" && /^\d+$/.test(p.referencia_codigo_proveedor)
        ? Number(p.referencia_codigo_proveedor)
        : null;
    const lrBefore = await client.query(
      `SELECT 1 FROM public.linea_referencia
       WHERE proveedor_id = $1 AND linea_id = $2 AND referencia_id = $3 LIMIT 1`,
      [prov, lineaId, refId],
    );
    const lineaRow = await client.query<{ grupo_estilo_id: number | null }>(
      `SELECT grupo_estilo_id FROM public.linea WHERE id = $1`,
      [lineaId],
    );
    await upsertLineaReferencia(
      client,
      prov,
      lineaId,
      refId,
      refNum,
      lineaRow.rows[0]?.grupo_estilo_id ?? null,
    );
    if (!lrBefore.rowCount) stats.linea_referencia += 1;
  }

  stats.duracion_ms = Date.now() - t0;
  return stats;
}
