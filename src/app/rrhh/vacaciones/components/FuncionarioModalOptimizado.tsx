"use client";

import { useState, useEffect, lazy, Suspense } from "react";
import type { VacacionFuncionario } from "../lib/types";
import { VacacionTomadosDisplay, formatHoras } from "./VacacionTomadosDisplay";

// LAZY LOAD de componentes pesados
const DateRangePicker = lazy(() => import("./DateRangePicker").then(m => ({ default: m.DateRangePicker })));
const HourPicker = lazy(() => import("./HourPicker").then(m => ({ default: m.HourPicker })));

interface FuncionarioModalProps {
  funcionario: VacacionFuncionario | null;
  onClose: () => void;
  onRefresh?: () => void;
  onFuncionarioUpdated?: (
    id: number,
    anio: number,
    datos: { horas_tomadas: number; dias_tomados: number; horas_pendientes: number; dias_pendientes: number }
  ) => void;
  onOpenHistorial?: (funcionarioId: number, anio: number) => void;
}

export function FuncionarioModalOptimizado({
  funcionario,
  onClose,
  onFuncionarioUpdated,
  onOpenHistorial,
}: FuncionarioModalProps) {
  const [funcionarioLocal, setFuncionarioLocal] = useState(funcionario);
  const funcionarioKey = funcionario
    ? `${funcionario.id_funcionario}-${funcionario.anio}`
    : null;

  // Solo sincronizar al abrir otro funcionario — NO en cada re-render del padre
  useEffect(() => {
    if (funcionario) {
      setFuncionarioLocal(funcionario);
    }
  }, [funcionarioKey]);

  useEffect(() => {
    if (!funcionarioLocal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [funcionarioLocal, onClose]);

  const handleSuccess = (datosActualizados: {
    horas_tomadas: number;
    dias_tomados: number;
    horas_pendientes: number;
    dias_pendientes: number;
  }) => {
    setFuncionarioLocal((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        horas_tomadas: datosActualizados.horas_tomadas,
        dias_tomados: datosActualizados.dias_tomados,
        horas_pendientes: datosActualizados.horas_pendientes,
        dias_pendientes: datosActualizados.dias_pendientes,
      };
    });

    if (funcionario && onFuncionarioUpdated) {
      onFuncionarioUpdated(
        funcionario.id_funcionario,
        funcionario.anio,
        datosActualizados
      );
    }
  };

  if (!funcionarioLocal) return null;

  const diasTomados = funcionarioLocal.dias_tomados;
  const diasLegales = calcularDiasLegales(funcionarioLocal.antiguedad_anios || 0);

  return (
    <>
      <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true">
        {/* Backdrop — clic cierra */}
        <div
          className="absolute inset-0 bg-black/50"
          onClick={onClose}
          aria-hidden="true"
        />
        {/* Panel modal */}
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center p-4">
        <div
          className="pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border-2 border-rimec-azul bg-white shadow-2xl"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Header compacto */}
          <div className="border-b-2 border-rimec-azul bg-gradient-to-br from-rimec-azul-dark to-rimec-azul px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="text-white">
                <h2 className="font-serif text-lg font-bold">{funcionarioLocal.nombre_completo}</h2>
                <p className="text-xs text-white/90">{funcionarioLocal.cargo}</p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="relative z-20 rounded bg-white/20 px-2 py-1 text-xs font-bold text-white hover:bg-white/30"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Contenido */}
          <div className="p-4">
            {/* Días según ley */}
            <div className="mb-3 rounded-lg bg-success/10 px-3 py-2 text-center text-xs">
              <strong className="text-success">{diasLegales} días hábiles</strong> · {funcionarioLocal.antiguedad_anios || 0} años
            </div>

            {/* Resumen numérico COMPACTO */}
            <div className="mb-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-rimec-azul bg-rimec-azul/5 p-2">
                <div className="text-2xl font-extrabold text-rimec-azul">{funcionarioLocal.dias_totales}</div>
                <div className="text-xs font-bold text-neutral-600">Asignados</div>
              </div>

              <div className="rounded-lg border border-bazzar-naranja bg-bazzar-naranja/5 p-2">
                <VacacionTomadosDisplay
                  diasTomados={diasTomados}
                  horasTomadas={funcionarioLocal.horas_tomadas}
                  tipoVacacion={funcionarioLocal.tipo_vacacion}
                  horasTotales={funcionarioLocal.horas_totales}
                  size="lg"
                />
                <div className="text-xs font-bold text-neutral-600">Tomados</div>
              </div>

              <div className="rounded-lg border border-success bg-success/5 p-2">
                <div className="text-2xl font-extrabold text-success">{funcionarioLocal.dias_totales - diasTomados}</div>
                <div className="text-xs font-bold text-neutral-600">Pendientes</div>
              </div>
            </div>

            {/* Botón Ver Historial */}
            {(diasTomados > 0 || funcionarioLocal.horas_tomadas > 0) && onOpenHistorial && (
              <button
                onClick={() => onOpenHistorial(funcionarioLocal.id_funcionario, funcionarioLocal.anio)}
                className="mb-3 w-full rounded-lg border border-rimec-azul bg-white px-3 py-2 text-sm font-bold text-rimec-azul hover:bg-rimec-azul hover:text-white"
              >
                📋 VER DETALLE ({formatDetalleTomados(diasTomados, funcionarioLocal.horas_tomadas)})
              </button>
            )}

            {/* Separador */}
            <div className="mb-3 border-t border-neutral-200"></div>

            {/* Botones de acción - SIEMPRE VISIBLES */}
            <Suspense fallback={<div className="py-4 text-center text-xs text-neutral-600">Cargando...</div>}>
              <div className="grid gap-2 md:grid-cols-2">
                <DateRangePicker
                  funcionarioId={funcionarioLocal.id_funcionario}
                  anio={funcionarioLocal.anio}
                  diasDisponibles={funcionarioLocal.dias_totales - diasTomados}
                  onSelect={() => {}}
                  onSuccess={handleSuccess}
                />
                <HourPicker
                  funcionarioId={funcionarioLocal.id_funcionario}
                  anio={funcionarioLocal.anio}
                  horasDisponibles={funcionarioLocal.horas_totales - funcionarioLocal.horas_tomadas}
                  onSelect={() => {}}
                  onSuccess={handleSuccess}
                />
              </div>
            </Suspense>
          </div>
        </div>
        </div>
      </div>
    </>
  );
}

function calcularDiasLegales(antiguedadAnios: number): number {
  if (antiguedadAnios >= 10) return 30;
  if (antiguedadAnios >= 5) return 18;
  return 12;
}

function formatDetalleTomados(dias: number, horas: number): string {
  const partes: string[] = [];
  if (dias > 0) partes.push(`${dias} días`);
  if (horas > 0) partes.push(formatHoras(horas));
  if (partes.length === 0) partes.push(formatHoras(horas));
  return partes.join(" · ");
}
