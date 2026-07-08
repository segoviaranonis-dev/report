import type { Pool } from "pg";
import { actualizarListaPrecioFi } from "@/app/aprobaciones/lib/aprobaciones-mutations";
import { esListadoPrecioValido } from "@/lib/intencion-compra/listado-precio-tiers";

/** Rellena plazo/LP/descuentos FI desde IC vinculada (SHOP = id_cliente). */
export async function syncFiEncabezadoDesdeIc(pool: Pool, ppId: number): Promise<void> {
  await pool.query(
    `UPDATE factura_interna fi
     SET plazo_id = ic.id_plazo
     FROM intencion_compra_pedido icp
     JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
     WHERE icp.pedido_proveedor_id = fi.pp_id
       AND ic.id_cliente = fi.cliente_id
       AND fi.pp_id = $1
       AND fi.plazo_id IS NULL
       AND ic.id_plazo IS NOT NULL`,
    [ppId],
  );
  await pool.query(
    `UPDATE factura_interna fi
     SET lista_precio_id = ic.listado_precio_id
     FROM intencion_compra_pedido icp
     JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
     WHERE icp.pedido_proveedor_id = fi.pp_id
       AND ic.id_cliente = fi.cliente_id
       AND fi.pp_id = $1
       AND ic.listado_precio_id IS NOT NULL
       AND (fi.lista_precio_id IS NULL OR fi.lista_precio_id = 1)
       AND ic.listado_precio_id <> COALESCE(fi.lista_precio_id, 0)`,
    [ppId],
  );
}

export async function actualizarListaPrecioFiDesdePp(
  pool: Pool,
  ppId: number,
  fiId: number,
  listaPrecioId: number,
): Promise<{ ok: true; totalMonto?: number } | { ok: false; error: string }> {
  if (!esListadoPrecioValido(listaPrecioId)) {
    return { ok: false, error: "Política LP inválida (1–4)." };
  }

  const link = await pool.query<{ id: string }>(
    `SELECT fi.id FROM factura_interna fi WHERE fi.id = $1 AND fi.pp_id = $2`,
    [fiId, ppId],
  );
  if (!link.rowCount) {
    return { ok: false, error: "FI no pertenece a este PP." };
  }

  const result = await actualizarListaPrecioFi(fiId, listaPrecioId);
  if (!result.ok) {
    return { ok: false, error: result.msg };
  }

  await pool.query(
    `UPDATE intencion_compra ic
     SET listado_precio_id = $3
     FROM intencion_compra_pedido icp
     JOIN factura_interna fi ON fi.pp_id = icp.pedido_proveedor_id AND fi.cliente_id = ic.id_cliente
     WHERE ic.id = icp.intencion_compra_id
       AND icp.pedido_proveedor_id = $1
       AND fi.id = $2`,
    [ppId, fiId, listaPrecioId],
  );

  return { ok: true, totalMonto: result.totalMonto };
}
