"use client";

import { useState } from "react";

interface DateRange {
  inicio: Date | null;
  fin: Date | null;
}

interface DateRangePickerProps {
  onSelect: (range: DateRange, diasCalculados: number) => void;
  onSuccess?: (datosActualizados: { horas_tomadas: number; dias_tomados: number; horas_pendientes: number; dias_pendientes: number }) => void;
  diasDisponibles: number;
  funcionarioId: number;
  anio: number;
}

export function DateRangePicker({ onSelect, onSuccess, diasDisponibles, funcionarioId, anio }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [range, setRange] = useState<DateRange>({ inicio: null, fin: null });
  const [mesActual, setMesActual] = useState(new Date());
  const [guardando, setGuardando] = useState(false);

  // Calcular días hábiles entre dos fechas (excluyendo sábados y domingos)
  const calcularDiasHabiles = (inicio: Date, fin: Date): number => {
    let count = 0;
    const current = new Date(inicio);

    while (current <= fin) {
      const dia = current.getDay();
      // Contar solo días hábiles (lunes a viernes)
      if (dia !== 0 && dia !== 6) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    return count;
  };

  const handleDateClick = (fecha: Date) => {
    if (!range.inicio || (range.inicio && range.fin)) {
      // Primer click o reset
      setRange({ inicio: fecha, fin: null });
    } else {
      // Segundo click
      const fin = fecha < range.inicio ? range.inicio : fecha;
      const inicio = fecha < range.inicio ? fecha : range.inicio;
      const dias = calcularDiasHabiles(inicio, fin);

      if (dias > diasDisponibles) {
        alert(`No puede tomar más de ${diasDisponibles} días disponibles`);
        return;
      }

      setRange({ inicio, fin });
    }
  };

  const confirmarSeleccion = async () => {
    if (!range.inicio || !range.fin) return;

    const dias = calcularDiasHabiles(range.inicio, range.fin);

    setGuardando(true);
    try {
      const response = await fetch('/api/rrhh/vacaciones/registrar-dias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funcionario_id: funcionarioId,
          fecha_inicio: range.inicio.toISOString().split('T')[0],
          fecha_fin: range.fin.toISOString().split('T')[0],
          dias_tomados: dias,
          anio: anio,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al registrar');
      }

      console.log('[DateRangePicker] ✅ Registro exitoso:', data);

      // Extraer datos actualizados del response
      const datosActualizados = {
        horas_tomadas: data.vacacion?.horas_tomadas || 0,
        dias_tomados: data.vacacion?.dias_tomados || 0,
        horas_pendientes: data.vacacion?.horas_pendientes || 0,
        dias_pendientes: data.vacacion?.dias_pendientes || 0,
      };

      console.log('[DateRangePicker] 📊 Datos actualizados desde API:', datosActualizados);

      // Reset y cerrar primero
      resetYCerrar();

      // Callback para actualizar UI padre CON DATOS FRESCOS
      onSelect({ inicio: range.inicio, fin: range.fin }, dias);
      if (onSuccess) {
        console.log('[DateRangePicker] Llamando onSuccess con datos actualizados...');
        onSuccess(datosActualizados);
      }

      // Notificar al usuario
      alert(data.mensaje || `✅ ${dias} días registrados exitosamente`);
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setGuardando(false);
    }
  };

  const renderCalendario = () => {
    const primerDia = new Date(mesActual.getFullYear(), mesActual.getMonth(), 1);
    const ultimoDia = new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, 0);
    const diasMes: Date[] = [];

    // Rellenar días vacíos al inicio
    const primerDiaSemana = primerDia.getDay();
    const diasVaciosInicio = primerDiaSemana === 0 ? 6 : primerDiaSemana - 1;

    for (let i = 0; i < diasVaciosInicio; i++) {
      diasMes.push(new Date(0));
    }

    // Días del mes
    for (let d = 1; d <= ultimoDia.getDate(); d++) {
      diasMes.push(new Date(mesActual.getFullYear(), mesActual.getMonth(), d));
    }

    return diasMes;
  };

  const cambiarMes = (delta: number) => {
    const nuevo = new Date(mesActual);
    nuevo.setMonth(nuevo.getMonth() + delta);
    setMesActual(nuevo);
  };

  const dias = renderCalendario();

  const esSeleccionado = (fecha: Date) => {
    if (!range.inicio) return false;
    if (!range.fin) return fecha.getTime() === range.inicio.getTime();
    return fecha >= range.inicio && fecha <= range.fin;
  };

  const esInicio = (fecha: Date) => range.inicio && fecha.getTime() === range.inicio.getTime();
  const esFin = (fecha: Date) => range.fin && fecha.getTime() === range.fin.getTime();

  const resetYCerrar = () => {
    setIsOpen(false);
    setRange({ inicio: null, fin: null });
  };

  return (
    <>
      {/* Botón compacto */}
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-rimec-azul bg-white px-4 py-3 font-bold text-rimec-azul transition-all hover:bg-rimec-azul hover:text-white"
      >
        <span className="text-lg">📅</span>
        <span className="text-sm">TOMAR DÍAS</span>
      </button>

      {/* MINI-MODAL FLOTANTE CENTRADO */}
      {isOpen && (
        <>
          {/* Backdrop oscuro */}
          <div
            className="fixed inset-0 z-[999] bg-black/50"
            onClick={resetYCerrar}
          />

          {/* Burbuja centrada - ESTRUCTURA FLEX 3 CAPAS */}
          <div className="fixed left-1/2 top-1/2 z-[1000] flex h-[90vh] max-h-[550px] w-[340px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border-2 border-rimec-azul bg-white shadow-2xl">

            {/* 1. HEADER FIJO */}
            <div className="flex shrink-0 items-center justify-between bg-rimec-azul px-4 py-3">
              <div className="text-sm font-bold text-white">
                📅 Selecciona rango
              </div>
              <button
                onClick={resetYCerrar}
                className="rounded bg-white/20 px-2 py-1 text-xs font-bold text-white hover:bg-white/30"
              >
                ✕
              </button>
            </div>

            {/* 2. CONTENIDO SCROLLABLE */}
            <div className="flex-1 overflow-y-auto">
              {/* Navegador de mes */}
              <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-3 py-2 sticky top-0 z-10">
                <button
                  onClick={() => cambiarMes(-1)}
                  className="rounded px-2 py-1 text-sm font-bold hover:bg-neutral-100"
                >
                  ←
                </button>
                <div className="text-sm font-bold text-neutral-700">
                  {mesActual.toLocaleDateString("es-PY", { month: "short", year: "numeric" })}
                </div>
                <button
                  onClick={() => cambiarMes(1)}
                  className="rounded px-2 py-1 text-sm font-bold hover:bg-neutral-100"
                >
                  →
                </button>
              </div>

              {/* Días de la semana */}
              <div className="grid grid-cols-7 gap-1 border-b border-neutral-200 px-2 py-1 text-center text-xs font-bold text-neutral-500 bg-white sticky top-[41px] z-10">
                <div>L</div>
                <div>M</div>
                <div>M</div>
                <div>J</div>
                <div>V</div>
                <div>S</div>
                <div>D</div>
              </div>

              {/* Grid calendario */}
              <div className="grid grid-cols-7 gap-1 p-2">
                {dias.map((fecha, idx) => {
                  if (fecha.getTime() === 0) {
                    return <div key={idx} />;
                  }

                  const esFDS = fecha.getDay() === 0 || fecha.getDay() === 6;
                  const seleccionado = esSeleccionado(fecha);
                  const inicio = esInicio(fecha);
                  const fin = esFin(fecha);

                  return (
                    <button
                      key={idx}
                      onClick={() => !esFDS && handleDateClick(fecha)}
                      disabled={esFDS}
                      className={`
                        aspect-square rounded text-xs font-bold transition-all
                        ${esFDS ? "cursor-not-allowed bg-neutral-50 text-neutral-300" : "hover:bg-rimec-azul/20"}
                        ${seleccionado ? "bg-rimec-azul text-white" : "bg-white text-neutral-700"}
                        ${inicio || fin ? "ring-2 ring-success" : ""}
                      `}
                    >
                      {fecha.getDate()}
                    </button>
                  );
                })}
              </div>

              {/* Info de selección */}
              {range.inicio && !range.fin && (
                <div className="border-t border-neutral-200 bg-rimec-azul/5 px-3 py-2 text-center text-xs font-bold text-rimec-azul">
                  ✓ {range.inicio.toLocaleDateString("es-PY", { day: "numeric", month: "short" })} → Selecciona día final
                </div>
              )}

              {/* Padding inferior para que el último contenido no quede pegado al footer */}
              <div className="h-4"></div>
            </div>

            {/* 3. FOOTER FIJO CON BOTÓN O CANCELAR */}
            {range.inicio && range.fin ? (
              <div className="shrink-0 border-t-4 border-success bg-gradient-to-br from-success/10 to-success/5 p-4">
                <div className="mb-3 text-center">
                  <div className="text-2xl font-extrabold text-success">
                    {calcularDiasHabiles(range.inicio, range.fin)} días
                  </div>
                  <div className="text-xs font-bold text-neutral-700">
                    📅 {range.inicio.toLocaleDateString("es-PY", { day: "numeric", month: "short" })} → {range.fin.toLocaleDateString("es-PY", { day: "numeric", month: "short" })}
                  </div>
                  <div className="text-xs text-neutral-500">
                    (solo días hábiles L-V)
                  </div>
                </div>
                <button
                  onClick={confirmarSeleccion}
                  disabled={guardando}
                  className="w-full rounded-xl bg-[#22c55e] px-6 py-4 text-base font-extrabold text-white shadow-xl hover:bg-[#16a34a] hover:shadow-2xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                  style={{ backgroundColor: guardando ? '#9ca3af' : '#22c55e', color: '#ffffff' }}
                >
                  {guardando ? '💾 GUARDANDO...' : '✅ PROCESAR VACACIONES'}
                </button>
              </div>
            ) : (
              <div className="shrink-0 border-t border-neutral-200 bg-white p-3">
                <button
                  onClick={resetYCerrar}
                  className="w-full rounded-lg bg-neutral-200 px-4 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-300"
                >
                  Cancelar
                </button>
              </div>
            )}

          </div>
        </>
      )}
    </>
  );
}
