/**
 * Traductor vendedor FRANCIS → IDs sistema Carlos.
 * Espejo de: csv's/programado/casos francis.xlsx (Hoja1 · fila MATRIZ)
 * Nexus id_vendedor 9 = FRANCIS · Carlos id según matriz caso comercial.
 */
export type FrancisTranslator = {
  nexusVendedorId: number;
  nombre: string;
  carlosByMatriz: Record<string, number>;
  defaultCarlosId: number;
};

const FRANCIS_TRANSLATOR: FrancisTranslator = {
  nexusVendedorId: 9,
  nombre: "FRANCIS",
  carlosByMatriz: {
    "ACT-BRSPORT": 29,
    CARTERAS: 29,
    PROMOCIONAL: 58,
    CHINELO: 58,
    "BR-VZ-MD-ML-MKA-O": 29,
  },
  defaultCarlosId: 29,
};

export function loadFrancisTranslator(): FrancisTranslator {
  return FRANCIS_TRANSLATOR;
}

/** Caso comercial (nombre_caso_aplicado) → id vendedor Carlos. */
export function carlosVendedorIdFrancis(
  casoNombre: string | null | undefined,
  translator: FrancisTranslator = FRANCIS_TRANSLATOR,
): number {
  const raw = (casoNombre ?? "").trim().toUpperCase();
  if (!raw) return translator.defaultCarlosId;

  for (const [matriz, id] of Object.entries(translator.carlosByMatriz)) {
    const mk = matriz.toUpperCase();
    if (raw === mk || raw.includes(mk) || mk.includes(raw)) return id;
  }

  return translator.defaultCarlosId;
}
