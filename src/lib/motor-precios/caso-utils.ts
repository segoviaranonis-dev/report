export type CasoInput = {
  nombre_caso?: string;
  dolar_politica?: number | null;
  factor_conversion?: number | null;
  descuento_1?: number | null;
  descuento_2?: number | null;
  descuento_3?: number | null;
  descuento_4?: number | null;
  genera_lpc03_lpc04?: boolean;
  lineas?: string[];
  marcas?: string[] | null;
  alcance_tipo?: string;
};

export function pctDesdeDecimal(val: unknown): number {
  if (val == null) return 0;
  const n = Number(val);
  return Number.isFinite(n) ? Math.round(n * 10000) / 100 : 0;
}

export function descuentosDesdePct(d1: number, d2: number, d3: number, d4: number) {
  return {
    descuento_1: d1 > 0 ? Math.round((d1 / 100) * 1e6) / 1e6 : null,
    descuento_2: d2 > 0 ? Math.round((d2 / 100) * 1e6) / 1e6 : null,
    descuento_3: d3 > 0 ? Math.round((d3 / 100) * 1e6) / 1e6 : null,
    descuento_4: d4 > 0 ? Math.round((d4 / 100) * 1e6) / 1e6 : null,
  };
}

export function calcIndiceGs(dolar: number, factor: number): number {
  return Math.trunc((dolar * factor) / 100);
}

/** Exclusividad BCL: una línea solo en un caso por biblioteca. */
export function validarExclusividadCasosLineas(
  casos: Array<{ nombre_caso: string; lineas: string[] }>,
): string[] {
  const owner = new Map<string, string>();
  const conflictos: string[] = [];
  for (const c of casos) {
    for (const cod of c.lineas) {
      const prev = owner.get(cod);
      if (prev && prev !== c.nombre_caso) {
        conflictos.push(`Línea ${cod}: «${prev}» y «${c.nombre_caso}»`);
      } else {
        owner.set(cod, c.nombre_caso);
      }
    }
  }
  return conflictos;
}

export function normalizarCaso(rec: CasoInput) {
  const lineas = Array.isArray(rec.lineas) ? rec.lineas.map(String) : [];
  const dolar = Number(rec.dolar_politica ?? 8000) || 8000;
  const factor = Number(rec.factor_conversion ?? 180) || 180;
  return {
    nombre_caso: String(rec.nombre_caso ?? "")
      .replace(/\*/g, "")
      .trim(),
    dolar_politica: dolar,
    factor_conversion: factor,
    descuento_1: rec.descuento_1 ?? null,
    descuento_2: rec.descuento_2 ?? null,
    descuento_3: rec.descuento_3 ?? null,
    descuento_4: rec.descuento_4 ?? null,
    genera_lpc03_lpc04: rec.genera_lpc03_lpc04 !== false,
    lineas,
    alcance_tipo: lineas.length ? "lineas" : "lineas",
  };
}
