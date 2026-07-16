import type { Pool } from "pg";
import type { TipoV2Id } from "@/lib/pilares/types";
import {
  estiloLabelFromSdrm,
  generoCodigoFromSdrm,
  normLabel,
  proveedorFromRamo,
  ramoFromTipoV2,
  tipo1LabelFromSdrm,
} from "@/lib/pilares/sdrm-pilares-map";
import { syncAmComercialPpd } from "@/lib/stock-pronta-entrega/sync-am-comercial-ppd";

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
  muestra: Array<{
    linea_codigo: string;
    marca: string | null;
    genero: string | null;
    estilo: string | null;
    tipo1: string | null;
    cadena_comercial: string | null;
  }>;
};

export type SdrmMapaApplyResult = {
  batch: string;
  lineas_genero: number;
  lineas_marca: number;
  lr_estilo_tipo1: number;
  maestras_tipo1_creadas: string[];
  maestras_estilo_creadas: string[];
  ppd_am_sync: number;
};

type LineaMapRow = {
  linea_codigo: string;
  ramo: string;
  tipo0: string;
  tipo1: string;
  tipo2: string;
  marca: string;
  cadena_comercial: string;
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
      COALESCE(a.cadena_comercial, 'REGULAR') AS cadena_comercial
    FROM sdrm_articulo_comercial a
    JOIN stock_pronta_entrega_rimec s
      ON btrim(s.codigo_barras) = btrim(a.codigo_barras)
    WHERE lower(btrim(a.batch_label)) = lower(btrim($1))
      AND a.proveedor_id = $2
      AND s.linea_codigo_proveedor IS NOT NULL
    ORDER BY s.linea_codigo_proveedor::text, a.es_liquidacion DESC, a.id DESC
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

async function loadMarcaIds(pool: Pool): Promise<Map<string, number>> {
  const { rows } = await pool.query<{ label: string; id: number }>(
    `SELECT upper(trim(descp_marca)) AS label, id_marca AS id FROM marca_v2`,
  );
  return new Map(rows.map((r) => [r.label, r.id]));
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

async function ensureTipo1(pool: Pool, label: string, created: string[]): Promise<number | null> {
  return ensureTipo1Client(pool, label, created);
}

async function ensureEstilo(pool: Pool, label: string, created: string[]): Promise<number | null> {
  return ensureEstiloClient(pool, label, created);
}

function resolvedFields(
  row: LineaMapRow,
  generoIds: Map<string, number>,
  marcaIds: Map<string, number>,
) {
  const ramo = row.ramo === "CONFECCIONES" ? "CONFECCIONES" : "CALZADOS";
  const genCod = generoCodigoFromSdrm(ramo, row.tipo0, row.tipo2);
  const estiloLbl = estiloLabelFromSdrm(ramo, row.tipo0, row.tipo2);
  const tipo1Lbl = tipo1LabelFromSdrm(ramo, row.tipo0, row.tipo1);
  const marcaId = marcaIds.get(normLabel(row.marca)) ?? null;
  return {
    genero_id: genCod ? generoIds.get(genCod) ?? null : null,
    estilo_label: estiloLbl,
    tipo1_label: tipo1Lbl,
    marca_id: marcaId,
    genero_codigo: genCod,
    cadena_comercial: row.cadena_comercial,
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
  const marcaIds = await loadMarcaIds(pool);

  let pendienteGenero = 0;
  let pendienteEstilo = 0;
  let pendienteTipo1 = 0;
  let pendienteMarca = 0;
  let liquidacion = 0;

  const muestra = lineas.slice(0, 12).map((row) => {
    const r = resolvedFields(row, generoIds, marcaIds);
    return {
      linea_codigo: row.linea_codigo,
      marca: row.marca || null,
      genero: r.genero_codigo,
      estilo: r.estilo_label,
      tipo1: r.tipo1_label,
      cadena_comercial: row.cadena_comercial,
    };
  });

  for (const row of lineas) {
    const r = resolvedFields(row, generoIds, marcaIds);
    if (r.genero_codigo && !r.genero_id) pendienteGenero++;
    if (r.estilo_label) pendienteEstilo++;
    if (r.tipo1_label) pendienteTipo1++;
    if (row.marca && !r.marca_id) pendienteMarca++;
    if (normLabel(row.cadena_comercial) === "LIQUIDACION") liquidacion++;
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
  const marcaIds = await loadMarcaIds(pool);
  const tipo1Created: string[] = [];
  const estiloCreated: string[] = [];

  const estiloCache = new Map<string, number>();
  const tipo1Cache = new Map<string, number>();

  let lineasGenero = 0;
  let lineasMarca = 0;
  let lrUpdated = 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const row of lineas) {
      const r = resolvedFields(row, generoIds, marcaIds);
      const codigo = row.linea_codigo.trim();
      if (!codigo) continue;

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
    maestras_tipo1_creadas: tipo1Created,
    maestras_estilo_creadas: estiloCreated,
    ppd_am_sync: amSync.ppd_actualizados,
  };
}
