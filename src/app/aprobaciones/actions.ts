"use server";

import { revalidatePath } from "next/cache";
import {
  anularFi,
  confirmarFi,
  actualizarListaPrecioFi,
  rechazarPedido,
  eliminarItemFi,
  modificarCantidadItemFi,
  cambiarClienteFi,
  cambiarVendedorFi,
  actualizarEncabezadoFi,
  resincronizarFiDesdeListadoPp,
} from "./lib/aprobaciones-mutations";
import { requireNivelDiosAction } from "./lib/require-nivel-dios";

export async function confirmarFiAction(fiId: number) {
  const gate = await requireNivelDiosAction();
  if (!gate.ok) return { success: false, error: gate.error };
  const result = await confirmarFi(fiId);
  if (result.ok) revalidatePath("/aprobaciones");
  return { success: result.ok, message: result.msg, error: result.ok ? undefined : result.msg };
}

export async function anularFiAction(fiId: number, motivo: string) {
  const gate = await requireNivelDiosAction();
  if (!gate.ok) return { success: false, error: gate.error };
  const result = await anularFi(fiId, motivo);
  if (result.ok) revalidatePath("/aprobaciones");
  return { success: result.ok, message: result.msg, error: result.ok ? undefined : result.msg };
}

export async function rechazarPedidoAction(pedidoId: number, motivo: string) {
  const gate = await requireNivelDiosAction();
  if (!gate.ok) return { success: false, error: gate.error };
  if (!motivo.trim()) {
    return { success: false, error: "Ingresá un motivo para rechazar el pedido." };
  }
  const result = await rechazarPedido(pedidoId, motivo);
  if (result.ok) revalidatePath("/aprobaciones");
  return { success: result.ok, message: result.msg, error: result.ok ? undefined : result.msg };
}

export async function cambiarListaPrecioFiAction(fiId: number, listaPrecioId: number) {
  const gate = await requireNivelDiosAction();
  if (!gate.ok) return { success: false, error: gate.error };
  const result = await actualizarListaPrecioFi(fiId, listaPrecioId);
  if (result.ok) revalidatePath("/aprobaciones");
  return {
    success: result.ok,
    message: result.msg,
    error: result.ok ? undefined : result.msg,
    totalMonto: result.totalMonto,
  };
}

export async function eliminarItemFiAction(fiDetalleId: number) {
  const gate = await requireNivelDiosAction();
  if (!gate.ok) return { success: false, error: gate.error };
  const result = await eliminarItemFi(fiDetalleId);
  if (result.ok) revalidatePath("/aprobaciones");
  return { success: result.ok, message: result.msg, error: result.ok ? undefined : result.msg };
}

export async function modificarCantidadItemFiAction(
  fiDetalleId: number,
  cajas: number,
  pares: number,
) {
  const gate = await requireNivelDiosAction();
  if (!gate.ok) return { success: false, error: gate.error };
  const result = await modificarCantidadItemFi(fiDetalleId, cajas, pares);
  if (result.ok) revalidatePath("/aprobaciones");
  return { success: result.ok, message: result.msg, error: result.ok ? undefined : result.msg };
}

export async function cambiarClienteFiAction(fiId: number, clienteId: number) {
  const gate = await requireNivelDiosAction();
  if (!gate.ok) return { success: false, error: gate.error };
  const result = await cambiarClienteFi(fiId, clienteId);
  if (result.ok) revalidatePath("/aprobaciones");
  return {
    success: result.ok,
    message: result.msg,
    error: result.ok ? undefined : result.msg,
    clienteNombre: result.clienteNombre,
  };
}

export async function cambiarVendedorFiAction(fiId: number, vendedorId: number) {
  const gate = await requireNivelDiosAction();
  if (!gate.ok) return { success: false, error: gate.error };
  const result = await cambiarVendedorFi(fiId, vendedorId);
  if (result.ok) revalidatePath("/aprobaciones");
  return {
    success: result.ok,
    message: result.msg,
    error: result.ok ? undefined : result.msg,
    vendedorNombre: result.vendedorNombre,
  };
}

export async function actualizarEncabezadoFiAction(
  fiId: number,
  input: {
    plazoId: number;
    descuento_1: number;
    descuento_2: number;
    descuento_3: number;
    descuento_4: number;
  },
) {
  const gate = await requireNivelDiosAction();
  if (!gate.ok) return { success: false, error: gate.error };
  const result = await actualizarEncabezadoFi(fiId, input);
  if (result.ok) revalidatePath("/aprobaciones");
  return {
    success: result.ok,
    message: result.msg,
    error: result.ok ? undefined : result.msg,
    totalMonto: result.totalMonto,
  };
}

export async function resincronizarFiDesdeListadoPpAction(fiId: number) {
  const gate = await requireNivelDiosAction();
  if (!gate.ok) return { success: false, error: gate.error };
  const result = await resincronizarFiDesdeListadoPp(fiId, { usarRedondeoComercial: true });
  if (result.ok) revalidatePath("/aprobaciones");
  return {
    success: result.ok,
    message: result.msg,
    error: result.ok ? undefined : result.msg,
    totalMonto: result.totalMonto,
    lineas: result.lineas,
  };
}
