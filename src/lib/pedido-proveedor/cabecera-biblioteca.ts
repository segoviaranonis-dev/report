import type { Pool, PoolClient } from "pg";
import {
  CATEGORIA_COMPRA_PREVIA_ID,
  CATEGORIA_PROGRAMADO_ID,
} from "@/lib/intencion-compra/categoria-ic";
import { loadAdministradorIcPp } from "./administrador-ic-query";
import { ppCabeceraEditable } from "./cabecera-actions";
import { borrarTodasFiPpEnTx } from "./proforma-programado-engine";
import {
  ensureProformaFilasTable,
  inferAndPersistProformaFromPpd,
} from "./proforma-snapshot";
import { ppFiLockKey } from "./pp-fi-advisory-lock";

export type CambiarBibliotecaModo = "programado" | "compra_previa";

type CambiarBibliotecaOkBase = {
  ok: true;
  modo: CambiarBibliotecaModo;
  biblioteca_id: number;
  biblioteca_nombre: string;
};

export type CambiarBibliotecaProgramadoOk = CambiarBibliotecaOkBase & {
  modo: "programado";
  n_fi_borradas: number;
  n_fi_restantes: number;
  n_pf: number;
  casos_pf: string[];
  pares_pf: number;
  fuente_caso: string;
  proforma_snapshot: boolean;
  admin_ic: Awaited<ReturnType<typeof loadAdministradorIcPp>>;
};

export type CambiarBibliotecaCompraPreviaOk = CambiarBibliotecaOkBase & {
  modo: "compra_previa";
  n_fi_intactas: number;
  n_fi_confirmadas: number;
  ppd_caso_actualizados: number;
  ppd_sin_caso_bcl: number;
  ppd_vendidos_sin_tocar: number;
  vendido_vt: number;
  fuente_caso: string;
};

export type CambiarBibliotecaResult =
  | CambiarBibliotecaProgramadoOk
  | CambiarBibliotecaCompraPreviaOk
  | {
      ok: false;
      error: string;
      requiere_confirmacion?: boolean;
      n_fi?: number;
      n_fi_confirmadas?: number;
    };

type PpBibliotecaRow = {
  estado: string;
  categoria_id: number | null;
  proveedor_importacion_id: string | null;
  biblioteca_precio_id: string | null;
};

type BibliotecaRow = { id: string; nombre: string; proveedor_id: string };

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

async function loadPpVentasCp(client: PoolClient, ppId: number) {
  const fiCount = await client.query<{ c: number; n_conf: number }>(
    `SELECT COUNT(*)::int AS c,
            COUNT(*) FILTER (WHERE UPPER(TRIM(estado)) = 'CONFIRMADA')::int AS n_conf
     FROM factura_interna WHERE pp_id = $1`,
    [ppId],
  );
  const vendido = await client.query<{ vendido_vt: string; ppd_vendidos: string }>(
    `SELECT
       COALESCE((
         SELECT SUM(vt.cantidad_vendida)::text
         FROM venta_transito vt
         JOIN pedido_proveedor_detalle d ON d.id = vt.pedido_proveedor_detalle_id
         WHERE d.pedido_proveedor_id = $1
       ), '0') AS vendido_vt,
       COALESCE((
         SELECT COUNT(*)::text
         FROM pedido_proveedor_detalle ppd
         WHERE ppd.pedido_proveedor_id = $1 AND COALESCE(ppd.pares_vendidos, 0) > 0
       ), '0') AS ppd_vendidos`,
    [ppId],
  );
  return {
    nFi: fiCount.rows[0]?.c ?? 0,
    nFiConfirmadas: fiCount.rows[0]?.n_conf ?? 0,
    vendidoVt: Number(vendido.rows[0]?.vendido_vt ?? 0),
    ppdVendidos: Number(vendido.rows[0]?.ppd_vendidos ?? 0),
  };
}

