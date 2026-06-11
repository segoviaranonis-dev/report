/**
 * Contrato Nivel Dios — toda edición en Aprobaciones persiste en BD en la misma transacción.
 * Gemelo de logic.py; el pedido web (PVR) refleja la suma de sus FIs activas.
 */
import type { PoolClient } from "pg";

/** Recalcula cabecera pedido_venta_rimec desde FIs no anuladas del mismo pedido. */
export async function syncPedidoTotalesDesdeFis(
  client: PoolClient,
  pedidoId: number | null | undefined,
): Promise<void> {
  if (pedidoId == null) return;

  await client.query(
    `
    UPDATE public.pedido_venta_rimec pvr
    SET
      total_pares = COALESCE(sub.sum_pares, 0),
      total_monto = COALESCE(sub.sum_monto, 0)
    FROM (
      SELECT
        SUM(total_pares)::int AS sum_pares,
        SUM(total_monto)::numeric AS sum_monto
      FROM public.factura_interna
      WHERE pedido_id = $1
        AND UPPER(COALESCE(estado, '')) <> 'ANULADA'
    ) sub
    WHERE pvr.id = $1
  `,
    [pedidoId],
  );
}

/** Si el pedido tiene una sola FI activa, alinea lista_precio_id del PVR con la FI. */
export async function syncPedidoListaSiUnicaFi(
  client: PoolClient,
  pedidoId: number | null | undefined,
  listaPrecioId: number,
): Promise<void> {
  if (pedidoId == null) return;

  const { rows } = await client.query<{ n: string }>(
    `
    SELECT COUNT(*)::text AS n
    FROM public.factura_interna
    WHERE pedido_id = $1
      AND UPPER(COALESCE(estado, '')) <> 'ANULADA'
  `,
    [pedidoId],
  );
  if (parseInt(rows[0]?.n ?? "0", 10) === 1) {
    await client.query(
      `UPDATE public.pedido_venta_rimec SET lista_precio_id = $2 WHERE id = $1`,
      [pedidoId, listaPrecioId],
    );
  }
}

/** Suma subtotales desde detalle — verdad final post-UPDATE líneas. */
export async function sumFiTotalesDesdeDetalle(
  client: PoolClient,
  fiId: number,
): Promise<{ totalMonto: number; totalPares: number }> {
  const { rows } = await client.query<{ total_monto: string; total_pares: string }>(
    `
    SELECT
      COALESCE(SUM(subtotal), 0)::text AS total_monto,
      COALESCE(SUM(pares), 0)::text AS total_pares
    FROM public.factura_interna_detalle
    WHERE factura_id = $1
  `,
    [fiId],
  );
  return {
    totalMonto: Math.round(Number(rows[0]?.total_monto) || 0),
    totalPares: parseInt(rows[0]?.total_pares ?? "0", 10) || 0,
  };
}

/** Alinea encabezado PVR con la FI si es la única activa del pedido. */
export async function syncPedidoEncabezadoDesdeFi(
  client: PoolClient,
  pedidoId: number | null | undefined,
  fi: {
    lista_precio_id: number;
    plazo_id: number | null;
    vendedor_id?: number | null;
    cliente_id?: number | null;
    descuento_1: number;
    descuento_2: number;
    descuento_3: number;
    descuento_4: number;
  },
): Promise<void> {
  if (pedidoId == null) return;

  const { rows } = await client.query<{ n: string }>(
    `
    SELECT COUNT(*)::text AS n
    FROM public.factura_interna
    WHERE pedido_id = $1
      AND UPPER(COALESCE(estado, '')) <> 'ANULADA'
  `,
    [pedidoId],
  );
  if (parseInt(rows[0]?.n ?? "0", 10) !== 1) return;

  await client.query(
    `
    UPDATE public.pedido_venta_rimec
    SET
      lista_precio_id = $2,
      plazo_id = $3,
      descuento_1 = $4,
      descuento_2 = $5,
      descuento_3 = $6,
      descuento_4 = $7,
      vendedor_id = COALESCE($8, vendedor_id),
      cliente_id = COALESCE($9, cliente_id)
    WHERE id = $1
  `,
    [
      pedidoId,
      fi.lista_precio_id,
      fi.plazo_id,
      fi.descuento_1,
      fi.descuento_2,
      fi.descuento_3,
      fi.descuento_4,
      fi.vendedor_id ?? null,
      fi.cliente_id ?? null,
    ],
  );
}
