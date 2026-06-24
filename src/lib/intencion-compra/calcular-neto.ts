/** Descuento en cascada — paridad logic.py calcular_neto */
export function calcularNeto(bruto: number, d1: number, d2: number, d3: number, d4: number): number {
  let neto = bruto;
  for (const pct of [d1, d2, d3, d4]) {
    if (pct > 0) neto *= 1 - pct / 100;
  }
  return Math.round(neto * 100) / 100;
}
