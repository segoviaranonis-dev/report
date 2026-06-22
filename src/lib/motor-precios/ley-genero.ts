/** Ley de género — paridad `control_central/modules/rimec_engine/ley_genero.py` */

export const LEY_GENERO_REGLAS: ReadonlyArray<readonly [string, string]> = [
  ["MOLEKINHA", "NIÑAS"],
  ["MOLEKINHO", "NIÑOS"],
  ["ACTVITTA", "DAMAS"],
  ["VIZZANO", "DAMAS"],
  ["BEIRA RIO", "DAMAS"],
  ["MODARE", "DAMAS"],
  ["MOLECA", "DAMAS"],
  ["BR SPORT", "CABALLEROS"],
];

export const GENEROS_LEY = ["DAMAS", "NIÑAS", "NIÑOS", "CABALLEROS"] as const;

export function normalizarMarca(nombre: string): string {
  return String(nombre || "")
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

export function generoCodigoPorMarca(nombreMarca: string): string | null {
  const m = normalizarMarca(nombreMarca);
  if (!m) return null;
  for (const [patron, genero] of LEY_GENERO_REGLAS) {
    if (m.includes(patron)) return genero;
  }
  return null;
}

export type LeyGeneroResult = {
  ok: boolean;
  asignaciones: Record<string, string>;
  marcas_rechazadas: string[];
  generos_faltantes_bd: string[];
};

/** Valida marcas del Excel antes de crear evento (BD géneros se valida en API). */
export function validarLeyGeneroMarcas(marcas: string[]): Omit<LeyGeneroResult, "generos_faltantes_bd"> & {
  generos_faltantes_bd?: string[];
} {
  const asignaciones: Record<string, string> = {};
  const rechazadas: string[] = [];
  const visto = new Set<string>();

  for (const raw of marcas) {
    const marca = String(raw).trim();
    if (!marca) continue;
    const key = normalizarMarca(marca);
    if (visto.has(key)) continue;
    visto.add(key);
    const genero = generoCodigoPorMarca(marca);
    if (genero) asignaciones[marca] = genero;
    else rechazadas.push(marca);
  }

  return {
    ok: rechazadas.length === 0,
    asignaciones,
    marcas_rechazadas: rechazadas,
  };
}

export const LEY_GENERO_RESUMEN = `Cada hoja/marca del Excel debe mapear a un género canónico (DAMAS, NIÑAS, NIÑOS, CABALLEROS).
BEIRA RIO, VIZZANO, MODARE, MOLECA → DAMAS · MOLEKINHA → NIÑAS · MOLEKINHO → NIÑOS · BR SPORT → CABALLEROS.
Si una marca no encaja, la importación se detiene antes de crear el evento.`;
