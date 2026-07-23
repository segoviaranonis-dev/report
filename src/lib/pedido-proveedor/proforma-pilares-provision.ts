/**
 * Provisión pilares en import proforma — paridad motor compartido + Retail 1.1/1.2.
 * Orden: codigo_proveedor numérico ASC (L↑ R↑) — herencia vecino inferior, NO id interno.
 */

import type { PgQueryable } from "@/lib/pedido-proveedor/pilares-proforma-upsert";
import { generoCodigoPorMarca, CODIGOS_GENERO_BD } from "@/lib/motor-precios/ley-genero";
import type { ProformaRow } from "@/lib/pedido-proveedor/parse-proforma";
import { brandEsCasoComercial } from "@/lib/pedido-proveedor/resolve-caso-comercial";
import {
  upsertColorProforma,
  upsertMaterialProforma,
} from "@/lib/pedido-proveedor/pilares-proforma-upsert";

export type ProformaPilaresStats = {
  lineas_nuevas: number;
  /** Códigos de línea insertados en este lote (para aviso post-import). */
  lineas_nuevas_codigos: string[];
  lineas_enriquecidas: number;
  referencias_nuevas: number;
  linea_referencia_nuevas: number;
  materiales_tocados: number;
  colores_tocados: number;
  tonos_asignados: number;
  duracion_ms: number;
};

type Mol = {
  linea: string;
  referencia: string;
  material_code: string;
  color_code: string;
  material: string;
  color: string;
  brand: string;
};

type LineaTpl = {
  id: number;
  marca_id: number | null;
  genero_id: number | null;
  grupo_estilo_id: number | null;
};

