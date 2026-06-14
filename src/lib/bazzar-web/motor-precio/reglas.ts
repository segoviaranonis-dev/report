/**
 * CRUD caso_precio_web_regla — gemelo modules/web_precio_caso/logic.py
 */
import { getRimecPool } from "@/lib/rimec/pool";
import type { ReglaMarkup } from "./types";

export async function listarReglas(): Promise<ReglaMarkup[]> {
  const pool = getRimecPool();
  const { rows } = await pool.query<ReglaMarkup>(
    `
    SELECT id, caso_codigo, markup_pct::float AS markup_pct, descripcion, activo, updated_at::text
    FROM caso_precio_web_regla
    ORDER BY caso_codigo
    `,
  );
  return rows.map((r) => ({ ...r, markup_pct: Number(r.markup_pct) }));
}

export async function crearRegla(
  casoCodigo: string,
  markupPct: number,
  descripcion = "",
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const caso = casoCodigo.trim().toUpperCase();
  if (!caso) return { ok: false, error: "Caso código no puede estar vacío" };
  if (markupPct < 0 || markupPct > 200) {
    return { ok: false, error: "Markup debe estar entre 0% y 200%" };
  }

  const pool = getRimecPool();
  const dup = await pool.query(`SELECT id FROM caso_precio_web_regla WHERE UPPER(TRIM(caso_codigo)) = $1`, [
    caso,
  ]);
  if (dup.rows.length) return { ok: false, error: `Caso '${caso}' ya existe` };

  try {
    const { rows } = await pool.query<{ id: number }>(
      `
      INSERT INTO caso_precio_web_regla (caso_codigo, markup_pct, descripcion, activo)
      VALUES ($1, $2, $3, true)
      RETURNING id
      `,
      [caso, markupPct, descripcion],
    );
    return { ok: true, id: rows[0].id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function editarRegla(
  reglaId: number,
  markupPct: number,
  descripcion = "",
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (markupPct < 0 || markupPct > 200) {
    return { ok: false, error: "Markup debe estar entre 0% y 200%" };
  }
  try {
    const pool = getRimecPool();
    await pool.query(
      `
      UPDATE caso_precio_web_regla
      SET markup_pct = $2, descripcion = $3, updated_at = now()
      WHERE id = $1
      `,
      [reglaId, markupPct, descripcion],
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function setActivo(reglaId: number, activo: boolean) {
  const pool = getRimecPool();
  await pool.query(`UPDATE caso_precio_web_regla SET activo = $2, updated_at = now() WHERE id = $1`, [
    reglaId,
    activo,
  ]);
}

export async function desactivarRegla(reglaId: number) {
  await setActivo(reglaId, false);
}

export async function activarRegla(reglaId: number) {
  await setActivo(reglaId, true);
}

export async function simularPrecioWeb(lpn: number, caso: string) {
  const pool = getRimecPool();
  const { rows } = await pool.query<{ precio_web: string | null; markup_pct: string | null }>(
    `
    SELECT
      fn_precio_venta_web($1::numeric, $2::text) AS precio_web,
      (
        SELECT markup_pct FROM caso_precio_web_regla
        WHERE UPPER(TRIM(caso_codigo)) = UPPER(TRIM(COALESCE($2, 'DEFAULT')))
          AND activo = true
        LIMIT 1
      ) AS markup_pct
    `,
    [lpn, caso],
  );
  const r = rows[0];
  return {
    lpn,
    caso: caso.trim().toUpperCase() || "DEFAULT",
    markup_pct: r?.markup_pct != null ? Number(r.markup_pct) : null,
    precio_web: r?.precio_web != null ? Number(r.precio_web) : null,
  };
}
