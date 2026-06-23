import { DEPOSITOS_CONFIG } from "@/lib/depositos/depositos-config";

export const CAJA_CLIENTE_IDS = [2100, 2900, 2400, 2700, 3100, 3200] as const;

export type CajaClienteId = (typeof CAJA_CLIENTE_IDS)[number];

export type CajaTienda = {
  cliente_id: CajaClienteId;
  ente: string;
  tipo: string;
  label: string;
  codigo: string;
  tabla_tienda: string;
  navegador: string;
};

const CODIGOS: Record<CajaClienteId, string> = {
  2100: "2.3.2.2.1",
  2900: "2.3.2.2.2",
  2400: "2.3.2.2.3",
  2700: "2.3.2.2.4",
  3100: "2.3.2.2.5",
  3200: "2.3.2.2.6",
};

export const CAJA_TIENDAS: CajaTienda[] = DEPOSITOS_CONFIG.map((d) => ({
  cliente_id: d.cliente_id as CajaClienteId,
  ente: d.ente,
  tipo: d.tipo,
  label: `${d.ente} ${d.tipo}`,
  codigo: CODIGOS[d.cliente_id as CajaClienteId],
  tabla_tienda: d.tabla,
  navegador: CODIGOS[d.cliente_id as CajaClienteId],
}));

export function isCajaClienteId(v: number): v is CajaClienteId {
  return (CAJA_CLIENTE_IDS as readonly number[]).includes(v);
}

export function getCajaTienda(cliente_id: number): CajaTienda | undefined {
  return CAJA_TIENDAS.find((t) => t.cliente_id === cliente_id);
}

export const TIENDA_LABEL = new Map(CAJA_TIENDAS.map((t) => [t.cliente_id, t.label]));
