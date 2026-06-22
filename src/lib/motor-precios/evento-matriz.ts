import type { Pool } from "pg";
import { normalizarCaso, type CasoInput } from "./caso-utils";

async function eventoEstaCerrado(pool: Pool, eventoId: number): Promise<boolean> {
  const { rows } = await pool.query<{ estado: string }>(
    `SELECT estado FROM precio_evento WHERE id = $1`,
    [eventoId],
  );
  return rows[0]?.estado?.toLowerCase() === "cerrado";
}

async function contarSkusProcesados(pool: Pool, eventoId: number): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM precio_lista WHERE evento_id = $1`,
    [eventoId],
  );
  return Number(rows[0]?.n ?? 0);
}

async function eventoIdDeCaso(pool: Pool, casoId: number): Promise<number | null> {
  const { rows } = await pool.query<{ evento_id: string }>(
    `SELECT evento_id FROM precio_evento_caso WHERE id = $1`,
    [casoId],
  );
  return rows[0] ? Number(rows[0].evento_id) : null;
}

function casoDictParaDb(norm: ReturnType<typeof normalizarCaso> & { marcas?: string[] | null; regla_redondeo?: string }) {
  return {
    nombre_caso: norm.nombre_caso,
    dolar_politica: norm.dolar_politica,
    factor_conversion: norm.factor_conversion,
    descuento_1: norm.descuento_1,
    descuento_2: norm.descuento_2,
    descuento_3: norm.descuento_3,
    descuento_4: norm.descuento_4,
    genera_lpc03_lpc04: norm.genera_lpc03_lpc04,
    regla_redondeo: norm.regla_redondeo ?? "centena",
    marcas: norm.marcas ?? null,
  };
}

async function crearCasoEvento(pool: Pool, eventoId: number, caso: ReturnType<typeof casoDictParaDb>): Promise<number> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO precio_evento_caso
       (evento_id, nombre_caso, dolar_politica, factor_conversion,
        descuento_1, descuento_2, descuento_3, descuento_4,
        genera_lpc03_lpc04, regla_redondeo, marcas)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      eventoId,
      caso.nombre_caso,
      caso.dolar_politica,
      caso.factor_conversion,
      caso.descuento_1,
      caso.descuento_2,
      caso.descuento_3,
      caso.descuento_4,
      caso.genera_lpc03_lpc04,
      caso.regla_redondeo,
      caso.marcas,
    ],
  );
  const id = Number(rows[0]?.id);
  if (!id) throw new Error("No se pudo crear el caso en base de datos.");
  return id;
}

async function actualizarCasoEvento(pool: Pool, casoId: number, caso: ReturnType<typeof casoDictParaDb>): Promise<void> {
  await pool.query(
    `UPDATE precio_evento_caso SET
       nombre_caso = $1,
       dolar_politica = $2,
       factor_conversion = $3,
       descuento_1 = $4,
       descuento_2 = $5,
       descuento_3 = $6,
       descuento_4 = $7,
       genera_lpc03_lpc04 = $8,
       regla_redondeo = $9,
       marcas = $10
     WHERE id = $11`,
    [
      caso.nombre_caso,
      caso.dolar_politica,
      caso.factor_conversion,
      caso.descuento_1,
      caso.descuento_2,
      caso.descuento_3,
      caso.descuento_4,
      caso.genera_lpc03_lpc04,
      caso.regla_redondeo,
      caso.marcas,
      casoId,
    ],
  );
}

async function guardarLineasExcepcion(
  pool: Pool,
  casoId: number,
  lineaCodigos: string[],
  proveedorId: number,
  eventoId: number,
): Promise<number> {
  const codigos = lineaCodigos
    .map((c) => parseInt(c, 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!codigos.length) return 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM precio_evento_linea_excepcion pele
       USING linea l
       WHERE pele.evento_id = $1
         AND pele.linea_id = l.id
         AND l.proveedor_id = $2
         AND l.codigo_proveedor = ANY($3::bigint[])
         AND pele.caso_id <> $4`,
      [eventoId, proveedorId, codigos, casoId],
    );
    const ins = await client.query(
      `INSERT INTO precio_evento_linea_excepcion (caso_id, linea_id, evento_id)
       SELECT DISTINCT ON (l.id) $1, l.id, $2
       FROM linea l
       WHERE l.proveedor_id = $3
         AND l.codigo_proveedor = ANY($4::bigint[])
         AND NOT EXISTS (
           SELECT 1 FROM precio_evento_linea_excepcion x
           WHERE x.caso_id = $1 AND x.linea_id = l.id
         )
       ORDER BY l.id`,
      [casoId, eventoId, proveedorId, codigos],
    );
    await client.query("COMMIT");
    return ins.rowCount ?? 0;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function reemplazarLineasExcepcion(
  pool: Pool,
  casoId: number,
  lineaCodigos: string[],
  proveedorId: number,
  eventoId: number,
): Promise<number> {
  await pool.query(`DELETE FROM precio_evento_linea_excepcion WHERE caso_id = $1`, [casoId]);
  return guardarLineasExcepcion(pool, casoId, lineaCodigos, proveedorId, eventoId);
}

