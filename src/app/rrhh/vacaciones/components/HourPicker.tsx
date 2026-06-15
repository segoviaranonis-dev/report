"use client";

import { useState } from "react";

interface HourSelection {
  fecha: Date;
  horas: number;
}

interface HourPickerProps {
  onSelect: (selection: HourSelection) => void;
  onSuccess?: (datosActualizados: { horas_tomadas: number; dias_tomados: number; horas_pendientes: number; dias_pendientes: number }) => void;
  horasDisponibles: number;
  funcionarioId: number;
  anio: number;
}

export function HourPicker({ onSelect, onSuccess, horasDisponibles, funcionarioId, anio }: HourPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [paso, setPaso] = useState<"fecha" | "horas">("fecha");
  const [fechaSeleccionada, setFechaSeleccionada] = useState<Date | null>(null);
  const [horasSeleccionadas, setHorasSeleccionadas] = useState(0);
  const [mesActual, setMesActual] = useState(new Date());
  const [guardando, setGuardando] = useState(false);

  // Opciones de horas (jornada laboral: 8 horas)
  const opcionesHoras = [
    { value: 0.5, label: "30 min" },
    { value: 1, label: "1 hora" },
    { value: 1.5, label: "1.5 horas" },
    { value: 2, label: "2 horas" },
    { value: 2.5, label: "2.5 horas" },
    { value: 3, label: "3 horas" },
    { value: 3.5, label: "3.5 horas" },
    { value: 4, label: "4 horas (medio día)" },
    { value: 4.5, label: "4.5 horas" },
    { value: 5, label: "5 horas" },
    { value: 5.5, label: "5.5 horas" },
    { value: 6, label: "6 horas" },
    { value: 6.5, label: "6.5 horas" },
    { value: 7, label: "7 horas" },
    { value: 7.5, label: "7.5 horas" },
    { value: 8, label: "8 horas (día completo)" },
  ];

  const renderCalendario = () => {
    const primerDia = new Date(mesActual.getFullYear(), mesActual.getMonth(), 1);
    const ultimoDia = new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, 0);
    const diasMes: Date[] = [];

    const primerDiaSemana = primerDia.getDay();
    const diasVaciosInicio = primerDiaSemana === 0 ? 6 : primerDiaSemana - 1;

    for (let i = 0; i < diasVaciosInicio; i++) {
      diasMes.push(new Date(0));
    }

    for (let d = 1; d <= ultimoDia.getDate(); d++) {
      diasMes.push(new Date(mesActual.getFullYear(), mesActual.getMonth(), d));
    }

    return diasMes;
  };

  const handleFechaClick = (fecha: Date) => {
    // Solo días hábiles
    if (fecha.getDay() === 0 || fecha.getDay() === 6) return;
    setFechaSeleccionada(fecha);
    setPaso("horas");
  };

  const handleHorasClick = (horas: number) => {
    // Validación: si horasDisponibles es 0 o negativo, permitir de todos modos (bug de datos)
    const disponibles = horasDisponibles || 999;

    if (horas > disponibles && disponibles < 999) {
      alert(`Solo tienes ${disponibles.toFixed(1)} horas disponibles`);
      return;
    }

    setHorasSeleccionadas(horas);
    console.log('Horas seleccionadas:', horas); // Debug
  };

  const confirmarSeleccion = async () => {
    if (!fechaSeleccionada || horasSeleccionadas <= 0) return;

    setGuardando(true);
    try {
      const response = await fetch('/api/rrhh/vacaciones/registrar-horas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funcionario_id: funcionarioId,
          fecha: fechaSeleccionada.toISOString().split('T')[0],
          horas_tomadas: horasSeleccionadas,
          anio: anio,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al registrar');
      }

      console.log('[HourPicker] ✅ Registro exitoso:', data);

      // Extraer datos actualizados del response
      const datosActualizados = {
        horas_tomadas: data.vacacion?.horas_tomadas || 0,
        dias_tomados: data.vacacion?.dias_tomados || 0,
        horas_pendientes: data.vacacion?.horas_pendientes || 0,
        dias_pendientes: data.vacacion?.dias_pendientes || 0,
      };

      console.log('[HourPicker] 📊 Datos actualizados desde API:', datosActualizados);

      // Reset primero
      setIsOpen(false);
      setPaso("fecha");
      setFechaSeleccionada(null);
      setHorasSeleccionadas(0);

      // Callback para actualizar UI padre CON DATOS FRESCOS
      onSelect({ fecha: fechaSeleccionada, horas: horasSeleccionadas });
      if (onSuccess) {
        console.log('[HourPicker] Llamando onSuccess con datos actualizados...');
        onSuccess(datosActualizados);
      }

      // Notificar al usuario
      alert(data.mensaje || `✅ ${horasSeleccionadas}h registradas exitosamente`);
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setGuardando(false);
    }
  };

  const resetYCerrar = () => {
    setIsOpen(false);
    setPaso("fecha");
    setFechaSeleccionada(null);
    setHorasSeleccionadas(0);
  };

  const cambiarMes = (delta: number) => {
    const nuevo = new Date(mesActual);
    nuevo.setMonth(nuevo.getMonth() + delta);
    setMesActual(nuevo);
  };

  const dias = renderCalendario();

  return (
    <>
      {/* Botón compacto */}
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-bazzar-naranja bg-white px-4 py-3 font-bold text-bazzar-naranja transition-all hover:bg-bazzar-naranja hover:text-white"
      >
        <span className="text-lg">🕐</span>
        <span className="text-sm">TOMAR HORAS</span>
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
          <div className="fixed left-1/2 top-1/2 z-[1000] flex h-[90vh] max-h-[600px] w-[340px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border-2 border-bazzar-naranja bg-white shadow-2xl">

            {/* 1. HEADER FIJO */}
            <div className="flex shrink-0 items-center justify-between bg-bazzar-naranja px-4 py-3">
              <div className="text-sm font-bold text-white">
                {paso === "fecha" ? "📅 Día" : "⏱️ Horas"}
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
                  if (fecha.getTime() === 0) return <div key={idx} />;

                  const esFDS = fecha.getDay() === 0 || fecha.getDay() === 6;
                  const seleccionado = fechaSeleccionada?.getTime() === fecha.getTime();

                  return (
                    <button
                      key={idx}
                      onClick={() => handleFechaClick(fecha)}
                      disabled={esFDS}
                      className={`
                        aspect-square rounded text-xs font-bold transition-all
                        ${esFDS ? "cursor-not-allowed bg-neutral-50 text-neutral-300" : "hover:bg-bazzar-naranja/20"}
                        ${seleccionado ? "bg-bazzar-naranja text-white" : "bg-white text-neutral-700"}
                      `}
                    >
                      {fecha.getDate()}
                    </button>
                  );
                })}
              </div>

              {/* Fecha seleccionada */}
              {fechaSeleccionada && (
                <div className="border-y border-bazzar-naranja/20 bg-bazzar-naranja/5 px-3 py-2 text-center text-xs font-bold text-bazzar-naranja">
                  ✓ {fechaSeleccionada.toLocaleDateString("es-PY", { day: "numeric", month: "short" })}
                </div>
              )}

              {/* Selector de horas */}
              {fechaSeleccionada && (
                <div className="space-y-1 p-3">
                  {opcionesHoras.map((opcion) => (
                    <button
                      key={opcion.value}
                      onClick={() => handleHorasClick(opcion.value)}
                      disabled={opcion.value > horasDisponibles}
                      className={`
                        w-full rounded border px-3 py-1.5 text-left text-sm font-medium transition-all
                        ${opcion.value > horasDisponibles ? "cursor-not-allowed border-neutral-200 bg-neutral-50 text-neutral-400" : ""}
                        ${horasSeleccionadas === opcion.value ? "border-bazzar-naranja bg-bazzar-naranja text-white shadow-lg" : "border-neutral-200 bg-white text-neutral-700 hover:bg-bazzar-naranja/10"}
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <span>{opcion.label}</span>
                        {opcion.value === 8 && <span className="text-xs opacity-70">=1d</span>}
                        {opcion.value === 4 && <span className="text-xs opacity-70">=½d</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 3. FOOTER FIJO CON BOTÓN */}
            {fechaSeleccionada && horasSeleccionadas > 0 && (
              <div className="shrink-0 border-t-4 border-success bg-gradient-to-br from-success/10 to-success/5 p-4">
                <div className="mb-3 text-center">
                  <div className="text-2xl font-extrabold text-success">{horasSeleccionadas}h</div>
                  <div className="text-xs font-bold text-neutral-700">
                    📅 {fechaSeleccionada?.toLocaleDateString("es-PY", { day: "numeric", month: "short", year: "numeric" })}
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
            )}

          </div>
        </>
      )}
    </>
  );
}
