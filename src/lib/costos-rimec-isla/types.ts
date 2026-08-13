/** Lista precio venta · paridad listado_precio (LPN +12% / +20%). */
export type ListaCostosTier = "LPN" | "LPC03" | "LPC04";

export const LISTA_COSTOS_TIERS: ReadonlyArray<{
  id: ListaCostosTier;
  label: string;
  mult: number;
  hint: string;
}> = [
  { id: "LPN", label: "LPN", mult: 1, hint: "Base · referencia" },
  { id: "LPC03", label: "LPC03", mult: 1.12, hint: "LPN + 12%" },
  { id: "LPC04", label: "LPC04", mult: 1.2, hint: "LPN + 20%" },
] as const;

export function multListaCostos(tier: ListaCostosTier): number {
  return LISTA_COSTOS_TIERS.find((t) => t.id === tier)?.mult ?? 1;
}

export type CostosDepositoSlot = "D1" | "D2" | "D3" | "D4";

export const COSTOS_DEPOSITOS: ReadonlyArray<{
  slot: CostosDepositoSlot;
  keys: string[];
  label: string;
}> = [
  { slot: "D1", keys: ["S00_D1", "D1"], label: "D1 · piso" },
  { slot: "D2", keys: ["S00_DEP2", "DEP2", "D2"], label: "D2 · bodega" },
  { slot: "D3", keys: ["S00_D3", "D3"], label: "D3 · PE" },
  { slot: "D4", keys: ["S00_D4", "D4", "DEP4"], label: "D4" },
];

export type CostosTxtDepositoKey = string;

export type CostosTxtLinea = {
  codigo: string;
  descripcion: string;
  qty: number;
  dlsUsd: number;
  lpnGs: number;
  montoUsd: number;
  depositoKey: CostosTxtDepositoKey;
  grupoTexto: string;
  linea: string;
  referencia: string;
  material: string;
  color: string;
  /** Kyly 638 — color Excel (K0001) para imagen. */
  imagenColorExcel: string | null;
  /** Kyly 638 — talla/grada Carlos (TAM en detalle). */
  grada: string | null;
  tipoV2Id: 1 | 2 | null;
  proveedorId: 654 | 638 | null;
  marca: string | null;
  ramo: "CALZADOS" | "CONFECCIONES" | null;
  tipo1: string | null;
  cadena: CostosCadenaDpe | null;
};

export type CostosTxtArchivo = {
  nombre: string;
  depositoCabecera: string | null;
  depositoKey: CostosTxtDepositoKey;
  depositoSlot: CostosDepositoSlot | null;
  lineas: CostosTxtLinea[];
  articulos: number;
  pares: number;
  montoUsd: number;
  valorLpnGs: number;
};

/** Etiqueta canónica DPE — nunca REGULAR en UI (ley 2.3.1.10.1.2.1 · NORMAL). */
export type CostosCadenaDpe = "NORMAL" | "PROMOCIONAL" | "LIQUIDACION" | "COMUN";

export function normalizeCadenaDpe(raw: string | null | undefined): CostosCadenaDpe | null {
  const u = String(raw ?? "").trim().toUpperCase();
  if (!u || u === "REGULAR") return "NORMAL";
  if (u === "PROMOCIONAL" || u === "PROMO") return "PROMOCIONAL";
  if (u === "LIQUIDACION" || u === "LIQ") return "LIQUIDACION";
  if (u === "COMUN") return "COMUN";
  if (u === "NORMAL") return "NORMAL";
  return null;
}

export function labelCadenaDpe(c: CostosCadenaDpe | null): string {
  if (!c) return "—";
  return c;
}

export type CostosFiltrosDpe = {
  proveedor: "" | "654" | "638";
  ramo: "" | "CALZADOS" | "CONFECCIONES";
  marcas: string[];
  tipo1: string[];
  cadena: CostosCadenaDpe[];
};

export type CostosSimulacion = {
  listaTier: ListaCostosTier;
  /** Descuentos cascada FI · % entero (paridad factorDescuentosFiPct). */
  descuento1: number;
  descuento2: number;
  descuento3: number;
  descuento4: number;
  cotizUsd: number;
  /** Costo unitario: LPN paralelo TXT o Dls×cotización */
  baseCosto: "lpn" | "dls";
};

export type FilaMargenCalc = {
  linea: CostosTxtLinea;
  /** Dls unitario Carlos (ACT). */
  usdUnit: number;
  /** Dls × cotización gerencia. */
  costoUnitGs: number;
  /** LP tier sin descuento cliente. */
  precioListaGs: number;
  /** LP tier con descuento cliente. */
  precioVentaGs: number;
  margenGsPar: number;
  /** % descuento adicional máx. sobre LP c/desc (D1–D4 ya aplicados) antes de costo. */
  margenPctVenta: number;
  /** @deprecated UI — reemplazado por margenPctVenta en columna gerencia. */
  margenPctCosto: number;
  /** Gs/par ÷ LP s/desc × 100 — cuánto del listado queda de margen. */
  margenPctLista: number;
  encimaCosto: boolean;
  gananciaStockGs: number;
  ganancia1000Gs: number;
};

export type CostosTxtResumen = {
  archivos: number;
  depositosActivos: CostosTxtDepositoKey[];
  articulos: number;
  pares: number;
  montoUsd: number;
  valorLpnGs: number;
  porDeposito: {
    deposito: CostosTxtDepositoKey;
    archivos: string[];
    articulos: number;
    pares: number;
    montoUsd: number;
    valorLpnGs: number;
  }[];
};
