/**
 * Nomenclatura oficial depósitos Bazzar — canónico Report (sync) + documentación 18 tablas.
 * Patrón: deposito_{nivel}_{cliente_id}_{categoria}
 */

export type CategoriaDeposito = "tienda" | "guardado" | "averiado";

export type DepositoTiendaBase = {
  cliente_id: number;
  ente: "Fernando" | "San Martin" | "Palma";
  tipo: "Adultos" | "Niños";
  enteSlug: "fernando" | "sanmartin" | "palma";
  tipoSlug: "adultos" | "ninos";
  /** Caja tablet + sync + hub operativo */
  operativo: boolean;
  /** Marcas 10–15 · tipo_v2=2 */
  aceptaConfeccion: boolean;
  /** Palma: 1 local · adultos+niños+confección en 3100 */
  palmaUnica?: boolean;
};

/** Palma operativo — sin 3200 legacy */
export const PALMA_CLIENTE_ID = 3100;
export const CLIENTES_CONFECCION = [2900, 2700, PALMA_CLIENTE_ID] as const;

const TIENDAS: readonly DepositoTiendaBase[] = [
  {
    cliente_id: 2100,
    ente: "Fernando",
    tipo: "Adultos",
    enteSlug: "fernando",
    tipoSlug: "adultos",
    operativo: true,
    aceptaConfeccion: false,
  },
  {
    cliente_id: 2900,
    ente: "Fernando",
    tipo: "Niños",
    enteSlug: "fernando",
    tipoSlug: "ninos",
    operativo: true,
    aceptaConfeccion: true,
  },
  {
    cliente_id: 2400,
    ente: "San Martin",
    tipo: "Adultos",
    enteSlug: "sanmartin",
    tipoSlug: "adultos",
    operativo: true,
    aceptaConfeccion: false,
  },
  {
    cliente_id: 2700,
    ente: "San Martin",
    tipo: "Niños",
    enteSlug: "sanmartin",
    tipoSlug: "ninos",
    operativo: true,
    aceptaConfeccion: true,
  },
  {
    cliente_id: 3100,
    ente: "Palma",
    tipo: "Adultos",
    enteSlug: "palma",
    tipoSlug: "adultos",
    operativo: true,
    aceptaConfeccion: true,
    palmaUnica: true,
  },
  {
    cliente_id: 3200,
    ente: "Palma",
    tipo: "Niños",
    enteSlug: "palma",
    tipoSlug: "ninos",
    operativo: false,
    aceptaConfeccion: false,
  },
] as const;

export type EnteBazzarHub = "Fernando" | "San Martin" | "Palma";

export type HubTiendaCard = DepositoTiendaBase & {
  labelHub: string;
};

export const HUB_ENTES: { ente: EnteBazzarHub; slug: string; tiendas: HubTiendaCard[] }[] = [
  {
    ente: "Fernando",
    slug: "fernando",
    tiendas: TIENDAS.filter((t) => t.ente === "Fernando" && t.operativo).map((t) => ({
      ...t,
      labelHub: t.tipo,
    })),
  },
  {
    ente: "San Martin",
    slug: "sanmartin",
    tiendas: TIENDAS.filter((t) => t.ente === "San Martin" && t.operativo).map((t) => ({
      ...t,
      labelHub: t.tipo,
    })),
  },
  {
    ente: "Palma",
    slug: "palma",
    tiendas: TIENDAS.filter((t) => t.palmaUnica).map((t) => ({
      ...t,
      labelHub: "Tienda única",
    })),
  },
];

export function aceptaConfeccionCliente(clienteId: number): boolean {
  return TIENDAS.some((t) => t.cliente_id === clienteId && t.aceptaConfeccion);
}

export function getTiendaBase(clienteId: number): DepositoTiendaBase | undefined {
  return TIENDAS.find((t) => t.cliente_id === clienteId);
}

const CATEGORIAS: readonly { nivel: 1 | 2 | 3; categoria: CategoriaDeposito }[] = [
  { nivel: 1, categoria: "tienda" },
  { nivel: 2, categoria: "guardado" },
  { nivel: 3, categoria: "averiado" },
];

export function nombreTablaDeposito(
  nivel: 1 | 2 | 3,
  cliente_id: number,
  categoria: CategoriaDeposito,
): string {
  return `deposito_${nivel}_${cliente_id}_${categoria}`;
}

export type DepositoConfig = DepositoTiendaBase & {
  nivel: 1 | 2 | 3;
  categoria: CategoriaDeposito;
  tabla: string;
};

export const DEPOSITOS_MATRIZ: DepositoConfig[] = TIENDAS.flatMap((t) =>
  CATEGORIAS.map((c) => ({
    ...t,
    nivel: c.nivel,
    categoria: c.categoria,
    tabla: nombreTablaDeposito(c.nivel, t.cliente_id, c.categoria),
  })),
);

/** Sync administrador Report — solo piso tienda operativa (excluye 3200 legacy) */
export const DEPOSITOS_CONFIG = DEPOSITOS_MATRIZ.filter(
  (d) => d.categoria === "tienda" && d.operativo,
);

export const CATEGORIA_DEPOSITO_META: Record<
  CategoriaDeposito,
  { label: string; descripcion: string; nivel: 1 | 2 | 3; tablet: boolean }
> = {
  tienda: {
    label: "TIENDA",
    descripcion: "Stock piso · sync Retail · conectado a Tablet Bazzar",
    nivel: 1,
    tablet: true,
  },
  guardado: {
    label: "GUARDADO",
    descripcion: "Bodega / reserva · solo consulta admin",
    nivel: 2,
    tablet: false,
  },
  averiado: {
    label: "AVERIADO",
    descripcion: "Mercadería dañada · solo consulta admin",
    nivel: 3,
    tablet: false,
  },
};

export function parseCategoriaDeposito(raw: string | null | undefined): CategoriaDeposito {
  if (raw === "guardado" || raw === "averiado") return raw;
  return "tienda";
}

export function getDepositosByCategoria(categoria: CategoriaDeposito): DepositoConfig[] {
  return DEPOSITOS_MATRIZ.filter((d) => d.categoria === categoria);
}

export function getDepositoConfig(
  cliente_id: number,
  categoria: CategoriaDeposito = "tienda",
): DepositoConfig | undefined {
  return DEPOSITOS_MATRIZ.find((d) => d.cliente_id === cliente_id && d.categoria === categoria);
}

export function getDepositoByClienteId(cliente_id: number): DepositoConfig | undefined {
  return getDepositoConfig(cliente_id, "tienda");
}

export function getTablaByClienteId(cliente_id: number): string | undefined {
  return getDepositoByClienteId(cliente_id)?.tabla;
}

export const DEPOSITOS_MAP: Record<number, string> = Object.fromEntries(
  DEPOSITOS_CONFIG.map((d) => [d.cliente_id, d.tabla]),
);

export const ENTES_MAP: Record<number, { ente: string; tipo: string }> = Object.fromEntries(
  DEPOSITOS_CONFIG.map((d) => [d.cliente_id, { ente: d.ente, tipo: d.tipo }]),
);
