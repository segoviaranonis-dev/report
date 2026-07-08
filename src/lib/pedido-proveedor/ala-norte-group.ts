/** Tipos Ala Norte — sin deps server (safe para client). */
import type { PpAlaNorteRow } from "./ala-norte-types";

export type { PpAlaNorteRow };

export type PpAlaNorteGroupedRow = PpAlaNorteRow & {
  /** Filas PPD fusionadas (1 = sin agrupación). */
  cajas_agrupadas: number;
};

function pilaresKey(r: PpAlaNorteRow): string {
  return [
    String(r.linea ?? "").trim(),
    String(r.referencia ?? "").trim(),
    String(r.material ?? "").trim(),
    String(r.color ?? "").trim(),
    String(r.grada ?? "").trim(),
  ].join("\u0001");
}

/** Agrupa solo coincidencia exacta en los 5 pilares (línea·ref·material·color·grada). */
export function groupAlaNorteByPilares(rows: PpAlaNorteRow[]): PpAlaNorteGroupedRow[] {
  const map = new Map<string, PpAlaNorteGroupedRow>();

  for (const r of rows) {
    const key = pilaresKey(r);
    const prev = map.get(key);
    if (prev) {
      map.set(key, {
        ...prev,
        cantidad_inicial: prev.cantidad_inicial + r.cantidad_inicial,
        vendido: prev.vendido + r.vendido,
        saldo: prev.saldo + r.saldo,
        cajas_agrupadas: prev.cajas_agrupadas + 1,
        cantidad_cajas: prev.cantidad_cajas + r.cantidad_cajas,
      });
    } else {
      map.set(key, { ...r, cajas_agrupadas: 1 });
    }
  }

  return Array.from(map.values());
}
