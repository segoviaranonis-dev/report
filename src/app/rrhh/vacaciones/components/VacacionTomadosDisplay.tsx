import type { VacacionFuncionario } from "../lib/types";

/** Muestra horas en gerentes (HORAS/MIXTO) aunque estén en 0 */
export function debeMostrarHoras(v: Pick<VacacionFuncionario, "tipo_vacacion" | "horas_tomadas" | "horas_totales">): boolean {
  if ((v.horas_tomadas ?? 0) > 0) return true;
  if (v.tipo_vacacion === "HORAS" || v.tipo_vacacion === "MIXTO") return true;
  return (v.horas_totales ?? 0) > 0;
}

export function formatHoras(horas: number): string {
  const n = Number(horas);
  if (!Number.isFinite(n)) return "0h";
  return Number.isInteger(n) ? `${n}h` : `${n.toFixed(1)}h`;
}

interface VacacionTomadosDisplayProps {
  diasTomados: number;
  horasTomadas: number;
  tipoVacacion?: VacacionFuncionario["tipo_vacacion"];
  horasTotales?: number;
  /** sm = tarjeta/modal compacto · lg = hero */
  size?: "sm" | "lg";
  className?: string;
}

export function VacacionTomadosDisplay({
  diasTomados,
  horasTomadas,
  tipoVacacion = "DIAS",
  horasTotales = 0,
  size = "sm",
  className = "",
}: VacacionTomadosDisplayProps) {
  const muestraHoras = debeMostrarHoras({
    tipo_vacacion: tipoVacacion,
    horas_tomadas: horasTomadas,
    horas_totales: horasTotales,
  });

  const diasClass = size === "lg" ? "text-2xl font-extrabold" : "font-bold";
  const horasClass = size === "lg" ? "text-lg font-extrabold" : "text-sm font-extrabold";

  return (
    <div className={className}>
      <div className={`text-bazzar-naranja ${diasClass}`}>
        {diasTomados}
        {muestraHoras && (
          <span className={`ml-1 text-bazzar-naranja ${horasClass}`}>
            + {formatHoras(horasTomadas)}
          </span>
        )}
      </div>
    </div>
  );
}
