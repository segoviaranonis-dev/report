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
};

const TIENDAS: readonly DepositoTiendaBase[] = [
  { cliente_id: 2100, ente: "Fernando", tipo: "Adultos", enteSlug: "fernando", tipoSlug: "adultos" },
  { cliente_id: 2900, ente: "Fernando", tipo: "Niños", enteSlug: "fernando", tipoSlug: "ninos" },
  { cliente_id: 2400, ente: "San Martin", tipo: "Adultos", enteSlug: "sanmartin", tipoSlug: "adultos" },
  { cliente_id: 2700, ente: "San Martin", tipo: "Niños", enteSlug: "sanmartin", tipoSlug: "ninos" },
  { cliente_id: 3100, ente: "Palma", tipo: "Adultos", enteSlug: "palma", tipoSlug: "adultos" },
  { cliente_id: 3200, ente: "Palma", tipo: "Niños", enteSlug: "palma", tipoSlug: "ninos" },
] as const;

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

/** Sync administrador Report — solo piso tienda */
export const DEPOSITOS_CONFIG = DEPOSITOS_MATRIZ.filter((d) => d.categoria === "tienda");

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
