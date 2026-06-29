export type LineaOrdenable = { controlado: boolean; codigo_oro: string };

/** Pendientes arriba (1.1) · controlados al final. */
export function ordenarLineasEmpaque<T extends LineaOrdenable>(lineas: T[]): T[] {
  return [...lineas].sort((a, b) => {
    if (a.controlado !== b.controlado) return a.controlado ? 1 : -1;
    return a.codigo_oro.localeCompare(b.codigo_oro);
  });
}
