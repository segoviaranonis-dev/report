import type { Pool } from "pg";
import type { TipoV2Id } from "@/lib/pilares/types";
import {
  normLabel,
  proveedorFromRamo,
  ramoFromTipoV2,
  resolvePilaresFromCodGrupo,
} from "@/lib/pilares/sdrm-pilares-map";
import { syncAmComercialPpd } from "@/lib/stock-pronta-entrega/sync-am-comercial-ppd";

export type SdrmCoberturaPilares = {
  lineas_totales: number;
  con_marca_pct: number;
  con_genero_pct: number;
  con_tipo1_pct: number;
  con_estilo_pct: number;
  con_marca: number;
  con_genero: number;
  con_tipo1: number;
  con_estilo: number;
};

export type SdrmColorBackfillGate = {
  blocked: true;
  message: string;
};

export type SdrmMapaPreview = {
  batch: string;
  tipo_v2_id: TipoV2Id;
  proveedor_id: number;
  lineas_distintas: number;
  liquidacion_articulos: number;
  pendiente_genero: number;
  pendiente_estilo: number;
  pendiente_tipo1: number;
  pendiente_marca: number;
  conflictos_label_digito: number;
  cobertura: SdrmCoberturaPilares | null;
  color_backfill_gate: SdrmColorBackfillGate;
  muestra: Array<{
    linea_codigo: string;
    cod_grupo: string | null;
    marca: string | null;
    genero: string | null;
    estilo: string | null;
    tipo1: string | null;
    cadena_comercial: string | null;
    conflictos: string[];
  }>;
};

export type SdrmMapaApplyResult = {
  batch: string;
  lineas_genero: number;
  lineas_marca: number;
  lr_estilo_tipo1: number;
  cadena_sdrm_actualizada: number;
  maestras_tipo1_creadas: string[];
  maestras_estilo_creadas: string[];
  ppd_am_sync: number;
  conflictos_registrados: number;
};

type LineaMapRow = {
  linea_codigo: string;
  ramo: string;
  tipo0: string;
  tipo1: string;
  tipo2: string;
  marca: string;
  cadena_comercial: string;
  cod_grupo: string;
};

const COLOR_BACKFILL_GATE: SdrmColorBackfillGate = {
  blocked: true,
  message:
    "Backfill colores 638 (FK anti-colisión) requiere OK explícito del Director — no bloquea mapa comercial COD.GRUPO.",
};

async function loadLineaMap(pool: Pool, batch: string, proveedorId: number): Promise<LineaMapRow[]> {
  const { rows } = await pool.query<LineaMapRow>(
    `
    SELECT DISTINCT ON (s.linea_codigo_proveedor::text)
      s.linea_codigo_proveedor::text AS linea_codigo,
      a.ramo,
      COALESCE(a.tipo0, '') AS tipo0,
      COALESCE(a.tipo1, '') AS tipo1,
      COALESCE(a.tipo2, '') AS tipo2,
      COALESCE(a.marca, '') AS marca,
      COALESCE(a.cadena_comercial, 'REGULAR') AS cadena_comercial,
      COALESCE(a.cod_grupo, '') AS cod_grupo
    FROM sdrm_articulo_comercial a
    JOIN stock_pronta_entrega_rimec s
      ON btrim(s.codigo_barras) = btrim(a.codigo_barras)
    WHERE lower(btrim(a.batch_label)) = lower(btrim($1))
      AND a.proveedor_id = $2
      AND s.linea_codigo_proveedor IS NOT NULL
    ORDER BY
      s.linea_codigo_proveedor::text,
      a.es_liquidacion DESC,
      CASE
        WHEN upper(btrim(COALESCE(a.cadena_comercial, ''))) = 'PROMOCIONAL' THEN 1
        ELSE 0
      END DESC,
      a.id DESC
    `,
    [batch, proveedorId],
  );
  return rows;
}

