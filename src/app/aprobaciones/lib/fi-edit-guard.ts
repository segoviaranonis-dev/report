import type { PoolClient } from "pg";
import { sumFiTotalesDesdeDetalle, syncPedidoTotalesDesdeFis } from "./fi-editor-sync";

export type FiHeaderLock = {
  fiId: number;
  pedidoId: number | null;
  estado: string;
  listaPrecioId: number;
  descuento_1: number;
  descuento_2: number;
  descuento_3: number;
  descuento_4: number;
  plazoId: number | null;
  flippedConfirmada: boolean;
};

type FiRow = {
  estado: string;
  pedido_id: number | null;
  pp_estado: string | null;
  lista_precio_id: number;
  descuento_1: number;
  descuento_2: number;
  descuento_3: number;
  descuento_4: number;
  plazo_id: number | null;
};

/** Bloquea FI editable; flip CONFIRMADA→RESERVADA si hace falta mutar. */
export async function lockFiEditable(
  client: PoolClient,
  fiId: number,
  options?: { flipConfirmada?: boolean },
): Promise<{ ok: true; lock: FiHeaderLock } | { ok: false; msg: string }> {
  const flip = options?.flipConfirmada !== false;

  const fiRes = await client.query<FiRow>(
    `
    SELECT
      fi.estado,
      fi.pedido_id,
      fi.lista_precio_id,
      fi.descuento_1, fi.descuento_2, fi.descuento_3, fi.descuento_4,
      fi.plazo_id,
      pp.estado AS pp_estado
    FROM public.factura_interna fi
    LEFT JOIN public.pedido_proveedor pp ON pp.id = fi.pp_id
    WHERE fi.id = $1
    FOR UPDATE OF fi
  `,
    [fiId],
  );

  const fi = fiRes.rows[0];
  if (!fi) return { ok: false, msg: "FI no encontrada." };

  const estado = (fi.estado || "").toUpperCase();
  if (estado !== "RESERVADA" && estado !== "CONFIRMADA") {
    return { ok: false, msg: `FI en estado ${estado} — no editable.` };
  }
  if ((fi.pp_estado || "").toUpperCase() === "ENVIADO") {
    return { ok: false, msg: "PP enviado a compra — edición cerrada." };
  }

  let flippedConfirmada = false;
  if (flip && estado === "CONFIRMADA") {
    await client.query(
      `UPDATE public.factura_interna SET estado = 'RESERVADA' WHERE id = $1 AND estado = 'CONFIRMADA'`,
      [fiId],
    );
    flippedConfirmada = true;
  }

  return {
    ok: true,
    lock: {
      fiId,
      pedidoId: fi.pedido_id,
      estado,
      listaPrecioId: Number(fi.lista_precio_id) || 1,
      descuento_1: Number(fi.descuento_1),
      descuento_2: Number(fi.descuento_2),
      descuento_3: Number(fi.descuento_3),
      descuento_4: Number(fi.descuento_4),
      plazoId: fi.plazo_id != null ? Number(fi.plazo_id) : null,
      flippedConfirmada,
    },
  };
}

export async function restoreFiEstadoTrasEdicion(
  client: PoolClient,
  lock: FiHeaderLock,
): Promise<void> {
  if (lock.flippedConfirmada) {
    await client.query(
      `UPDATE public.factura_interna SET estado = 'CONFIRMADA' WHERE id = $1 AND estado = 'RESERVADA'`,
      [lock.fiId],
    );
  }
}

export async function recalcularFiTotalesYsyncPvr(
  client: PoolClient,
  lock: Pick<FiHeaderLock, "fiId" | "pedidoId">,
): Promise<{ totalMonto: number; totalPares: number }> {
  const { totalMonto, totalPares } = await sumFiTotalesDesdeDetalle(client, lock.fiId);
  await client.query(
    `UPDATE public.factura_interna SET total_monto = $2, total_pares = $3 WHERE id = $1`,
    [lock.fiId, totalMonto, totalPares],
  );
  await syncPedidoTotalesDesdeFis(client, lock.pedidoId);
  return { totalMonto, totalPares };
}
