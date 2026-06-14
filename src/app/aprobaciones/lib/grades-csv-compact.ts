/** Grada compacta para CSV legacy — paridad core/csv_utils.py */

export function gradesJsonToCompacto(raw: unknown): string {
  if (!raw) return "N/A";
  let grades: Record<string, number> | null = null;
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    grades = raw as Record<string, number>;
  } else if (typeof raw === "string") {
      try {
        grades = JSON.parse(raw) as Record<string, number>;
      } catch {
        try {
          grades = JSON.parse(raw.replace(/'/g, '"')) as Record<string, number>;
        } catch {
          return "N/A";
        }
      }
  }
  if (!grades || Object.keys(grades).length === 0) return "N/A";

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
