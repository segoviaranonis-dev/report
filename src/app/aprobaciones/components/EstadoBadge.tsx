import type { PedidoEstado } from "../lib/aprobaciones-types";

type EstadoBadgeProps = {
  estado: PedidoEstado;
};

const styles: Record<PedidoEstado, string> = {
  PENDIENTE: "bg-semantic-warning/20 text-semantic-warning",
  APROBADO: "bg-semantic-success/20 text-semantic-success",
  RECHAZADO: "bg-semantic-error/20 text-semantic-error",
};

export function EstadoBadge({ estado }: EstadoBadgeProps) {
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${styles[estado]}`}
    >
      {estado}
    </span>
  );
}
