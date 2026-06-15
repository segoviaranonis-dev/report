"use client";

import { useState } from "react";
import type { VacacionFuncionario } from "../lib/types";
import { DateRangePicker } from "./DateRangePicker";
import { HourPicker } from "./HourPicker";
import { HistorialVacacionesModal } from "./HistorialVacacionesModal";

interface FuncionarioModalProps {
  funcionario: VacacionFuncionario | null;
  onClose: () => void;
  onRefresh?: () => void;
}

export function FuncionarioModal({ funcionario, onClose, onRefresh }: FuncionarioModalProps) {
  const [historialAbierto, setHistorialAbierto] = useState(false);

  const handleSuccess = () => {
    if (onRefresh) onRefresh();
  };

  if (!funcionario) return null;

  // USAR DIRECTAMENTE funcionario.dias_tomados (NO estado local que no se actualiza)
  const diasTomados = funcionario.dias_tomados;

  // Calcular edad
  const edad = funcionario.fecha_nacimiento
    ? new Date().getFullYear() - new Date(funcionario.fecha_nacimiento).getFullYear()
    : null;

  // Días según legislación paraguaya
  const diasLegales = calcularDiasLegales(funcionario.antiguedad_anios || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border-4 border-rimec-azul bg-card-bg shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b-4 border-rimec-azul bg-gradient-to-br from-rimec-azul-dark to-rimec-azul p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-3xl font-bold text-rimec-azul shadow-lg">
                {funcionario.nombres.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()}
              </div>
              <div className="text-white">
                <h2 className="font-serif text-3xl font-bold">{funcionario.nombre_completo}</h2>
                <p className="mt-1 text-lg text-white/90">{funcionario.cargo}</p>
                <div className="mt-2 inline-block rounded-full bg-white/20 px-3 py-1 text-sm font-bold">
                  {funcionario.ente_nombre}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg bg-white/20 px-4 py-2 font-bold text-white transition-colors hover:bg-white/30"
            >
              × Cerrar
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Columna izquierda: Datos personales */}
            <section>
              <h3 className="mb-4 border-b-2 border-rimec-azul pb-2 font-serif text-2xl font-bold text-rimec-azul">
                Datos Personales
              </h3>
              <div className="space-y-3">
                <DataRow label="Cédula de Identidad" value={funcionario.ci} />
                <DataRow label="Sexo" value={funcionario.sexo === "M" ? "Masculino" : funcionario.sexo === "F" ? "Femenino" : "No especificado"} />
                {funcionario.fecha_nacimiento && (
                  <>
                    <DataRow
                      label="Fecha de Nacimiento"
                      value={new Date(funcionario.fecha_nacimiento).toLocaleDateString("es-PY")}
                    />
                    {edad && <DataRow label="Edad" value={`${edad} años`} />}
                  </>
                )}
                <DataRow label="Departamento" value={funcionario.departamento} />
                <DataRow label="Cargo" value={funcionario.cargo} />
                {funcionario.item && <DataRow label="Item" value={funcionario.item.toString()} />}
              </div>
            </section>

            {/* Columna derecha: Datos laborales */}
            <section>
              <h3 className="mb-4 border-b-2 border-rimec-azul pb-2 font-serif text-2xl font-bold text-rimec-azul">
                Datos Laborales
              </h3>
              <div className="space-y-3">
                {funcionario.fecha_ingreso_ips && (
                  <DataRow
                    label="Ingreso IPS"
                    value={new Date(funcionario.fecha_ingreso_ips).toLocaleDateString("es-PY")}
                  />
                )}
                <DataRow
                  label="Antigüedad"
                  value={`${funcionario.antiguedad_anios || 0} años ${funcionario.antiguedad_meses || 0} meses`}
                  highlight
                />
              </div>
            </section>
          </div>

          {/* Sección Vacaciones */}
          <section className="mt-8">
            <h3 className="mb-4 border-b-2 border-rimec-azul pb-2 font-serif text-2xl font-bold text-rimec-azul">
              Vacaciones {funcionario.anio}
            </h3>

            {/* Legislación paraguaya */}
            <div className="mb-6 rounded-xl border-2 border-success/30 bg-success/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-success">
                <span>⚖️</span>
                <span>Según Legislación Paraguaya</span>
              </div>
              <p className="text-sm text-neutral-700">
                Con <strong>{funcionario.antiguedad_anios || 0} años</strong> de antigüedad,
                corresponden <strong className="text-success">{diasLegales} días hábiles</strong> de vacaciones anuales.
              </p>
              <div className="mt-3 space-y-1 text-xs text-neutral-600">
                <div>• 1 a 5 años: 12 días hábiles</div>
                <div>• 5 a 10 años: 18 días hábiles</div>
                <div>• Más de 10 años: 30 días hábiles</div>
              </div>
            </div>

            {/* Resumen actual */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border-2 border-rimec-azul bg-gradient-to-br from-rimec-azul/5 to-rimec-azul/10 p-6 text-center">
                <div className="text-5xl font-extrabold text-rimec-azul">{funcionario.dias_totales}</div>
                <div className="mt-2 text-sm font-bold uppercase tracking-wider text-neutral-600">
                  Días totales asignados
                </div>
              </div>

              <div className="rounded-xl border-2 border-bazzar-naranja bg-gradient-to-br from-bazzar-naranja/5 to-bazzar-naranja/10 p-6 text-center">
                <div className="text-5xl font-extrabold text-bazzar-naranja">{diasTomados}</div>
                <div className="mt-2 text-sm font-bold uppercase tracking-wider text-neutral-600">
                  Días tomados
                </div>
              </div>

              <div className="rounded-xl border-2 border-success bg-gradient-to-br from-success/5 to-success/10 p-6 text-center">
                <div className="text-5xl font-extrabold text-success">
                  {funcionario.dias_totales - diasTomados}
                </div>
                <div className="mt-2 text-sm font-bold uppercase tracking-wider text-neutral-600">
                  Días pendientes
                </div>
              </div>
            </div>

            {/* Botón Ver Historial Detallado */}
            {diasTomados > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setHistorialAbierto(true)}
                  className="w-full rounded-xl border-2 border-rimec-azul bg-white px-6 py-3 font-bold text-rimec-azul transition-all hover:bg-rimec-azul hover:text-white"
                >
                  📋 VER DETALLE DE {diasTomados} DÍAS CONSUMIDOS
                </button>
              </div>
            )}

            {/* Sistema de Calendarios Avanzado */}
            <div className="mt-6 space-y-4">
              <h4 className="font-serif text-lg font-bold text-neutral-ink">
                Registrar Vacaciones
              </h4>

              <div className="grid gap-4 md:grid-cols-2">
                {/* Botón Calendario Días */}
                <DateRangePicker
                  funcionarioId={funcionario.id_funcionario}
                  anio={funcionario.anio}
                  diasDisponibles={funcionario.dias_totales - diasTomados}
                  onSelect={(range, dias) => {
                    console.log("Días seleccionados:", range, dias);
                  }}
                  onSuccess={handleSuccess}
                />

                {/* Botón Calendario Horas - TODOS los funcionarios */}
                <HourPicker
                  funcionarioId={funcionario.id_funcionario}
                  anio={funcionario.anio}
                  horasDisponibles={funcionario.horas_totales - (funcionario.horas_tomadas || 0)}
                  onSelect={(selection) => {
                    console.log("Horas seleccionadas:", selection);
                  }}
                  onSuccess={handleSuccess}
                />
              </div>

              {/* Info ayuda */}
              <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900">
                <p className="font-bold">💡 Cómo funciona:</p>
                <ul className="mt-2 space-y-1 pl-4">
                  <li>
                    <strong>📅 Días:</strong> Selecciona rango inicio→fin. Solo cuenta días hábiles (L-V).
                  </li>
                  <li>
                    <strong>🕐 Horas:</strong> Elige día + horas (0.5h a 8h). 8 horas = 1 día completo.
                  </li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Modal de Historial Detallado */}
      <HistorialVacacionesModal
        funcionarioId={funcionario.id_funcionario}
        anio={funcionario.anio}
        isOpen={historialAbierto}
        onClose={() => setHistorialAbierto(false)}
        onRefresh={handleSuccess}
      />
    </div>
  );
}

function DataRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex justify-between rounded-lg p-3 ${highlight ? "bg-rimec-azul/5 border-2 border-rimec-azul" : "bg-app-bg"}`}>
      <span className="font-semibold text-neutral-600">{label}:</span>
      <span className={`font-bold ${highlight ? "text-rimec-azul" : "text-neutral-ink"}`}>
        {value}
      </span>
    </div>
  );
}

function calcularDiasLegales(antiguedadAnios: number): number {
  if (antiguedadAnios >= 10) return 30;
  if (antiguedadAnios >= 5) return 18;
  return 12;
}
