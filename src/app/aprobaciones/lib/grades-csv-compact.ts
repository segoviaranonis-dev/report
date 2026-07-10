/** Grada compacta para CSV legacy — paridad core/csv_utils.py */

import { gradesJsonSoloTallas } from "@/lib/pedido-proveedor/grades-json-canonical";

export function gradesJsonToCompacto(raw: unknown): string {
  const grades = gradesJsonSoloTallas(raw);
  if (Object.keys(grades).length === 0) return "N/A";

  const items = Object.entries(grades).sort(
    (a, b) => parseInt(a[0], 10) - parseInt(b[0], 10),
  );
  const intermedio = items.map(([t, c]) => `${t}:${c}`).join(" · ");
  return formatearGradasCompacto(intermedio);
}

function formatearGradasCompacto(gradasFmt: string): string {
  if (!gradasFmt.trim()) return "";
  try {
    const pares = gradasFmt.split("·").map((p) => p.trim());
    const tallas: string[] = [];
    const cantidades: string[] = [];
    for (const par of pares) {
      if (par.includes(":")) {
        const [talla, cant] = par.split(":");
        tallas.push(talla.trim());
        cantidades.push(cant.trim());
      }
    }
    if (!tallas.length) return gradasFmt;
    return `${tallas[0]}(${cantidades.join(" ")})${tallas[tallas.length - 1]}`;
  } catch {
    return gradasFmt;
  }
}
