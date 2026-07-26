import type { Pool } from "pg";
import { actualizarListaPrecioFi, resincronizarFiDesdeListadoPp } from "@/app/aprobaciones/lib/aprobaciones-mutations";
import { BOTON_IMPOSITOR_LABEL } from "@/lib/pedido-proveedor/boton-impositor-constants";
import { esListadoPrecioValido } from "@/lib/intencion-compra/listado-precio-tiers";
import { syncLogisticaMontosDesdeFi } from "@/lib/logistica-ok/sync-fi-montos";
import { syncLogisticaPpIfBandera } from "@/lib/logistica-ok/sync-pp";

export { BOTON_IMPOSITOR_LABEL };

export type RecalcFiLpLogisticaFila = {
  fi_id: number;
  nro_factura: string;
  lista_precio_id: number;
  monto_antes: number;
  monto_despues: number;
  logistica_sync: boolean;
  ok: boolean;
  error?: string;
};

export type RecalcFiLpLogisticaResult = {
  ok: boolean;
  pp_id: number;
  pp_enviado: boolean;
  modo_impositor: boolean;
  lista_impuesta: number | null;
  filas: RecalcFiLpLogisticaFila[];
  fi_ok: number;
  fi_fail: number;
  monto_antes: number;
  monto_despues: number;
  delta_monto: number;
  logistica_filas: number;
  errores: string[];
  biblioteca_ignorada: boolean;
};

const POST_COMPRAS = { allowPpEnviado: true as const };

/**
 * Botón impositor «Asignar listado de Precios».
 * Impone LP 1–4 · recalc L+R+material desde precio_lista del evento PP · ignora biblioteca BCL.
 */
export async function recalcFiLpLogisticaSevero(
  pool: Pool,
  ppId: number,
  opts: {
    fiIds: number[];
    listaPrecioId: number;
    modoImpositor?: boolean;
  },
): Promise<RecalcFiLpLogisticaResult> {
  const fiIds = [...new Set(opts.fiIds.filter((id) => Number.isFinite(id) && id > 0))];
  const modoImpositor = opts.modoImpositor !== false;
  const tier = opts.listaPrecioId;

  const base: RecalcFiLpLogisticaResult = {
    ok: false,
    pp_id: ppId,
    pp_enviado: false,
    modo_impositor: modoImpositor,
    lista_impuesta: tier,
    filas: [],
    fi_ok: 0,
    fi_fail: 0,
    monto_antes: 0,
    monto_despues: 0,
    delta_monto: 0,
    logistica_filas: 0,
    errores: [],
    biblioteca_ignorada: modoImpositor,
  };

  if (fiIds.length === 0) {
    return { ...base, errores: ["Seleccioná al menos una FI."] };
  }

  if (!esListadoPrecioValido(tier)) {
    return { ...base, errores: ["Lista de precio inválida (1–4)."] };
  }

  const { rows: ppRows } = await pool.query<{ estado: string }>(
    `SELECT estado FROM pedido_proveedor WHERE id = $1`,
    [ppId],
  );
  if (!ppRows[0]) {
    return { ...base, errores: ["PP no encontrado."] };
  }

  const ppEnviado = (ppRows[0].estado || "").toUpperCase() === "ENVIADO";

  const { rows: fiRows } = await pool.query<{
    id: string;
    nro_factura: string;
    lista_precio_id: string;
    total_monto: string;
  }>(
    `SELECT id, nro_factura, lista_precio_id::text, COALESCE(total_monto, 0)::text AS total_monto
     FROM factura_interna
     WHERE pp_id = $1 AND id = ANY($2::int[])
       AND UPPER(TRIM(estado)) IN ('RESERVADA', 'CONFIRMADA')
     ORDER BY nro_factura`,
    [ppId, fiIds],
  );

  if (fiRows.length === 0) {
    return { ...base, pp_enviado: ppEnviado, errores: ["Sin FI RESERVADA/CONFIRMADA en la selección."] };
  }

  const filas: RecalcFiLpLogisticaFila[] = [];
  const errores: string[] = [];
  let montoAntes = 0;
  let montoDespues = 0;
  let logisticaFilas = 0;

  for (const fi of fiRows) {
    const fiId = Number(fi.id);
    const montoAntesFi = Number(fi.total_monto ?? 0);
    montoAntes += montoAntesFi;

    const cambioLp = await actualizarListaPrecioFi(fiId, tier, POST_COMPRAS);
    let res:
      | { ok: true; totalMonto?: number; msg?: string }
      | { ok: false; msg: string };

    if (!cambioLp.ok) {
      res = cambioLp;
    } else {
      res = await resincronizarFiDesdeListadoPp(fiId, {
        usarRedondeoComercial: true,
        allowPpEnviado: true,
        listaPrecioIdOverride: tier,
      });
    }

    if (!res.ok) {
      filas.push({
        fi_id: fiId,
        nro_factura: fi.nro_factura,
        lista_precio_id: tier,
        monto_antes: montoAntesFi,
        monto_despues: montoAntesFi,
        logistica_sync: false,
        ok: false,
        error: res.msg,
      });
      errores.push(`${fi.nro_factura}: ${res.msg}`);
      continue;
    }

    const montoDespuesFi = res.totalMonto ?? cambioLp.totalMonto ?? montoAntesFi;
    montoDespues += montoDespuesFi;

    const sync = await syncLogisticaMontosDesdeFi(pool, fiId);
    if (sync.updated) logisticaFilas++;

    filas.push({
      fi_id: fiId,
      nro_factura: fi.nro_factura,
      lista_precio_id: tier,
      monto_antes: montoAntesFi,
      monto_despues: montoDespuesFi,
      logistica_sync: sync.updated,
      ok: true,
    });
  }

  if (ppEnviado || logisticaFilas > 0) {
    await syncLogisticaPpIfBandera(pool, ppId);
  }

  const fiOk = filas.filter((f) => f.ok).length;
  const fiFail = filas.filter((f) => !f.ok).length;
  const delta = Math.round((montoDespues - montoAntes) * 100) / 100;

  return {
    ok: fiOk > 0 && fiFail === 0,
    pp_id: ppId,
    pp_enviado: ppEnviado,
    modo_impositor: modoImpositor,
    lista_impuesta: tier,
    filas,
    fi_ok: fiOk,
    fi_fail: fiFail,
    monto_antes: montoAntes,
    monto_despues: montoDespues,
    delta_monto: delta,
    logistica_filas: logisticaFilas,
    errores,
    biblioteca_ignorada: modoImpositor,
  };
}
