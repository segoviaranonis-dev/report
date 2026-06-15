/** Convierte valores PG (string | number) a número seguro */
export function numVacacion(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function formatHorasHistorial(horas: number): string {
  const n = numVacacion(horas);
  return Number.isInteger(n) ? `${n}h` : `${n.toFixed(1)}h`;
}

function parseFechaVacacion(s: string): Date {
  if (!s) return new Date(NaN);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T12:00:00`);
  return new Date(s);
}

const fmtDia = (d: Date) =>
  d.toLocaleDateString("es-PY", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/** Texto legible para una fila del historial */
export function formatPeriodoVacacion(
  fechaInicio: string,
  fechaFin: string | null,
  diasTomados: number,
  horasTomadas: number
): string {
  const inicio = parseFechaVacacion(fechaInicio);
  const fin = fechaFin ? parseFechaVacacion(fechaFin) : null;
  const dias = numVacacion(diasTomados);
  const horas = numVacacion(horasTomadas);

  if (horas > 0 && dias === 0) {
    return fmtDia(inicio);
  }

  if (fin && fin.toDateString() !== inicio.toDateString()) {
    const a = inicio.toLocaleDateString("es-PY", { day: "numeric", month: "short" });
    const b = fin.toLocaleDateString("es-PY", { day: "numeric", month: "short", year: "numeric" });
    return `${a} → ${b}`;
  }

  return fmtDia(inicio);
}

export function formatDuracionVacacion(diasTomados: number, horasTomadas: number): string {
  const dias = numVacacion(diasTomados);
  const horas = numVacacion(horasTomadas);
  const partes: string[] = [];
  if (dias > 0) partes.push(`${dias} día${dias > 1 ? "s" : ""}`);
  if (horas > 0) partes.push(formatHorasHistorial(horas));
  return partes.join(" · ") || "Sin duración";
}
