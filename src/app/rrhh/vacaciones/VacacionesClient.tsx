"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { VacacionFuncionario, EstadisticasVacaciones, FiltrosVacaciones } from "./lib/types";
import type { Ente } from "../lib/types";
import { VacacionCard } from "./components/VacacionCard";
import { VacacionesTable } from "./components/VacacionesTable";
import { VacacionesTableJerarquica } from "./components/VacacionesTableJerarquica";
import { FuncionarioModalOptimizado } from "./components/FuncionarioModalOptimizado";
import { HistorialVacacionesModal } from "./components/HistorialVacacionesModal";

type VistaMode = "cards" | "table";

interface VacacionesClientProps {
  vacaciones: VacacionFuncionario[];
  estadisticas: EstadisticasVacaciones;
  entes: Ente[];
  anioActual: number;
}

export function VacacionesClient({
  vacaciones,
  estadisticas,
  entes,
  anioActual,
}: VacacionesClientProps) {
  const router = useRouter();
  const [vacacionesLocal, setVacacionesLocal] = useState(vacaciones);
  const [filtros, setFiltros] = useState<FiltrosVacaciones>({});
  const [vista, setVista] = useState<VistaMode>("cards");
  const [funcionarioSeleccionado, setFuncionarioSeleccionado] = useState<VacacionFuncionario | null>(null);
  const [historialAbierto, setHistorialAbierto] = useState<{ funcionarioId: number; anio: number } | null>(null);

  useEffect(() => {
    setVacacionesLocal(vacaciones);
  }, [vacaciones]);

  const patchFuncionario = (
    id: number,
    anio: number,
    datos: { horas_tomadas: number; dias_tomados: number; horas_pendientes: number; dias_pendientes: number }
  ) => (v: VacacionFuncionario) =>
    v.id_funcionario === id && v.anio === anio ? { ...v, ...datos } : v;

  const handleFuncionarioUpdated = (
    id: number,
    anio: number,
    datos: { horas_tomadas: number; dias_tomados: number; horas_pendientes: number; dias_pendientes: number }
  ) => {
    setVacacionesLocal((prev) => prev.map(patchFuncionario(id, anio, datos)));
    setFuncionarioSeleccionado((prev) => {
      if (!prev || prev.id_funcionario !== id || prev.anio !== anio) return prev;
      return { ...prev, ...datos };
    });
  };

  const handleRefresh = () => {
    router.refresh();
  };

  // Filtrar vacaciones
  const vacacionesFiltradas = useMemo(() => {
    let resultado = vacacionesLocal;

    if (filtros.buscar) {
      const buscarLower = filtros.buscar.toLowerCase();
      resultado = resultado.filter(
        (v) =>
          v.nombre_completo.toLowerCase().includes(buscarLower) ||
          v.ci.toLowerCase().includes(buscarLower)
      );
    }

    if (filtros.ente_id) {
      resultado = resultado.filter((v) => v.ente_id === filtros.ente_id);
    }

    if (filtros.solo_pendientes) {
      resultado = resultado.filter((v) => v.dias_pendientes > 0);
    }

    return resultado;
  }, [vacacionesLocal, filtros]);

  const handleBuscar = (valor: string) => {
    setFiltros((prev) => ({ ...prev, buscar: valor || undefined }));
  };

  const handleEnteChange = (enteId: number | undefined) => {
    setFiltros((prev) => ({ ...prev, ente_id: enteId }));
  };

  const handleSoloPendientes = (checked: boolean) => {
    setFiltros((prev) => ({ ...prev, solo_pendientes: checked }));
  };

  const limpiarFiltros = () => {
    setFiltros({});
  };

  const filtrosActivos = Object.values(filtros).filter(Boolean).length;

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      {/* Buscador Principal NIIF */}
      <div className="mb-12">
        <div className="rounded-2xl border-2 border-rimec-azul bg-card-bg p-8 shadow-lg">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rimec-azul text-2xl text-white">
              🔍
            </div>
            <div>
              <h2 className="text-2xl font-bold text-rimec-azul">Buscar Funcionario</h2>
              <p className="text-sm text-neutral-600">
                Ingresa nombre completo o número de cédula
              </p>
            </div>
          </div>

          <input
            type="text"
            placeholder="Ej: Juan Pérez  o  1234567"
            value={filtros.buscar ?? ""}
            onChange={(e) => handleBuscar(e.target.value)}
            className="w-full rounded-xl border-2 border-neutral-300 bg-white px-6 py-4 text-lg text-neutral-ink placeholder:text-neutral-400 transition-all focus:border-rimec-azul focus:outline-none focus:ring-4 focus:ring-rimec-azul/20"
          />

          {/* Filtros adicionales */}
          <div className="mt-6 flex flex-wrap items-center gap-4">
            {/* Filtro por ente */}
            <select
              value={filtros.ente_id ?? ""}
              onChange={(e) => {
                const value = e.target.value;
                handleEnteChange(value ? Number(value) : undefined);
              }}
              className="rounded-lg border-2 border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-ink transition-colors focus:border-rimec-azul focus:outline-none focus:ring-2 focus:ring-rimec-azul/20"
            >
              <option value="">Todos los entes</option>
              {entes.map((ente) => (
                <option key={ente.id_ente} value={ente.id_ente}>
                  {ente.nombre}
                </option>
              ))}
            </select>

            {/* Toggle solo pendientes */}
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border-2 border-neutral-300 bg-white px-4 py-2 transition-colors hover:border-rimec-azul">
              <input
                type="checkbox"
                checked={filtros.solo_pendientes ?? false}
                onChange={(e) => handleSoloPendientes(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-rimec-azul focus:ring-rimec-azul"
              />
              <span className="text-sm font-medium text-neutral-ink">Solo con pendientes</span>
            </label>

            {/* Limpiar filtros */}
            {filtrosActivos > 0 && (
              <button
                onClick={limpiarFiltros}
                className="ml-auto rounded-lg bg-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-300"
              >
                Limpiar ({filtrosActivos})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Contador de resultados + Toggle Vista */}
      <div className="mb-6 flex items-center justify-between">
        <div className="text-neutral-600">
          {vacacionesFiltradas.length === vacaciones.length ? (
            <>
              Mostrando <strong className="text-rimec-azul">{vacacionesFiltradas.length}</strong>{" "}
              funcionarios
            </>
          ) : (
            <>
              Mostrando <strong className="text-rimec-azul">{vacacionesFiltradas.length}</strong> de{" "}
              <strong>{vacaciones.length}</strong>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-neutral-600">Vista:</span>
          <div className="flex rounded-lg border-2 border-rimec-azul bg-white p-1">
            <button
              onClick={() => setVista("cards")}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-colors ${
                vista === "cards"
                  ? "bg-rimec-azul text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              <span>🃏</span>
              <span>Tarjetas</span>
            </button>
            <button
              onClick={() => setVista("table")}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-colors ${
                vista === "table"
                  ? "bg-rimec-azul text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              <span>📊</span>
              <span>Tabla Jerárquica</span>
            </button>
          </div>
        </div>
      </div>

      {/* Vistas */}
      {vacacionesFiltradas.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 py-20 text-center">
          <div className="text-6xl">🏖️</div>
          <p className="mt-4 text-xl font-medium text-neutral-700">
            No se encontraron funcionarios
          </p>
          <p className="mt-2 text-neutral-600">
            {filtros.buscar
              ? "Intenta con otro nombre o número de cédula"
              : "No hay registros de vacaciones para mostrar"}
          </p>
        </div>
      ) : vista === "cards" ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {vacacionesFiltradas.map((vacacion) => (
            <VacacionCard
              key={vacacion.id_vacacion}
              vacacion={vacacion}
              onClick={() => setFuncionarioSeleccionado(vacacion)}
            />
          ))}
        </div>
      ) : (
        <VacacionesTableJerarquica
          vacaciones={vacacionesFiltradas}
          onSelectFuncionario={(f) => setFuncionarioSeleccionado(f)}
        />
      )}

      {/* Modal de detalles OPTIMIZADO */}
      <FuncionarioModalOptimizado
        funcionario={funcionarioSeleccionado}
        onClose={() => setFuncionarioSeleccionado(null)}
        onFuncionarioUpdated={handleFuncionarioUpdated}
        onOpenHistorial={(fid, anio) => {
          setHistorialAbierto({ funcionarioId: fid, anio });
        }}
      />

      {/* Historial SEPARADO (no anidado) */}
      <HistorialVacacionesModal
        funcionarioId={historialAbierto?.funcionarioId || 0}
        anio={historialAbierto?.anio || 2026}
        isOpen={!!historialAbierto}
        onClose={() => setHistorialAbierto(null)}
        onVacacionUpdated={handleFuncionarioUpdated}
      />

      {/* Estadísticas footer */}
      <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border-2 border-rimec-azul/20 bg-card-bg p-6 text-center">
          <div className="text-4xl font-bold text-rimec-azul">
            {estadisticas.total_funcionarios}
          </div>
          <div className="mt-2 text-sm font-medium uppercase tracking-wider text-neutral-600">
            Total funcionarios
          </div>
        </div>

        <div className="rounded-xl border-2 border-rimec-azul/20 bg-card-bg p-6 text-center">
          <div className="text-4xl font-bold text-rimec-azul">
            {estadisticas.total_dias_pendientes}
          </div>
          <div className="mt-2 text-sm font-medium uppercase tracking-wider text-neutral-600">
            Días pendientes
          </div>
        </div>

        <div className="rounded-xl border-2 border-rimec-azul/20 bg-card-bg p-6 text-center">
          <div className="text-4xl font-bold text-rimec-azul">
            {estadisticas.promedio_dias_pendientes}
          </div>
          <div className="mt-2 text-sm font-medium uppercase tracking-wider text-neutral-600">
            Promedio pendientes
          </div>
        </div>

        <div className="rounded-xl border-2 border-rimec-azul/20 bg-card-bg p-6 text-center">
          <div className="text-4xl font-bold text-rimec-azul">
            {estadisticas.funcionarios_sin_tomar}
          </div>
          <div className="mt-2 text-sm font-medium uppercase tracking-wider text-neutral-600">
            Sin tomar vacaciones
          </div>
        </div>
      </div>
    </div>
  );
}