function codigoLineaNum(raw: string): number | null {
  const s = String(raw ?? "").trim().split(/[.\s]/)[0]?.replace(/[^\d]/g, "") ?? "";
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function codigoRefNum(raw: string): number | null {
  const s = String(raw ?? "").trim().replace(/[^\d]/g, "");
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function uniqMolecules(rows: ProformaRow[]): Mol[] {
  const map = new Map<string, Mol>();
  for (const r of rows) {
    const linea = String(r.linea_codigo_proveedor ?? "").trim();
    if (!linea) continue;
    const referencia = String(r.referencia_codigo_proveedor ?? "").trim();
    const material_code = String(r.material_code ?? "").trim();
    const color_code = String(r.color_code ?? "").trim();
    const key = `${linea}\0${referencia}\0${material_code}\0${color_code}`;
    const prev = map.get(key);
    const material = String(r.material ?? "").trim();
    const color = String(r.color ?? "").trim();
    const brand = String(r.brand ?? "").trim();
    if (!prev) {
      map.set(key, { linea, referencia, material_code, color_code, material, color, brand });
    } else {
      if (!prev.material && material) prev.material = material;
      if (!prev.color && color) prev.color = color;
      if (!prev.brand && brand) prev.brand = brand;
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const la = codigoLineaNum(a.linea) ?? 0;
    const lb = codigoLineaNum(b.linea) ?? 0;
    if (la !== lb) return la - lb;
    return (codigoRefNum(a.referencia) ?? 0) - (codigoRefNum(b.referencia) ?? 0);
  });
}

function uniqLineasSorted(mols: Mol[]): Array<{ linea: string; brand: string }> {
  const map = new Map<string, string>();
  for (const m of mols) {
    if (!map.has(m.linea)) map.set(m.linea, m.brand);
    else if (!map.get(m.linea) && m.brand) map.set(m.linea, m.brand);
  }
  return Array.from(map.entries())
    .map(([linea, brand]) => ({ linea, brand }))
    .sort((a, b) => (codigoLineaNum(a.linea) ?? 0) - (codigoLineaNum(b.linea) ?? 0));
}

async function lookupGeneroId(client: PgQueryable, marcaNombre: string): Promise<number | null> {
  const cod = generoCodigoPorMarca(marcaNombre);
  if (!cod) return null;
  const variantes = CODIGOS_GENERO_BD[cod] ?? [cod];
  for (const v of variantes) {
    const { rows } = await client.query<{ id: string }>(
      `SELECT id FROM genero
       WHERE COALESCE(activo, true)
         AND (
           UPPER(TRIM(codigo)) = UPPER(TRIM($1))
           OR UPPER(TRIM(COALESCE(descripcion, ''))) = UPPER(TRIM($1))
         )
       LIMIT 1`,
      [v],
    );
    if (rows[0]) return Number(rows[0].id);
  }
  return null;
}

async function fetchLowerLineaConEstilo(
  client: PgQueryable,
  proveedorId: number,
  lineNum: number,
): Promise<LineaTpl | null> {
  const { rows } = await client.query<LineaTpl>(
    `SELECT l.id, l.marca_id, l.genero_id, l.grupo_estilo_id
     FROM public.linea l
     WHERE l.proveedor_id = $1
       AND l.codigo_proveedor < $2::bigint
       AND trim(l.codigo_proveedor::text) ~ '^[0-9]+$'
       AND l.grupo_estilo_id IS NOT NULL
     ORDER BY l.codigo_proveedor DESC
     LIMIT 1`,
    [proveedorId, lineNum],
  );
  return rows[0] ?? null;
}

async function fetchUpperLinea(
  client: PgQueryable,
  proveedorId: number,
  lineNum: number,
): Promise<LineaTpl | null> {
  const { rows } = await client.query<LineaTpl>(
    `SELECT l.id, l.marca_id, l.genero_id, l.grupo_estilo_id
     FROM public.linea l
     WHERE l.proveedor_id = $1
       AND l.codigo_proveedor > $2::bigint
       AND trim(l.codigo_proveedor::text) ~ '^[0-9]+$'
       AND l.grupo_estilo_id IS NOT NULL
     ORDER BY l.codigo_proveedor ASC
     LIMIT 1`,
    [proveedorId, lineNum],
  );
  return rows[0] ?? null;
}
async function fetchLowerLinea(
  client: PgQueryable,
  proveedorId: number,
  lineNum: number,
): Promise<LineaTpl | null> {
  const { rows } = await client.query<LineaTpl>(
    `SELECT l.id, l.marca_id, l.genero_id, l.grupo_estilo_id
     FROM public.linea l
     WHERE l.proveedor_id = $1
       AND l.codigo_proveedor < $2::bigint
       AND trim(l.codigo_proveedor::text) ~ '^[0-9]+$'
     ORDER BY l.codigo_proveedor DESC
     LIMIT 1`,
    [proveedorId, lineNum],
  );
  return rows[0] ?? null;
}

async function getLineaByCodigo(
  client: PgQueryable,
  proveedorId: number,
  lineaCod: string,
): Promise<LineaTpl | null> {
  const { rows } = await client.query<LineaTpl>(
    `SELECT id, marca_id, genero_id, grupo_estilo_id
     FROM public.linea
     WHERE proveedor_id = $1 AND codigo_proveedor::text = $2
     LIMIT 1`,
    [proveedorId, lineaCod],
  );
  return rows[0] ?? null;
}

async function ensureLinea(
  client: PgQueryable,
  proveedorId: number,
  lineaCod: string,
  brand: string,
  marcaLookup: Map<string, number>,
  stats: ProformaPilaresStats,
  prevInBatch: { marca_id: number | null; genero_id: number | null; grupo_estilo_id: number | null } | null,
  casosEvento: Set<string>,
): Promise<number> {
  const lineNum = codigoLineaNum(lineaCod);
  const brandKey = brand.trim().toUpperCase();
  const brandEsCaso = brandEsCasoComercial(brandKey, casosEvento);
  const marcaFromBrand =
    brandKey && !brandEsCaso ? marcaLookup.get(brandKey) ?? null : null;
  const generoFromLey = brand && !brandEsCaso ? await lookupGeneroId(client, brand) : null;

  const existing = await getLineaByCodigo(client, proveedorId, lineaCod);
  const tplDb = lineNum != null ? await fetchLowerLinea(client, proveedorId, lineNum) : null;
  const tpl = prevInBatch ?? tplDb;

  let marcaId = existing?.marca_id ?? tpl?.marca_id ?? marcaFromBrand ?? null;
  let generoId = existing?.genero_id ?? tpl?.genero_id ?? generoFromLey ?? null;
  let grupoEstiloId = existing?.grupo_estilo_id ?? tpl?.grupo_estilo_id ?? null;

  if (marcaFromBrand != null) marcaId = marcaFromBrand;
  if (generoId == null && generoFromLey != null) generoId = generoFromLey;
  if (grupoEstiloId == null && tplDb?.grupo_estilo_id != null) grupoEstiloId = tplDb.grupo_estilo_id;
  if (grupoEstiloId == null && lineNum != null) {
    const lowerEst = await fetchLowerLineaConEstilo(client, proveedorId, lineNum);
    if (lowerEst?.grupo_estilo_id != null) grupoEstiloId = lowerEst.grupo_estilo_id;
    if (generoId == null && lowerEst?.genero_id != null) generoId = lowerEst.genero_id;
    if (marcaId == null && lowerEst?.marca_id != null) marcaId = lowerEst.marca_id;
  }
  if (grupoEstiloId == null && lineNum != null) {
    const upper = await fetchUpperLinea(client, proveedorId, lineNum);
    if (upper?.grupo_estilo_id != null) grupoEstiloId = upper.grupo_estilo_id;
    if (generoId == null && upper?.genero_id != null) generoId = upper.genero_id;
    if (marcaId == null && upper?.marca_id != null) marcaId = upper.marca_id;
  }

  if (existing) {
    const { rowCount } = await client.query(
      `UPDATE public.linea SET
         marca_id = COALESCE(marca_id, $3),
         genero_id = COALESCE(genero_id, $4),
         grupo_estilo_id = COALESCE(grupo_estilo_id, $5)
       WHERE id = $1 AND proveedor_id = $2
         AND (marca_id IS NULL OR genero_id IS NULL OR grupo_estilo_id IS NULL)`,
      [existing.id, proveedorId, marcaId, generoId, grupoEstiloId],
    );
    if (rowCount) stats.lineas_enriquecidas += 1;
    return existing.id;
  }

  const ins = await client.query<{ id: string }>(
    `INSERT INTO public.linea (
       codigo_proveedor, proveedor_id, marca_id, genero_id, grupo_estilo_id, activo
     ) VALUES ($1::bigint, $2, $3, $4, $5, true)
     ON CONFLICT (proveedor_id, codigo_proveedor) DO UPDATE SET
       marca_id = COALESCE(linea.marca_id, EXCLUDED.marca_id),
       genero_id = COALESCE(linea.genero_id, EXCLUDED.genero_id),
       grupo_estilo_id = COALESCE(linea.grupo_estilo_id, EXCLUDED.grupo_estilo_id)
     RETURNING id::text`,
    [lineaCod, proveedorId, marcaId, generoId, grupoEstiloId],
  );
  stats.lineas_nuevas += 1;
  const codNorm = lineNum != null ? String(lineNum) : String(lineaCod).trim();
  if (codNorm && !stats.lineas_nuevas_codigos.includes(codNorm)) {
    stats.lineas_nuevas_codigos.push(codNorm);
  }
  return Number(ins.rows[0]!.id);
}

async function ensureReferencia(
  client: PgQueryable,
  proveedorId: number,
  lineaId: number,
  refCod: string,
  stats: ProformaPilaresStats,
): Promise<number> {
  const ex = await client.query<{ id: string }>(
    `SELECT id::text FROM public.referencia
     WHERE proveedor_id = $1 AND linea_id = $2 AND codigo_proveedor::text = $3 LIMIT 1`,
    [proveedorId, lineaId, refCod],
  );
  if (ex.rows[0]) return Number(ex.rows[0].id);

  const ins = await client.query<{ id: string }>(
    `INSERT INTO public.referencia (codigo_proveedor, linea_id, proveedor_id, activo)
     VALUES ($1::bigint, $2, $3, true)
     ON CONFLICT (proveedor_id, linea_id, codigo_proveedor) DO NOTHING
     RETURNING id::text`,
    [refCod, lineaId, proveedorId],
  );
  if (ins.rows[0]) {
    stats.referencias_nuevas += 1;
    return Number(ins.rows[0].id);
  }
  const retry = await client.query<{ id: string }>(
    `SELECT id::text FROM public.referencia
     WHERE proveedor_id = $1 AND linea_id = $2 AND codigo_proveedor::text = $3 LIMIT 1`,
    [proveedorId, lineaId, refCod],
  );
  return Number(retry.rows[0]!.id);
}

async function fetchLrTemplateSameLine(
  client: PgQueryable,
  proveedorId: number,
  lineaId: number,
  refNum: number,
): Promise<{ grupo_estilo_id: number | null; tipo_1_id: number | null } | null> {
  const lower = await client.query<{ grupo_estilo_id: number | null; tipo_1_id: number | null }>(
    `SELECT lr.grupo_estilo_id, lr.tipo_1_id
     FROM public.linea_referencia lr
     INNER JOIN public.referencia r ON r.id = lr.referencia_id AND r.proveedor_id = lr.proveedor_id
     WHERE lr.proveedor_id = $1 AND lr.linea_id = $2
       AND r.codigo_proveedor < $3::bigint
       AND trim(r.codigo_proveedor::text) ~ '^[0-9]+$'
     ORDER BY r.codigo_proveedor DESC
     LIMIT 1`,
    [proveedorId, lineaId, refNum],
  );
  if (lower.rows[0]?.grupo_estilo_id != null) return lower.rows[0];

  const upper = await client.query<{ grupo_estilo_id: number | null; tipo_1_id: number | null }>(
    `SELECT lr.grupo_estilo_id, lr.tipo_1_id
     FROM public.linea_referencia lr
     INNER JOIN public.referencia r ON r.id = lr.referencia_id AND r.proveedor_id = lr.proveedor_id
     WHERE lr.proveedor_id = $1 AND lr.linea_id = $2
       AND r.codigo_proveedor > $3::bigint
       AND trim(r.codigo_proveedor::text) ~ '^[0-9]+$'
       AND lr.grupo_estilo_id IS NOT NULL
     ORDER BY r.codigo_proveedor ASC
     LIMIT 1`,
    [proveedorId, lineaId, refNum],
  );
  return upper.rows[0] ?? lower.rows[0] ?? null;
}

async function ensureLineaReferencia(
  client: PgQueryable,
  proveedorId: number,
  lineaId: number,
  referenciaId: number,
  refCod: string,
  fallbackEstilo: number | null,
  stats: ProformaPilaresStats,
): Promise<void> {
  const ex = await client.query(
    `SELECT grupo_estilo_id, tipo_1_id FROM public.linea_referencia
     WHERE proveedor_id = $1 AND linea_id = $2 AND referencia_id = $3 LIMIT 1`,
    [proveedorId, lineaId, referenciaId],
  );
  if (ex.rowCount) {
    const row = ex.rows[0] as { grupo_estilo_id: number | null; tipo_1_id: number | null };
    const refNum = codigoRefNum(refCod);
    let ge = row.grupo_estilo_id;
    let t1 = row.tipo_1_id;
    if (refNum != null) {
      const tpl = await fetchLrTemplateSameLine(client, proveedorId, lineaId, refNum);
      if (tpl) {
        ge = ge ?? tpl.grupo_estilo_id ?? fallbackEstilo;
        t1 = t1 ?? tpl.tipo_1_id;
      }
    }
    if (ge == null) ge = fallbackEstilo;
    await client.query(
      `UPDATE public.linea_referencia SET
         grupo_estilo_id = COALESCE(grupo_estilo_id, $4),
         tipo_1_id = COALESCE(tipo_1_id, $5)
       WHERE proveedor_id = $1 AND linea_id = $2 AND referencia_id = $3
         AND (grupo_estilo_id IS NULL OR tipo_1_id IS NULL)`,
      [proveedorId, lineaId, referenciaId, ge, t1],
    );
    return;
  }

  const refNum = codigoRefNum(refCod);
  let ge = fallbackEstilo;
  let t1: number | null = null;
  if (refNum != null) {
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
  stats.linea_referencia_nuevas += 1;
}

/** Motor pilares completo — invocar antes de INSERT PPD. */
export async function provisionPilaresFromProforma(
  client: PgQueryable,
  proveedorId: number,
  detalleRows: ProformaRow[],
  marcaLookup: Map<string, number>,
  casosEvento: Set<string> = new Set(),
): Promise<ProformaPilaresStats> {
  const t0 = Date.now();
  const stats: ProformaPilaresStats = {
    lineas_nuevas: 0,
    lineas_nuevas_codigos: [],
    lineas_enriquecidas: 0,
    referencias_nuevas: 0,
    linea_referencia_nuevas: 0,
    materiales_tocados: 0,
    colores_tocados: 0,
    tonos_asignados: 0,
    duracion_ms: 0,
  };

  const mols = uniqMolecules(detalleRows);
  if (!mols.length) {
    stats.duracion_ms = Date.now() - t0;
    return stats;
  }

  const matMap = new Map<string, string>();
  const colMap = new Map<string, string>();
  for (const m of mols) {
    if (m.material_code && m.material) matMap.set(m.material_code, m.material);
    if (m.color_code && m.color) colMap.set(m.color_code, m.color);
  }

  for (const [code, desc] of matMap) {
    await upsertMaterialProforma(client, code, proveedorId, desc);
    stats.materiales_tocados += 1;
  }

  for (const [code, desc] of colMap) {
    await upsertColorProforma(client, code, proveedorId, desc);
    stats.colores_tocados += 1;
  }

  const lineaIdCache = new Map<string, number>();
  const lineaAttrsByNum = new Map<
    number,
    { marca_id: number | null; genero_id: number | null; grupo_estilo_id: number | null }
  >();

  for (const { linea, brand } of uniqLineasSorted(mols)) {
    const lineNum = codigoLineaNum(linea);
    const prevAttrs = lineNum != null ? lineaAttrsByNum.get(lineNum - 1) : undefined;
    const id = await ensureLinea(
      client,
      proveedorId,
      linea,
      brand,
      marcaLookup,
      stats,
      prevAttrs ?? null,
      casosEvento,
    );
    lineaIdCache.set(linea, id);
    const row = await client.query<{
      marca_id: number | null;
      genero_id: number | null;
      grupo_estilo_id: number | null;
    }>(`SELECT marca_id, genero_id, grupo_estilo_id FROM public.linea WHERE id = $1`, [id]);
    if (lineNum != null && row.rows[0]) {
      lineaAttrsByNum.set(lineNum, row.rows[0]);
    }
  }

  for (const m of mols) {
    const lineaId = lineaIdCache.get(m.linea)!;
    const refCod = m.referencia || "0";
    const refId = await ensureReferencia(client, proveedorId, lineaId, refCod, stats);
    const lineaRow = await client.query<{ grupo_estilo_id: number | null }>(
      `SELECT grupo_estilo_id FROM public.linea WHERE id = $1`,
      [lineaId],
    );
    const lineNum = codigoLineaNum(m.linea);
    const prevLineEstilo =
      lineNum != null ? lineaAttrsByNum.get(lineNum - 1)?.grupo_estilo_id ?? null : null;
    await ensureLineaReferencia(
      client,
      proveedorId,
      lineaId,
      refId,
      refCod,
      lineaRow.rows[0]?.grupo_estilo_id ?? prevLineEstilo,
      stats,
    );
  }

  stats.duracion_ms = Date.now() - t0;
  return stats;
}
