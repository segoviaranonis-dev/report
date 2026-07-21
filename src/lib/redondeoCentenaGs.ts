/**
 * Redondeo comercial RIMEC — centena más próxima (Gs.).
 * Paridad siamese rimec-web/lib/redondeoCentenaGs.ts
 */
export function redondearCentenaGs(n: number): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x / 100) * 100;
}
