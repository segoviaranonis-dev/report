import type { Pool, PoolClient } from "pg";
import { normalizarCaso, validarExclusividadCasosLineas } from "./caso-utils";

/** Paridad Streamlit `vincular_biblioteca_a_evento`. */
export async function vincularBibliotecaAEvento(
  pool: Pool,
  eventoId: number,
  bibliotecaId: number | null,
): Promise<void> {
  if (bibliotecaId == null) return;
  await pool.query(`UPDATE precio_evento SET biblioteca_precio_id = $1 WHERE id = $2`, [
    bibliotecaId,
    eventoId,
  ]);
}

export type AplicarBibliotecaResult =
  | { ok: true; n_casos: number; biblioteca_id: number }
  | { ok: false; error: string; n_casos?: number };

type DbConn = Pick<Pool, "query">;

async function eventoEstaCerradoConn(db: DbConn, eventoId: number): Promise<boolean> {
  const { rows } = await db.query<{ estado: string }>(
    `SELECT estado FROM precio_evento WHERE id = $1`,
    [eventoId],
  );
  return rows[0]?.estado?.toLowerCase() === "cerrado";
}

async function contarSkusProcesadosConn(db: DbConn, eventoId: number): Promise<number> {
  const { rows } = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM precio_lista WHERE evento_id = $1`,
    [eventoId],
  );
  return Number(rows[0]?.n ?? 0);
}

async function vaciarMatrizEnTransaccion(client: PoolClient, eventoId: number): Promise<{ ok: boolean; error?: string }> {
  const nSkus = await contarSkusProcesadosConn(client, eventoId);
  if (nSkus > 0) {
    return { ok: false, error: `Hay ${nSkus} SKU(s) ya calculados; no se puede vaciar la matriz.` };
  }
  await client.query(
    `DELETE FROM precio_evento_linea_excepcion
     WHERE caso_id IN (SELECT id FROM precio_evento_caso WHERE evento_id = $1)`,
    [eventoId],
  );
  await client.query(`DELETE FROM precio_evento_caso WHERE evento_id = $1`, [eventoId]);
  return { ok: true };
}

/**
 * Copia casos bib → evento en **una sola transacción** (Vercel max:1 pool — evita N×connect + timeout 60s).
 */
export async function aplicarBibliotecaAEvento(
  pool: Pool,
  eventoId: number,
  proveedorId: number,
  bibliotecaId: number,
  reemplazarMatriz = true,
): Promise<AplicarBibliotecaResult> {
  const editor = await loadBibliotecaEditor(pool, bibliotecaId, proveedorId);
  if (!editor) {
    return { ok: false, error: "No se pudo cargar la biblioteca." };
  }

  if (editor.casos.length === 0) {
    return { ok: false, error: "La biblioteca no tiene casos activos para copiar." };
  }

  const conflictos = validarExclusividadCasosLineas(editor.casos);
  if (conflictos.length) {
    return { ok: false, error: `Biblioteca inconsistente: ${conflictos[0]}` };
  }

  const { rows: marcasRows } = await pool.query<{ id: string; marcas: string[] | null }>(
    `SELECT id, marcas FROM caso_precio_biblioteca WHERE biblioteca_id = $1 AND activo = true`,
    [bibliotecaId],
  );
  const marcasPorCaso = new Map<number, string[] | null>();
  for (const r of marcasRows) {
    marcasPorCaso.set(Number(r.id), r.marcas);
  }

  const client = await pool.connect();
  try {
    if (await eventoEstaCerradoConn(client, eventoId)) {
      return { ok: false, error: "El listado está cerrado; no se puede editar la matriz." };
    }

    await client.query("BEGIN");

    if (reemplazarMatriz) {
      const vacio = await vaciarMatrizEnTransaccion(client, eventoId);
      if (!vacio.ok) {
        await client.query("ROLLBACK");
        return { ok: false, error: vacio.error ?? "No se pudo vaciar matriz." };
      }
    }

    let nCasos = 0;
    for (const caso of editor.casos) {
      const norm = normalizarCaso(caso);
      if (!norm.nombre_caso) {
        await client.query("ROLLBACK");
        return { ok: false, error: "Nombre de caso obligatorio.", n_casos: nCasos };
      }

      const marcas = marcasPorCaso.get(caso.id) ?? null;
      const payload = {
        nombre_caso: norm.nombre_caso,
        dolar_politica: norm.dolar_politica,
        factor_conversion: norm.factor_conversion,
        descuento_1: norm.descuento_1,
        descuento_2: norm.descuento_2,
        descuento_3: norm.descuento_3,
        descuento_4: norm.descuento_4,
        genera_lpc03_lpc04: norm.genera_lpc03_lpc04,
        regla_redondeo: "centena",
        marcas,
      };

      let casoId: number;
      const exist = await client.query<{ id: string }>(
        `SELECT id FROM precio_evento_caso
         WHERE evento_id = $1 AND UPPER(TRIM(nombre_caso)) = UPPER(TRIM($2))
         LIMIT 1`,
        [eventoId, payload.nombre_caso],
      );

      if (exist.rows[0]) {
        casoId = Number(exist.rows[0].id);
        await client.query(
          `UPDATE precio_evento_caso SET
             dolar_politica = $2, factor_conversion = $3,
             descuento_1 = $4, descuento_2 = $5, descuento_3 = $6, descuento_4 = $7,
             genera_lpc03_lpc04 = $8, regla_redondeo = $9, marcas = $10
           WHERE id = $1`,
          [
            casoId,
            payload.dolar_politica,
            payload.factor_conversion,
            payload.descuento_1,
            payload.descuento_2,
            payload.descuento_3,
            payload.descuento_4,
            payload.genera_lpc03_lpc04,
            payload.regla_redondeo,
            payload.marcas,
          ],
        );
      } else {
        const ins = await client.query<{ id: string }>(
          `INSERT INTO precio_evento_caso
             (evento_id, nombre_caso, dolar_politica, factor_conversion,
              descuento_1, descuento_2, descuento_3, descuento_4,
              genera_lpc03_lpc04, regla_redondeo, marcas)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id`,
          [
            eventoId,
            payload.nombre_caso,
            payload.dolar_politica,
            payload.factor_conversion,
            payload.descuento_1,
            payload.descuento_2,
            payload.descuento_3,
            payload.descuento_4,
            payload.genera_lpc03_lpc04,
            payload.regla_redondeo,
            payload.marcas,
          ],
        );
        casoId = Number(ins.rows[0]?.id);
        if (!casoId) {
          await client.query("ROLLBACK");
          return { ok: false, error: "No se pudo crear caso en evento.", n_casos: nCasos };
        }
      }

      const lineas = (norm.lineas ?? [])
        .map((c) => parseInt(c, 10))
        .filter((n) => Number.isFinite(n) && n > 0);

      await client.query(`DELETE FROM precio_evento_linea_excepcion WHERE caso_id = $1`, [casoId]);

      if (lineas.length) {
        await client.query(
          `DELETE FROM precio_evento_linea_excepcion pele
           USING linea l
           WHERE pele.evento_id = $1
             AND pele.linea_id = l.id
             AND l.proveedor_id = $2
             AND l.codigo_proveedor = ANY($3::bigint[])
             AND pele.caso_id <> $4`,
          [eventoId, proveedorId, lineas, casoId],
        );
        await client.query(
          `INSERT INTO precio_evento_linea_excepcion (caso_id, linea_id, evento_id)
           SELECT DISTINCT ON (l.id) $1, l.id, $2
           FROM linea l
           WHERE l.proveedor_id = $3
             AND l.codigo_proveedor = ANY($4::bigint[])
           ORDER BY l.id`,
          [casoId, eventoId, proveedorId, lineas],
        );
      }

      nCasos += 1;
    }

    await client.query(`UPDATE precio_evento SET biblioteca_precio_id = $1 WHERE id = $2`, [
      bibliotecaId,
      eventoId,
    ]);
    await client.query("COMMIT");
    return { ok: true, n_casos: nCasos, biblioteca_id: bibliotecaId };
  } catch (e) {
    await client.query("ROLLBACK");
    const msg = e instanceof Error ? e.message : "Error al aplicar biblioteca";
    return { ok: false, error: msg };
  } finally {
    client.release();
  }
}
