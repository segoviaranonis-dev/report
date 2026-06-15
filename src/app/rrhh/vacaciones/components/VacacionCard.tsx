import type { VacacionFuncionario } from "../lib/types";
import { VacacionTomadosDisplay, debeMostrarHoras, formatHoras } from "./VacacionTomadosDisplay";

interface VacacionCardProps {
  vacacion: VacacionFuncionario;
  onClick?: () => void;
}

export function VacacionCard({ vacacion, onClick }: VacacionCardProps) {
  const iniciales = vacacion.nombres
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  // Porcentaje de vacaciones tomadas (días; horas aparte)
  const porcentajeTomado = vacacion.dias_totales > 0
    ? Math.round((vacacion.dias_tomados / vacacion.dias_totales) * 100)
    : 0;
  const tieneHoras = debeMostrarHoras(vacacion);

  // Color según días pendientes
  const getColorPendientes = () => {
    if (vacacion.dias_pendientes === 0) return "text-neutral-500";
    if (vacacion.dias_pendientes <= 10) return "text-bazzar-naranja";
    return "text-success";
  };

  // Badge color según ente
  const badgeColor =
    vacacion.ente_codigo === 1
      ? "bg-rimec-azul text-white" // RIMEC
      : "bg-bazzar-naranja text-white"; // Tiendas

  return (
    <article
      onClick={onClick}
      className="group relative overflow-hidden rounded-xl border-2 border-neutral-200 bg-card-bg transition-all hover:border-rimec-azul hover:shadow-2xl cursor-pointer"
    >
      {/* Header NIIF */}
      <div className="border-b-2 border-rimec-azul/10 bg-gradient-to-br from-rimec-azul/5 to-transparent p-5">
        <div className="flex items-center gap-3">
          {/* Avatar con iniciales */}
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-rimec-azul text-xl font-bold text-white shadow-lg">
            {iniciales}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-bold text-neutral-ink">
              {vacacion.nombre_completo}
            </h3>
            <p className="text-xs font-mono text-neutral-600">CI: {vacacion.ci}</p>
          </div>
        </div>

        {/* Badge ente */}
        <div className="mt-3">
          <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${badgeColor}`}>
            {vacacion.ente_nombre}
          </span>
        </div>
      </div>

      {/* Contenido: Días de vacaciones */}
      <div className="p-5">
        {/* Cargo y departamento */}
        <div className="mb-4 space-y-1 text-sm text-neutral-600">
          <div>
            <span className="font-semibold text-rimec-azul">{vacacion.cargo}</span>
          </div>
          <div>{vacacion.departamento}</div>
        </div>

        {/* Días pendientes (DESTACADO) */}
        <div className="mb-4 rounded-xl border-2 border-rimec-azul bg-gradient-to-br from-rimec-azul/5 to-rimec-azul/10 p-4 text-center">
          <div className={`text-5xl font-extrabold ${getColorPendientes()}`}>
            {vacacion.dias_pendientes}
          </div>
          <div className="mt-1 text-sm font-bold uppercase tracking-wider text-rimec-azul">
            Días pendientes
          </div>
        </div>

        {/* Horas consumidas — siempre visible en gerentes */}
        {tieneHoras && (
          <div className="mb-3 rounded-lg border-2 border-bazzar-naranja/40 bg-bazzar-naranja/10 px-3 py-2 text-center">
            <span className="text-sm font-extrabold text-bazzar-naranja">
              🕐 {formatHoras(vacacion.horas_tomadas)} consumidas
            </span>
          </div>
        )}
        <div className="mb-3">
          <div className="mb-2 flex justify-between text-xs font-medium text-neutral-600">
            <span>
              Tomados: {vacacion.dias_tomados} días
              {tieneHoras && (
                <span className="ml-1 font-bold text-bazzar-naranja">
                  + {formatHoras(vacacion.horas_tomadas)}
                </span>
              )}
            </span>
            <span>{porcentajeTomado}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-neutral-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-rimec-azul to-rimec-azul-light transition-all"
              style={{ width: `${porcentajeTomado}%` }}
            />
          </div>
        </div>

        {/* Resumen numérico */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg bg-app-bg p-2">
            <div className="font-bold text-neutral-ink">{vacacion.dias_totales}</div>
            <div className="text-neutral-600">Asignados</div>
          </div>
          <div className="rounded-lg border border-bazzar-naranja/30 bg-bazzar-naranja/5 p-2">
            <VacacionTomadosDisplay
              diasTomados={vacacion.dias_tomados}
              horasTomadas={vacacion.horas_tomadas}
              tipoVacacion={vacacion.tipo_vacacion}
              horasTotales={vacacion.horas_totales}
              size="sm"
            />
            <div className="text-neutral-600">Tomados</div>
          </div>
          <div className="rounded-lg bg-app-bg p-2">
            <div className="font-bold text-success">{vacacion.dias_pendientes}</div>
            <div className="text-neutral-600">Pendientes</div>
          </div>
        </div>

        {/* Notas (si existen) */}
        {vacacion.notas && (
          <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700">
            <div className="mb-1 font-semibold text-neutral-ink">Nota:</div>
            {vacacion.notas}
          </div>
        )}
      </div>

      {/* Footer NIIF */}
      <div className="border-t-2 border-rimec-azul/10 bg-app-bg px-5 py-3 text-center text-xs font-medium text-neutral-600">
        Año {vacacion.anio}
      </div>

      {/* Indicador visual si no tiene pendientes */}
      {vacacion.dias_pendientes === 0 && (
        <div className="absolute right-0 top-0 rounded-bl-xl bg-neutral-500 px-3 py-1 text-xs font-bold text-white">
          ✓ Completo
        </div>
      )}

      {/* Indicador visual si tiene muchos pendientes */}
      {vacacion.dias_pendientes > 20 && (
        <div className="absolute right-0 top-0 rounded-bl-xl bg-success px-3 py-1 text-xs font-bold text-white">
          ⚠ {vacacion.dias_pendientes} días
        </div>
      )}
    </article>
  );
}