/** BCL → descp_caso_snapshot solo en moléculas sin venta (pares_vendidos = 0). */
async function sincronizarBclCompraPreviaEnTx(
  client: PoolClient,
  ppId: number,
  bibliotecaPrecioId: number,
): Promise<{ actualizados: number; sin_caso: number; vendidos_sin_tocar: number }> {
  const stats = await client.query<{ actualizados: string; sin_caso: string; vendidos: string }>(
    `
    WITH map_linea_caso AS (
      SELECT
        l.proveedor_id,
        l.codigo_proveedor::text AS linea_cod,
        cpb.id AS caso_bib_id,
        cpb.nombre_caso
      FROM biblioteca_caso_linea bcl
      JOIN linea l ON l.id = bcl.linea_id
      JOIN caso_precio_biblioteca cpb ON cpb.id = bcl.caso_biblioteca_id
      WHERE bcl.biblioteca_id = $2
        AND COALESCE(cpb.activo, true) = true
    ),
    fuente AS (
      SELECT
        ppd.id AS det_id,
        mc.caso_bib_id,
        mc.nombre_caso
      FROM pedido_proveedor_detalle ppd
      JOIN pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
      LEFT JOIN map_linea_caso mc
        ON mc.proveedor_id = pp.proveedor_importacion_id
       AND mc.linea_cod = btrim(ppd.linea)
      WHERE ppd.pedido_proveedor_id = $1
        AND COALESCE(ppd.pares_vendidos, 0) = 0
    ),
    upd AS (
      UPDATE pedido_proveedor_detalle ppd
      SET
        descp_caso_snapshot = f.nombre_caso,
        biblioteca_id = f.caso_bib_id
      FROM fuente f
      WHERE ppd.id = f.det_id
        AND f.nombre_caso IS NOT NULL
      RETURNING ppd.id
    ),
    sin_caso AS (
      SELECT COUNT(*)::int AS c
      FROM pedido_proveedor_detalle ppd
      WHERE ppd.pedido_proveedor_id = $1
        AND COALESCE(ppd.pares_vendidos, 0) = 0
        AND ppd.id NOT IN (SELECT id FROM upd)
    ),
    vendidos AS (
      SELECT COUNT(*)::int AS c
      FROM pedido_proveedor_detalle ppd
      WHERE ppd.pedido_proveedor_id = $1
        AND COALESCE(ppd.pares_vendidos, 0) > 0
    )
    SELECT
      (SELECT COUNT(*)::text FROM upd) AS actualizados,
      (SELECT c::text FROM sin_caso) AS sin_caso,
      (SELECT c::text FROM vendidos) AS vendidos
    `,
    [ppId, bibliotecaPrecioId],
  );
  const row = stats.rows[0];
  return {
    actualizados: Number(row?.actualizados ?? 0),
    sin_caso: Number(row?.sin_caso ?? 0),
    vendidos_sin_tocar: Number(row?.vendidos ?? 0),
  };
}

function validarBibliotecaPp(
  pp: PpBibliotecaRow | undefined,
  bib: BibliotecaRow | undefined,
  bibliotecaPrecioId: number,
): CambiarBibliotecaResult | null {
  if (!pp) return { ok: false, error: "PP no encontrado." };
  if (!ppCabeceraEditable(pp.estado)) {
    return { ok: false, error: "PP ENVIADO o ANULADO — biblioteca bloqueada." };
  }
  if (!bib) return { ok: false, error: "Biblioteca no encontrada o inactiva." };
  const provPp = Number(pp.proveedor_importacion_id ?? 654);
  const provBib = Number(bib.proveedor_id);
  if (provPp > 0 && provBib > 0 && provPp !== provBib) {
    return { ok: false, error: "Biblioteca de otro proveedor." };
  }
  const curBib = pp.biblioteca_precio_id != null ? Number(pp.biblioteca_precio_id) : null;
  if (curBib === bibliotecaPrecioId) {
    return { ok: false, error: "La biblioteca ya está activa en este PP." };
  }
  return null;
}

/**
 * PROGRAMADO — cambio total: borra FI · rebuild PF · snapshot proforma.
 */
