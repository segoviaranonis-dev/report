/**
 * Variación % respecto al objetivo (Monto Obj, etc.).
 * Fórmula estándar: ((real − objetivo) / objetivo) × 100 (positivo si el real supera el objetivo).
 */
export function variacionPctVsObjetivo(montoObjetivo: number, montoReal: number): number | null {
  if (montoObjetivo > 0) {
    const raw = ((montoReal - montoObjetivo) / montoObjetivo) * 100;
    if (!Number.isFinite(raw)) return null;
    return raw;
  }
  if (montoReal > 0) return null;
  return 0;
}
