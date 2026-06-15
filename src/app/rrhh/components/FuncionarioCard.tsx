import type { FuncionarioConEnte } from "../lib/types";
import {
  VacacionTomadosDisplay,
  debeMostrarHoras,
  formatHoras,
} from "../vacaciones/components/VacacionTomadosDisplay";

interface FuncionarioCardProps {
  funcionario: FuncionarioConEnte;
  onClick?: () => void;
}

export function FuncionarioCard({ funcionario, onClick }: FuncionarioCardProps) {
  const iniciales = funcionario.nombres
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const colorBadge =
    funcionario.ente.tipo === "empresa"
      ? "bg-rimec-azul text-white"
      : "bg-bazzar-naranja text-white";

  // Calcular días legales según antigüedad
  const diasLegales = calcularDiasLegales(funcionario.antiguedad_anios || 0);
  const vac = funcionario.vacaciones;
  const muestraHoras = vac ? debeMostrarHoras({
    tipo_vacacion: vac.tipo_vacacion,
    horas_tomadas: vac.horas_tomadas,
    horas_totales: vac.horas_totales,
  }) : false;

  return (
    <article
      onClick={onClick}
      className="group relative overflow-hidden rounded-lg border border-neutral-200 bg-card-bg transition-all hover:border-rimec-azul hover:shadow-lg cursor-pointer">
      {/* Header con iniciales */}
      <div className="flex items-center gap-3 border-b border-neutral-200 bg-app-bg p-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-rimec-azul text-lg font-bold text-white">
          {iniciales}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-neutral-ink">
            {funcionario.nombre_completo}
          </h3>
          <p className="text-xs text-neutral-600">CI: {funcionario.ci}</p>
        </div>
      </div>

      {/* Contenido */}
      <div className="space-y-3 p-4">
        {/* Ente */}
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-neutral-600">Ente</span>
          <span className={`rounded-full px-2 py-1 text-xs font-bold ${colorBadge}`}>
            {funcionario.ente.nombre}
          </span>
        </div>

        {/* Cargo */}
        <div>
          <div className="text-xs uppercase tracking-wider text-neutral-600">Cargo</div>
          <div className="mt-1 font-medium text-neutral-ink">{funcionario.cargo}</div>
        </div>

        {/* Departamento */}
        <div>
          <div className="text-xs uppercase tracking-wider text-neutral-600">Departamento</div>
          <div className="mt-1 text-sm text-neutral-700">{funcionario.departamento}</div>
        </div>

        {/* Antigüedad */}
        {funcionario.antiguedad_anios !== null && (
          <div className="flex items-baseline gap-2 rounded-lg bg-app-bg p-3">
            <div className="text-2xl font-bold text-rimec-azul">
              {funcionario.antiguedad_anios}
            </div>
            <div className="text-sm text-neutral-600">
              años
              {funcionario.antiguedad_meses !== null && funcionario.antiguedad_meses > 0 && (
                <>, {funcionario.antiguedad_meses} meses</>
              )}
            </div>
          </div>
        )}

        {/* Item (si existe) */}
        {funcionario.item && (
          <div className="text-xs text-neutral-600">
            Item: <span className="font-mono font-medium">{funcionario.item}</span>
          </div>
        )}

        {/* Vacaciones 2026 */}
        {funcionario.vacaciones && (
          <div className="mt-4 space-y-2 border-t border-neutral-200 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-600">
                🏖️ Vacaciones 2026
              </span>
              <span className="text-xs text-success">
                {diasLegales}d legal
              </span>
            </div>

            {/* Resumen numérico */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-rimec-azul/5 p-2">
                <div className="text-xl font-bold text-rimec-azul">
                  {funcionario.vacaciones.dias_totales}
                </div>
                <div className="text-xs text-neutral-600">Asignados</div>
              </div>
              <div className="rounded-lg bg-bazzar-naranja/5 p-2">
                {vac ? (
                  <VacacionTomadosDisplay
                    diasTomados={vac.dias_tomados}
                    horasTomadas={vac.horas_tomadas}
                    tipoVacacion={vac.tipo_vacacion}
                    horasTotales={vac.horas_totales}
                    size="sm"
                  />
                ) : (
                  <div className="text-xl font-bold text-bazzar-naranja">0</div>
                )}
                <div className="text-xs text-neutral-600">Consumidas</div>
              </div>
              <div className="rounded-lg bg-success/5 p-2">
                <div
                  className={`text-xl font-bold ${
                    funcionario.vacaciones.dias_pendientes === 0
                      ? "text-neutral-400"
                      : funcionario.vacaciones.dias_pendientes <= 10
                      ? "text-bazzar-naranja"
                      : "text-success"
                  }`}
                >
                  {funcionario.vacaciones.dias_pendientes}
                </div>
                <div className="text-xs text-neutral-600">Pendientes</div>
              </div>
            </div>
            {vac && muestraHoras && (
              <div className="rounded-lg border border-bazzar-naranja/40 bg-bazzar-naranja/10 px-2 py-1.5 text-center text-xs font-extrabold text-bazzar-naranja">
                🕐 {formatHoras(vac.horas_tomadas)} consumidas
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer con fecha ingreso */}
      <div className="border-t border-neutral-200 bg-app-bg px-4 py-2 text-xs text-neutral-600">
        Ingreso IPS:{" "}
        {new Date(funcionario.fecha_ingreso_ips).toLocaleDateString("es-AR", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}
      </div>
    </article>
  );
}

function calcularDiasLegales(antiguedadAnios: number): number {
  if (antiguedadAnios >= 10) return 30;
  if (antiguedadAnios >= 5) return 18;
  return 12;
}