export async function cambiarBibliotecaProgramadoPp(
  pool: Pool,
  ppId: number,
  bibliotecaPrecioId: number,
  opts?: { confirmar_destructivo?: boolean },
): Promise<CambiarBibliotecaResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT pg_advisory_xact_lock($1::bigint)`, [ppFiLockKey(ppId)]);

    const ppRes = await client.query<PpBibliotecaRow>(
      `SELECT estado, categoria_id::int, proveedor_importacion_id::text, biblioteca_precio_id::text
       FROM pedido_proveedor WHERE id = $1 FOR UPDATE`,
      [ppId],
    );
    const pp = ppRes.rows[0];
    const bibRes = await client.query<BibliotecaRow>(
      `SELECT id::text, nombre, proveedor_id::text
       FROM biblioteca_precio WHERE id = $1 AND activo = true`,
      [bibliotecaPrecioId],
    );
    const bib = bibRes.rows[0];
    const invalid = validarBibliotecaPp(pp, bib, bibliotecaPrecioId);
    if (invalid) {
      await client.query("ROLLBACK");
      return invalid;
    }

    const { nFi, nFiConfirmadas } = await loadPpVentasCp(client, ppId);
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
      modo: "programado",
      biblioteca_id: bibliotecaPrecioId,
      biblioteca_nombre: bib!.nombre,
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

/**
 * COMPRA PREVIA — vincular política sin borrar FI ni tocar moléculas vendidas.
 * Primera asignación con FI existentes: OK. Cambio A→B con ventas Web: bloqueado.
 */
export async function cambiarBibliotecaCompraPreviaPp(
  pool: Pool,
  ppId: number,
  bibliotecaPrecioId: number,
): Promise<CambiarBibliotecaResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT pg_advisory_xact_lock($1::bigint)`, [ppFiLockKey(ppId)]);

    const ppRes = await client.query<PpBibliotecaRow>(
      `SELECT estado, categoria_id::int, proveedor_importacion_id::text, biblioteca_precio_id::text
       FROM pedido_proveedor WHERE id = $1 FOR UPDATE`,
      [ppId],
    );
    const pp = ppRes.rows[0];
    const bibRes = await client.query<BibliotecaRow>(
      `SELECT id::text, nombre, proveedor_id::text
       FROM biblioteca_precio WHERE id = $1 AND activo = true`,
      [bibliotecaPrecioId],
    );
    const bib = bibRes.rows[0];
    const invalid = validarBibliotecaPp(pp, bib, bibliotecaPrecioId);
    if (invalid) {
      await client.query("ROLLBACK");
      return invalid;
    }

    const curBib = pp!.biblioteca_precio_id != null ? Number(pp!.biblioteca_precio_id) : null;
    const ventas = await loadPpVentasCp(client, ppId);

    if (curBib != null && (ventas.vendidoVt > 0 || ventas.nFiConfirmadas > 0)) {
      await client.query("ROLLBACK");
      const partes: string[] = [];
      if (ventas.vendidoVt > 0) {
        partes.push(`${ventas.vendidoVt.toLocaleString("es-PY")} pares vendidos en Web`);
      }
      if (ventas.nFiConfirmadas > 0) {
        partes.push(`${ventas.nFiConfirmadas} FI confirmada(s)`);
      }
      return {
        ok: false,
        error: `Compra previa: no se puede cambiar biblioteca con ${partes.join(" · ")}. Las FI y lo vendido quedan intactos — contactá operación.`,
        n_fi: ventas.nFi,
        n_fi_confirmadas: ventas.nFiConfirmadas,
      };
    }

    await client.query(
      `UPDATE pedido_proveedor SET biblioteca_precio_id = $2 WHERE id = $1`,
      [ppId, bibliotecaPrecioId],
    );

    const sync = await sincronizarBclCompraPreviaEnTx(client, ppId, bibliotecaPrecioId);
    await client.query("COMMIT");

    return {
      ok: true,
      modo: "compra_previa",
      biblioteca_id: bibliotecaPrecioId,
      biblioteca_nombre: bib!.nombre,
      n_fi_intactas: ventas.nFi,
      n_fi_confirmadas: ventas.nFiConfirmadas,
      ppd_caso_actualizados: sync.actualizados,
      ppd_sin_caso_bcl: sync.sin_caso,
      ppd_vendidos_sin_tocar: sync.vendidos_sin_tocar,
      vendido_vt: ventas.vendidoVt,
      fuente_caso: "biblioteca_bcl_cp",
    };
  } catch (e) {
    await client.query("ROLLBACK");
    return { ok: false, error: e instanceof Error ? e.message : "Error al vincular biblioteca CP." };
  } finally {
    client.release();
  }
}

/** Despacha por categoría PP — PROGRAMADO destructivo · COMPRA PREVIA conservador. */
export async function cambiarBibliotecaPp(
  pool: Pool,
  ppId: number,
  bibliotecaPrecioId: number,
  opts?: { confirmar_destructivo?: boolean },
): Promise<CambiarBibliotecaResult> {
  const { rows } = await pool.query<{ categoria_id: number | null }>(
    `SELECT categoria_id::int FROM pedido_proveedor WHERE id = $1`,
    [ppId],
  );
  const categoriaId = rows[0]?.categoria_id ?? null;
  if (categoriaId === CATEGORIA_COMPRA_PREVIA_ID) {
    return cambiarBibliotecaCompraPreviaPp(pool, ppId, bibliotecaPrecioId);
  }
  if (categoriaId === CATEGORIA_PROGRAMADO_ID) {
    return cambiarBibliotecaProgramadoPp(pool, ppId, bibliotecaPrecioId, opts);
  }
  return {
    ok: false,
    error: "Categoría PP no soportada para biblioteca en cabecera (solo COMPRA PREVIA o PROGRAMADO).",
  };
}
