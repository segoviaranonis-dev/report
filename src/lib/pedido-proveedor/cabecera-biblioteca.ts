import type { Pool, PoolClient } from "pg";
import { loadAdministradorIcPp } from "./administrador-ic-query";
import { ppCabeceraEditable } from "./cabecera-actions";
import { borrarTodasFiPpEnTx } from "./proforma-programado-engine";
import {
  ensureProformaFilasTable,
  inferAndPersistProformaFromPpd,
} from "./proforma-snapshot";
import { ppFiLockKey } from "./pp-fi-advisory-lock";

export type CambiarBibliotecaResult =
  | {
      ok: true;
      biblioteca_id: number;
      biblioteca_nombre: string;
      n_fi_borradas: number;
      n_fi_restantes: number;
      n_pf: number;
      casos_pf: string[];
      pares_pf: number;
      fuente_caso: string;
      proforma_snapshot: boolean;
      admin_ic: Awaited<ReturnType<typeof loadAdministradorIcPp>>;
    }
  | {
      ok: false;
      error: string;
      requiere_confirmacion?: boolean;
      n_fi?: number;
      n_fi_confirmadas?: number;
    };

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

async function recalcularProformaSnapshotEnTx(
  client: PoolClient,
  ppId: number,
): Promise<boolean> {
  await ensureProformaFilasTable(client);
  await client.query(`DELETE FROM pp_proforma_filas WHERE pp_id = $1`, [ppId]);
  const rebuilt = await inferAndPersistProformaFromPpd(client, ppId);
  return Boolean(rebuilt?.detalle.length);
}

/**
 * Cambio total de biblioteca en cabecera PP.
 * Borra TODAS las FI · invalida snapshot · reconstruye PF desde BCL nueva.
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
    await client.query(`SELECT pg_advisory_xact_lock($1::bigint)`, [ppFiLockKey(ppId)]);

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

    const fiCount = await client.query<{ c: number; n_conf: number }>(
      `SELECT COUNT(*)::int AS c,
              COUNT(*) FILTER (WHERE UPPER(TRIM(estado)) = 'CONFIRMADA')::int AS n_conf
       FROM factura_interna WHERE pp_id = $1`,
      [ppId],
    );
    const nFi = fiCount.rows[0]?.c ?? 0;
    const nFiConfirmadas = fiCount.rows[0]?.n_conf ?? 0;
    if (nFi > 0 && !opts?.confirmar_destructivo) {
      await client.query("ROLLBACK");
      const confHint = nFiConfirmadas > 0 ? ` (${nFiConfirmadas} CONFIRMADA(s))` : "";
      return {
        ok: false,
        error: `Hay ${nFi} factura(s) interna(s)${confHint}. Confirmá cambio total para borrarlas y recalcular pre-facturas.`,
        requiere_confirmacion: true,
        n_fi: nFi,
        n_fi_confirmadas: nFiConfirmadas,
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

    let nFiBorradas = 0;
    if (nFi > 0) {
      const del = await borrarTodasFiPpEnTx(client, ppId, { incluir_confirmadas: true });
      if (!del.ok) {
        await client.query("ROLLBACK");
        return { ok: false, error: del.error ?? "No se pudieron borrar las FI." };
      }
      nFiBorradas = del.n ?? 0;
    }

    const proformaOk = await recalcularProformaSnapshotEnTx(client, ppId);

    await client.query("COMMIT");

    const admin = await loadAdministradorIcPp(pool, ppId);
    const casosPf = [...new Set(admin.prefacturas.map((p) => p.caso).filter((c) => c && c !== "—"))].sort();
    const paresPf = admin.prefacturas.reduce((a, p) => a + p.total_pares, 0);

    return {
      ok: true,
      biblioteca_id: bibliotecaPrecioId,
      biblioteca_nombre: bib.nombre,
      n_fi_borradas: nFiBorradas,
      n_fi_restantes: 0,
      n_pf: admin.prefacturas.length,
      casos_pf: casosPf,
      pares_pf: paresPf,
      fuente_caso: "biblioteca_bcl",
      proforma_snapshot: proformaOk,
      admin_ic: admin,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    return { ok: false, error: e instanceof Error ? e.message : "Error al cambiar biblioteca." };
  } finally {
    client.release();
  }
}