/** Paridad Streamlit `vaciar_matriz_evento`. */
export async function vaciarMatrizEvento(pool: Pool, eventoId: number): Promise<{ ok: boolean; error?: string }> {
  if (await eventoEstaCerrado(pool, eventoId)) {
    return { ok: false, error: "Listado cerrado." };
  }
  const nSkus = await contarSkusProcesados(pool, eventoId);
  if (nSkus > 0) {
    return { ok: false, error: `Hay ${nSkus} SKU(s) ya calculados; no se puede vaciar la matriz.` };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM precio_evento_linea_excepcion
       WHERE caso_id IN (SELECT id FROM precio_evento_caso WHERE evento_id = $1)`,
      [eventoId],
    );
    await client.query(`DELETE FROM precio_evento_caso WHERE evento_id = $1`, [eventoId]);
    await client.query("COMMIT");
    return { ok: true };
  } catch (e) {
    await client.query("ROLLBACK");
    const msg = e instanceof Error ? e.message : "Error al vaciar matriz";
    return { ok: false, error: msg };
  } finally {
    client.release();
  }
}

/** Paridad Streamlit `persistir_caso_matriz_evento`. */
export async function persistirCasoMatrizEvento(
  pool: Pool,
  eventoId: number,
  proveedorId: number,
  caso: CasoInput & { marcas?: string[] | null; regla_redondeo?: string },
  casoDbId?: number | null,
): Promise<{ casoId: number | null; error?: string }> {
  if (await eventoEstaCerrado(pool, eventoId)) {
    return { casoId: null, error: "El listado está cerrado; no se puede editar la matriz." };
  }

  const norm = normalizarCaso(caso);
  if (!norm.nombre_caso) {
    return { casoId: null, error: "Nombre de caso obligatorio." };
  }

  const payload = casoDictParaDb({ ...norm, marcas: caso.marcas ?? null, regla_redondeo: caso.regla_redondeo });

  let casoId = casoDbId ?? null;

  if (casoId) {
    await actualizarCasoEvento(pool, casoId, payload);
  } else {
    const { rows } = await pool.query<{ id: string }>(
      `SELECT id FROM precio_evento_caso
       WHERE evento_id = $1 AND UPPER(TRIM(nombre_caso)) = UPPER(TRIM($2))
       LIMIT 1`,
      [eventoId, norm.nombre_caso],
    );
    if (rows[0]) {
      casoId = Number(rows[0].id);
      await actualizarCasoEvento(pool, casoId, payload);
    } else {
      casoId = await crearCasoEvento(pool, eventoId, payload);
    }
  }

  const lineas = norm.lineas ?? [];
  const marcas = caso.marcas?.length ? caso.marcas : null;
  if (lineas.length) {
    const eid = eventoId ?? (await eventoIdDeCaso(pool, casoId));
    if (eid) await reemplazarLineasExcepcion(pool, casoId, lineas, proveedorId, eid);
  } else if (!marcas?.length) {
    await pool.query(`DELETE FROM precio_evento_linea_excepcion WHERE caso_id = $1`, [casoId]);
  }

  return { casoId, error: undefined };
}
