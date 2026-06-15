"use client";

import { useState, useEffect } from "react";
import {
  numVacacion,
  formatHorasHistorial,
  formatPeriodoVacacion,
  formatDuracionVacacion,
} from "../lib/format-vacacion-display";

interface DetalleVacacion {
  id_detalle: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  dias_tomados: number;
  horas_tomadas: number;
  estado: string;
  created_at: string;
}

interface HistorialVacacionesModalProps {
  funcionarioId: number;
  anio: number;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
  onVacacionUpdated?: (
    id: number,
    anio: number,
    datos: {
      horas_tomadas: number;
      dias_tomados: number;
      horas_pendientes: number;
      dias_pendientes: number;
    }
  ) => void;
}

export function HistorialVacacionesModal({
  funcionarioId,
  anio,
  isOpen,
  onClose,
  onRefresh,
  onVacacionUpdated,
}: HistorialVacacionesModalProps) {
  const [historial, setHistorial] = useState<DetalleVacacion[]>([]);
  const [cargando, setCargando] = useState(false);
  const [eliminando, setEliminando] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && funcionarioId) {
      cargarHistorial();
    }
  }, [isOpen, funcionarioId, anio]);

  const cargarHistorial = async () => {
    setCargando(true);
    try {
      const response = await fetch(
        `/api/rrhh/vacaciones/historial?funcionario_id=${funcionarioId}&anio=${anio}`
      );
      const data = await response.json();
      setHistorial(data.historial || []);
    } catch (error) {
      console.error("Error al cargar historial:", error);
    } finally {
      setCargando(false);
    }
  };

  const eliminarRegistro = async (id_detalle: number) => {
    if (!confirm("¿Eliminar este registro? Esta acción no se puede deshacer.")) return;

    setEliminando(id_detalle);
    try {
      const response = await fetch(`/api/rrhh/vacaciones/eliminar-detalle`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_detalle }),
      });

      const data = await response.json();

      if (response.ok) {
        await cargarHistorial();
        if (data.vacacion && onVacacionUpdated) {
          onVacacionUpdated(funcionarioId, anio, {
            dias_tomados: numVacacion(data.vacacion.dias_tomados),
            horas_tomadas: numVacacion(data.vacacion.horas_tomadas),
            dias_pendientes: numVacacion(data.vacacion.dias_pendientes),
            horas_pendientes: numVacacion(data.vacacion.horas_pendientes),
          });
        }
        if (onRefresh) onRefresh();
      } else {
        alert(data.error || "❌ Error al eliminar");
      }
    } catch {
      alert("❌ Error de conexión");
    } finally {
      setEliminando(null);
    }
  };

  if (!isOpen) return null;

  const totalDias = historial.reduce((sum, h) => sum + numVacacion(h.dias_tomados), 0);
  const totalHoras = historial.reduce((sum, h) => sum + numVacacion(h.horas_tomadas), 0);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border-4 border-rimec-azul bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b-4 border-rimec-azul bg-gradient-to-br from-rimec-azul-dark to-rimec-azul p-6">
          <div className="flex items-center justify-between">
            <div className="text-white">
              <h2 className="font-serif text-2xl font-bold">📋 Historial Detallado</h2>
              <p className="mt-1 text-sm text-white/90">
                Registro de vacaciones tomadas — Año {anio}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-white/20 px-4 py-2 font-bold text-white hover:bg-white/30"
            >
              × Cerrar
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border-2 border-bazzar-naranja bg-bazzar-naranja/10 p-4 text-center">
              <div className="text-4xl font-extrabold text-bazzar-naranja">{totalDias}d</div>
              <div className="mt-1 text-sm font-bold text-neutral-600">Días consumidos</div>
            </div>
            <div className="rounded-xl border-2 border-rimec-azul bg-rimec-azul/10 p-4 text-center">
              <div className="text-4xl font-extrabold text-rimec-azul">
                {formatHorasHistorial(totalHoras)}
              </div>
              <div className="mt-1 text-sm font-bold text-neutral-600">Horas consumidas</div>
            </div>
          </div>

          {cargando ? (
            <div className="py-12 text-center text-neutral-600">Cargando historial...</div>
          ) : historial.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 py-12 text-center">
              <div className="text-5xl">📭</div>
              <p className="mt-4 font-medium text-neutral-700">Sin registros aún</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historial.map((registro) => {
                const dias = numVacacion(registro.dias_tomados);
                const horas = numVacacion(registro.horas_tomadas);
                return (
                  <div
                    key={registro.id_detalle}
                    className="overflow-hidden rounded-xl border-2 border-neutral-200 bg-card-bg transition-all hover:border-rimec-azul hover:shadow-lg"
                  >
                    <div className="flex items-center justify-between gap-3 p-4">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rimec-azul text-xl text-white">
                          {dias > 0 ? "📅" : "🕐"}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-neutral-ink">
                            {formatPeriodoVacacion(
                              registro.fecha_inicio,
                              registro.fecha_fin,
                              dias,
                              horas
                            )}
                          </div>
                          <div className="mt-1 text-sm font-semibold text-rimec-azul">
                            {formatDuracionVacacion(dias, horas)}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => eliminarRegistro(registro.id_detalle)}
                        disabled={eliminando === registro.id_detalle}
                        className="shrink-0 rounded-lg bg-red-500/10 px-4 py-2 font-bold text-red-600 transition-all hover:bg-red-500 hover:text-white disabled:opacity-50"
                      >
                        {eliminando === registro.id_detalle ? "..." : "🗑️ Eliminar"}
                      </button>
                    </div>

                    <div className="border-t border-neutral-200 bg-app-bg px-4 py-2 text-xs text-neutral-600">
                      Registrado:{" "}
                      {new Date(registro.created_at).toLocaleString("es-PY", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
