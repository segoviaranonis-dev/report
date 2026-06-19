export const ALM_TRANSITO = 3;
export const ALM_WEB_BAZAR = 1;
export const ALM_DEPOSITO_RIMEC = 4;
export const CLIENTE_WEB_BAZAR_ID = 5000;

export const CL_ESTADOS = ["PENDIENTE", "DISTRIBUIDA", "ENVIADO", "CERRADA"] as const;
export const TRP_ESTADOS = ["BORRADOR", "ENVIADO", "CONFIRMADO"] as const;
export const FI_ESTADOS_FACTURADOS = ["CONFIRMADA", "RESERVADA"] as const;

export const CL_ESTADO_LABEL: Record<string, string> = {
  PENDIENTE: "Pendiente",
  DISTRIBUIDA: "Distribuida",
  ENVIADO: "Enviado",
  CERRADA: "Cerrada",
};

export const CL_ESTADO_COLOR: Record<string, { bg: string; fg: string }> = {
  PENDIENTE: { bg: "#FEF3C7", fg: "#92400E" },
  DISTRIBUIDA: { bg: "#DBEAFE", fg: "#1E40AF" },
  ENVIADO: { bg: "#FFEDD5", fg: "#C2410C" },
  CERRADA: { bg: "#D1FAE5", fg: "#065F46" },
};

export const TRP_ESTADO_LABEL: Record<string, string> = {
  BORRADOR: "En tránsito",
  ENVIADO: "En facturación",
  CONFIRMADO: "En depósito web",
  SIN_TRASPASO: "Sin traspaso",
};

export const TRP_ESTADO_COLOR: Record<string, { bg: string; fg: string }> = {
  BORRADOR: { bg: "#FEF3C7", fg: "#92400E" },
  ENVIADO: { bg: "#FFEDD5", fg: "#C2410C" },
  CONFIRMADO: { bg: "#D1FAE5", fg: "#065F46" },
  SIN_TRASPASO: { bg: "#F1F5F9", fg: "#475569" },
};