async function loadGeneroIds(pool: Pool): Promise<Map<string, number>> {
  const { rows } = await pool.query<{ codigo: string; id: number }>(
    `SELECT upper(trim(codigo)) AS codigo, id FROM genero`,
  );
  return new Map(rows.map((r) => [r.codigo, r.id]));
}

async function loadCoberturaPilares(
  pool: Pool,
  proveedorId: number,
): Promise<SdrmCoberturaPilares | null> {
  try {
    const { rows } = await pool.query<{
      tot: string;
      con_marca: string;
      con_genero: string;
      con_tipo1: string;
      con_estilo: string;
    }>(
      `
      SELECT
        COUNT(DISTINCT l.id)::text AS tot,
        COUNT(DISTINCT l.id) FILTER (WHERE l.marca_id IS NOT NULL)::text AS con_marca,
        COUNT(DISTINCT l.id) FILTER (WHERE l.genero_id IS NOT NULL)::text AS con_genero,
        COUNT(DISTINCT l.id) FILTER (
          WHERE EXISTS (
            SELECT 1 FROM linea_referencia lr
            WHERE lr.linea_id = l.id AND lr.tipo_1_id IS NOT NULL
          )
        )::text AS con_tipo1,
        COUNT(DISTINCT l.id) FILTER (
          WHERE EXISTS (
            SELECT 1 FROM linea_referencia lr
            WHERE lr.linea_id = l.id AND lr.grupo_estilo_id IS NOT NULL
          )
        )::text AS con_estilo
      FROM linea l
      WHERE l.proveedor_id = $1 AND l.activo = true
      `,
      [proveedorId],
    );
    const r = rows[0];
    if (!r) return null;
    const tot = Number(r.tot) || 0;
    const pct = (n: number) => (tot === 0 ? 0 : Math.round((n / tot) * 1000) / 10);
    const con_marca = Number(r.con_marca) || 0;
    const con_genero = Number(r.con_genero) || 0;
    const con_tipo1 = Number(r.con_tipo1) || 0;
    const con_estilo = Number(r.con_estilo) || 0;
    return {
      lineas_totales: tot,
      con_marca,
      con_genero,
      con_tipo1,
      con_estilo,
      con_marca_pct: pct(con_marca),
      con_genero_pct: pct(con_genero),
      con_tipo1_pct: pct(con_tipo1),
      con_estilo_pct: pct(con_estilo),
    };
  } catch {
    return null;
  }
}

async function ensureTipo1Client(
  client: { query: Pool["query"] },
  label: string,
  created: string[],
): Promise<number | null> {
  const norm = normLabel(label);
  if (!norm) return null;
  const found = await client.query<{ id: number }>(
    `SELECT id_tipo_1 AS id FROM tipo_1 WHERE upper(trim(descp_tipo_1)) = $1 LIMIT 1`,
    [norm],
  );
  if (found.rows[0]?.id) return found.rows[0].id;
  const next = await client.query<{ id: number }>(`SELECT COALESCE(MAX(id_tipo_1), 0) + 1 AS id FROM tipo_1`);
  const id = next.rows[0]?.id;
  if (!id) return null;
  await client.query(`INSERT INTO tipo_1 (id_tipo_1, descp_tipo_1, id_proveedor) VALUES ($1, $2, 1)`, [
    id,
    norm,
  ]);
  created.push(norm);
  return id;
}

async function ensureEstiloClient(
  client: { query: Pool["query"] },
  label: string,
  created: string[],
): Promise<number | null> {
  const norm = normLabel(label);
  if (!norm) return null;
  const found = await client.query<{ id: number }>(
    `SELECT id_grupo_estilo AS id FROM grupo_estilo_v2 WHERE upper(trim(descp_grupo_estilo)) = $1 LIMIT 1`,
    [norm],
  );
  if (found.rows[0]?.id) return found.rows[0].id;
  const next = await client.query<{ id: number }>(
    `SELECT COALESCE(MAX(id_grupo_estilo), 0) + 1000 AS id FROM grupo_estilo_v2`,
  );
  const id = next.rows[0]?.id;
  if (!id) return null;
  await client.query(
    `INSERT INTO grupo_estilo_v2 (id_grupo_estilo, descp_grupo_estilo, id_proveedor) VALUES ($1, $2, 1)`,
    [id, norm],
  );
  created.push(norm);
  return id;
}

