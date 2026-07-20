/**
 * Logística OK — lexicono y tokens UI (2.3.1.28)
 * Doc: .claude/2_modulos/2.3_report/logistica_ok/CHUSAR_PALABRA_RESERVADA_FECHA_ENTREGA_REAL.md
 */

/** Palabra reservada Director · columna pedido_proveedor.fecha_arribo_real */
export const FECHA_ENTREGA_REAL_LABEL = "Fecha de entrega Real" as const;

/** Campo vendedor en logistica_pendiente_confirmacion.fecha_entrega_vendedor */
export const FECHA_ENTREGA_VENDEDOR_LABEL = "Fecha de entrega" as const;

export type EntidadAmLogistica = "CP" | "PE" | "PROGRAMADO";

export const ENTIDAD_AM_META: Record<
  EntidadAmLogistica,
  { label: string; color: string; sortPriority: number }
> = {
  PE: { label: "Pronta entrega", color: "#059669", sortPriority: 0 },
  CP: { label: "Compra previa", color: "#002B4E", sortPriority: 1 },
  PROGRAMADO: { label: "Programado", color: "#6D28D9", sortPriority: 2 },
};

export const LOGISTICA_PENDIENTE_TABLE = "logistica_pendiente_confirmacion" as const;
