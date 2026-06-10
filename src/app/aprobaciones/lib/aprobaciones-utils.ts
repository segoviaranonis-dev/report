import type { Pedido, PedidoEstado } from "./aprobaciones-types";

export function mapEstado(dbEstado: string | null): PedidoEstado {
  if (!dbEstado) return "PENDIENTE";
  const upper = dbEstado.toUpperCase();
  if (upper.includes("APROBADO") || upper.includes("CONFIRMADO")) return "APROBADO";
  if (upper.includes("RECHAZADO") || upper.includes("CANCELADO")) return "RECHAZADO";
  return "PENDIENTE";
}

export function calcStats(pedidos: Pedido[]) {
  return {
    pendientes: pedidos.filter((p) => p.estado === "PENDIENTE").length,
    aprobados: pedidos.filter((p) => p.estado === "APROBADO").length,
    rechazados: pedidos.filter((p) => p.estado === "RECHAZADO").length,
    total: pedidos.length,
  };
}