function resolvedFields(row: LineaMapRow, generoIds: Map<string, number>) {
  const ramoHint = row.ramo === "CONFECCIONES" ? "CONFECCIONES" : "CALZADOS";
  const r = resolvePilaresFromCodGrupo({
    cod_grupo: row.cod_grupo,
    marca: row.marca,
    tipo0: row.tipo0,
    tipo1: row.tipo1,
    tipo2: row.tipo2,
    cadena: row.cadena_comercial,
    ramoHint,
  });
  return {
    genero_id: r.genero_codigo ? (generoIds.get(r.genero_codigo) ?? null) : null,
    estilo_label: r.estilo_label,
    tipo1_label: r.tipo1_label,
    marca_id: r.marca_id,
    genero_codigo: r.genero_codigo,
    cadena_comercial: r.cadena_comercial,
    cod_grupo: r.decoded.ok ? r.decoded.raw : row.cod_grupo || null,
    conflictos: r.decoded.conflictos,
  };
}

export async function previewMapaSdrmPilares(
  pool: Pool,
  batch: string,
  tipoV2Id: TipoV2Id,
): Promise<SdrmMapaPreview> {
  const proveedorId = proveedorFromRamo(ramoFromTipoV2(tipoV2Id));
  const lineas = await loadLineaMap(pool, batch, proveedorId);
  const generoIds = await loadGeneroIds(pool);
  const cobertura = await loadCoberturaPilares(pool, proveedorId);

  let pendienteGenero = 0;
  let pendienteEstilo = 0;
  let pendienteTipo1 = 0;
  let pendienteMarca = 0;
  let liquidacion = 0;
  let conflictos = 0;

  const muestra = lineas.slice(0, 12).map((row) => {
    const r = resolvedFields(row, generoIds);
    return {
      linea_codigo: row.linea_codigo,
      cod_grupo: r.cod_grupo,
      marca: row.marca || null,
      genero: r.genero_codigo,
      estilo: r.estilo_label,
      tipo1: r.tipo1_label,
      cadena_comercial: r.cadena_comercial,
      conflictos: r.conflictos,
    };
  });

  for (const row of lineas) {
    const r = resolvedFields(row, generoIds);
    if (r.genero_codigo && !r.genero_id) pendienteGenero++;
    if (r.estilo_label) pendienteEstilo++;
    if (r.tipo1_label) pendienteTipo1++;
    if (!r.marca_id) pendienteMarca++;
    if (normLabel(r.cadena_comercial) === "LIQUIDACION") liquidacion++;
    if (r.conflictos.length) conflictos++;
  }

  return {
    batch,
    tipo_v2_id: tipoV2Id,
    proveedor_id: proveedorId,
    lineas_distintas: lineas.length,
    liquidacion_articulos: liquidacion,
    pendiente_genero: pendienteGenero,
    pendiente_estilo: pendienteEstilo,
    pendiente_tipo1: pendienteTipo1,
    pendiente_marca: pendienteMarca,
    conflictos_label_digito: conflictos,
    cobertura,
    color_backfill_gate: COLOR_BACKFILL_GATE,
    muestra,
  };
}

