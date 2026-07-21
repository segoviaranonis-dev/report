import type { Pool } from "pg";
import { ppCabeceraEditable } from "./cabecera-actions";
import type { AdministradorIcPayload } from "./administrador-ic-query";
import { loadAdministradorIcPp } from "./administrador-ic-query";

export type CambiarBibliotecaResult =
  | {
      ok: true;
      biblioteca_id: number;
      biblioteca_nombre: string;
      n_fi_borradas: number;
      n_pf: number;
      casos_pf: string[];
      pares_pf: number;
      fuente_caso: string;
      admin_ic: AdministradorIcPayload;
    }
  | { ok: false; error: string; requiere_confirmacion?: boolean; n_fi?: number };

/** Lista bibliotecas activas con casos (oculta vacías en UI). */
export async function listBibliotecasParaPp(
  pool: Pool,
  proveedorMotorId: number,
): Promise<{ id: number; nombre: string; casos_count: number }[]> {
  const { rows } = await pool.query<{ id: string; nombre: string; casos_count: string }>(
    `SELECT bp.id::text AS id, bp.nombre,
            COALESCE(c.cnt, 0)::text AS casos_count
     FROM biblioteca_precio bp
     LEFT JOIN (
       SELECT biblioteca_id, COUNT(*) AS cnt
       FROM caso_precio_biblioteca WHERE activo = true GROUP BY biblioteca_id
     ) c ON c.biblioteca_id = bp.id
     WHERE bp.proveedor_id = $1 AND bp.activo = true
     ORDER BY bp.id DESC`,
    [proveedorMotorId],
  );
  return rows
    .map((r) => ({
      id: Number(r.id),
      nombre: r.nombre,
      casos_count: Number(r.casos_count ?? 0),
    }))
    .filter((b) => b.casos_count > 0);
}

/**
 * Cambio total de biblioteca en cabecera PP (Director 2026-07-21).
 * Borra TODAS las FI · reset splits PF · operador regenera en Admin IC.
 */
export async function cambiarBibliotecaPp(
  pool: Pool,
  ppId: number,
  bibliotecaPrecioId: number,
  opts?: { confirmar_destructivo?: boolean },
): Promise<CambiarBibliotecaResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const ppRes = await client.query<{
      estado: string;
      proveedor_importacion_id: string | null;
      biblioteca_precio_id: string | null;
    }>(
      `SELECT estado, proveedor_importacion_id::text, biblioteca_precio_id::text
       FROM pedido_proveedor WHERE id = $1 FOR UPDATE`,
      [ppId],
    );
    const pp = ppRes.rows[0];
    if (!pp) {
      await client.query("ROLLBACK");
      return { ok: false, error: "PP no encontrado." };
    }
    if (!ppCabeceraEditable(pp.estado)) {
      await client.query("ROLLBACK");
      return { ok: false, error: "PP ENVIADO o ANULADO — biblioteca bloqueada." };
    }

    const bibRes = await client.query<{ id: string; nombre: string; proveedor_id: string }>(
      `SELECT id::text, nombre, proveedor_id::text
       FROM biblioteca_precio
       WHERE id = $1 AND activo = true`,
      [bibliotecaPrecioId],
    );
    const bib = bibRes.rows[0];
    if (!bib) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Biblioteca no encontrada o inactiva." };
    }

    const provPp = Number(pp.proveedor_importacion_id ?? 654);
    const provBib = Number(bib.proveedor_id);
    if (provPp > 0 && provBib > 0 && provPp !== provBib) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Biblioteca de otro proveedor." };
    }

    const curBib = pp.biblioteca_precio_id != null ? Number(pp.biblioteca_precio_id) : null;
    if (curBib === bibliotecaPrecioId) {
      await client.query("ROLLBACK");
      return { ok: false, error: "La biblioteca ya está activa en este PP." };
    }

    const fiCount = await client.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM factura_interna WHERE pp_id = $1`,
      [ppId],
    );
    const nFi = fiCount.rows[0]?.c ?? 0;
    if (nFi > 0 && !opts?.confirmar_destructivo) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        error: `Hay ${nFi} factura(s) interna(s). Confirmá cambio total para borrarlas y regenerar pre-facturas.`,
        requiere_confirmacion: true,
        n_fi: nFi,
      };
    }

    await client.query(
      `UPDATE pedido_proveedor SET biblioteca_precio_id = $2 WHERE id = $1`,
      [ppId, bibliotecaPrecioId],
    );

    await client.query(
      `UPDATE pedido_proveedor SET admin_ic_pf_splits = '[]'::jsonb WHERE id = $1`,
      [ppId],
    );

    if (nFi > 0) {
      await client.query(
        `UPDATE pedido_proveedor_detalle ppd
         SET pares_vendidos = GREATEST(
           0,
           COALESCE(ppd.pares_vendidos, 0) - COALESCE(agg.pares, 0)
         )
         FROM (
           SELECT fid.ppd_id, SUM(COALESCE(fid.pares, 0))::int AS pares
           FROM factura_interna_detalle fid
           INNER JOIN factura_interna fi ON fi.id = fid.factura_id
           WHERE fi.pp_id = $1
           GROUP BY fid.ppd_id
         ) agg
         WHERE ppd.id = agg.ppd_id AND ppd.pedido_proveedor_id = $1`,
        [ppId],
      );

      await client.query(`DELETE FROM logistica_pendiente_confirmacion WHERE pedido_proveedor_id = $1`, [
        ppId,
      ]);

      await client.query(
        `DELETE FROM factura_interna_detalle fid
         USING factura_interna fi
         WHERE fid.factura_id = fi.id AND fi.pp_id = $1`,
        [ppId],
      );
      await client.query(`DELETE FROM factura_interna WHERE pp_id = $1`, [ppId]);
    }

    await client.query("COMMIT");

    const admin = await loadAdministradorIcPp(pool, ppId);
    const casosPf = [...new Set(admin.prefacturas.map((p) => p.caso).filter((c) => c && c !== "—"))].sort();
    const paresPf = admin.prefacturas.reduce((a, p) => a + p.total_pares, 0);

    return {
      ok: true,
      biblioteca_id: bibliotecaPrecioId,
      biblioteca_nombre: bib.nombre,
      n_fi_borradas: nFi,
      n_pf: admin.prefacturas.length,
      casos_pf: casosPf,
      pares_pf: paresPf,
      fuente_caso: "biblioteca_bcl",
      admin_ic: admin,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    return { ok: false, error: e instanceof Error ? e.message : "Error al cambiar biblioteca." };
  } finally {
    client.release();
  }
}