export async function aplicarMapaSdrmPilares(
  pool: Pool,
  batch: string,
  tipoV2Id: TipoV2Id,
): Promise<SdrmMapaApplyResult> {
  const proveedorId = proveedorFromRamo(ramoFromTipoV2(tipoV2Id));
  const lineas = await loadLineaMap(pool, batch, proveedorId);
  const generoIds = await loadGeneroIds(pool);
  const tipo1Created: string[] = [];
  const estiloCreated: string[] = [];

  const estiloCache = new Map<string, number>();
  const tipo1Cache = new Map<string, number>();

  let lineasGenero = 0;
  let lineasMarca = 0;
  let lrUpdated = 0;
  let cadenaUpdated = 0;
  let conflictosRegistrados = 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const row of lineas) {
      const r = resolvedFields(row, generoIds);
      const codigo = row.linea_codigo.trim();
      if (!codigo) continue;
      if (r.conflictos.length) conflictosRegistrados++;

      if (r.genero_id != null) {
        const g = await client.query(
          `UPDATE linea SET genero_id = $1 WHERE proveedor_id = $2 AND activo = true AND codigo_proveedor::text = $3`,
          [r.genero_id, proveedorId, codigo],
        );
        lineasGenero += g.rowCount ?? 0;
      }

      if (r.marca_id != null) {
        const m = await client.query(
          `UPDATE linea SET marca_id = $1 WHERE proveedor_id = $2 AND activo = true AND codigo_proveedor::text = $3`,
          [r.marca_id, proveedorId, codigo],
        );
        lineasMarca += m.rowCount ?? 0;
      }

      let estiloId: number | null = null;
      if (r.estilo_label) {
        const key = normLabel(r.estilo_label);
        if (!estiloCache.has(key)) {
          estiloCache.set(key, (await ensureEstiloClient(client, key, estiloCreated)) ?? 0);
        }
        estiloId = estiloCache.get(key) || null;
      }

      let tipo1Id: number | null = null;
      if (r.tipo1_label) {
        const key = normLabel(r.tipo1_label);
        if (!tipo1Cache.has(key)) {
          tipo1Cache.set(key, (await ensureTipo1Client(client, key, tipo1Created)) ?? 0);
        }
        tipo1Id = tipo1Cache.get(key) || null;
      }

      if (estiloId || tipo1Id) {
        const sets: string[] = [];
        const params: unknown[] = [proveedorId, codigo];
        if (estiloId) {
          params.push(estiloId);
          sets.push(`grupo_estilo_id = $${params.length}`);
        }
        if (tipo1Id) {
          params.push(tipo1Id);
          sets.push(`tipo_1_id = $${params.length}`);
        }
        const lr = await client.query(
          `
          UPDATE linea_referencia lr
          SET ${sets.join(", ")}
          FROM linea l
          WHERE l.id = lr.linea_id
            AND lr.proveedor_id = $1
            AND l.proveedor_id = $1
            AND l.activo = true
            AND l.codigo_proveedor::text = $2
          `,
          params,
        );
        lrUpdated += lr.rowCount ?? 0;
      }

      if (r.cadena_comercial && r.cod_grupo) {
        const esLiq = normLabel(r.cadena_comercial) === "LIQUIDACION";
        const esPromo = normLabel(r.cadena_comercial) === "PROMOCIONAL";
        const c = await client.query(
          `
          UPDATE sdrm_articulo_comercial
          SET cadena_comercial = $1,
              es_liquidacion = $2,
              es_promo = $3,
              updated_at = now()
          WHERE lower(btrim(batch_label)) = lower(btrim($4))
            AND proveedor_id = $5
            AND btrim(cod_grupo) = btrim($6)
          `,
          [r.cadena_comercial, esLiq, esPromo, batch, proveedorId, r.cod_grupo],
        );
        cadenaUpdated += c.rowCount ?? 0;
      }
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  const amSync = await syncAmComercialPpd(pool, batch);

  return {
    batch,
    lineas_genero: lineasGenero,
    lineas_marca: lineasMarca,
    lr_estilo_tipo1: lrUpdated,
    cadena_sdrm_actualizada: cadenaUpdated,
    maestras_tipo1_creadas: tipo1Created,
    maestras_estilo_creadas: estiloCreated,
    ppd_am_sync: amSync.ppd_actualizados,
    conflictos_registrados: conflictosRegistrados,
  };
}
