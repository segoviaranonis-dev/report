"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import type {
  Ente,
  FuncionarioConEnte,
  EstadisticasRRHH,
  FiltrosRRHH,
} from "./lib/types";
import type { VacacionFuncionario } from "./vacaciones/lib/types";
import { FuncionarioCard } from "./components/FuncionarioCard";
import { FiltrosPanel } from "./components/FiltrosPanel";
import { FuncionarioModalOptimizado } from "./vacaciones/components/FuncionarioModalOptimizado";
import { HistorialVacacionesModal } from "./vacaciones/components/HistorialVacacionesModal";

interface RRHHClientProps {
  funcionarios: FuncionarioConEnte[];
  entes: Ente[];
  estadisticas: EstadisticasRRHH;
  departamentos: string[];
  cargos: string[];
}

export function RRHHClient({
  funcionarios,
  entes,
  estadisticas,
  departamentos,
  cargos,
}: RRHHClientProps) {
  const router = useRouter();
  const [funcionariosLocal, setFuncionariosLocal] = useState(funcionarios);
  const [filtros, setFiltros] = useState<FiltrosRRHH>({});
  const [funcionarioSeleccionado, setFuncionarioSeleccionado] = useState<VacacionFuncionario | null>(null);
  const [historialAbierto, setHistorialAbierto] = useState<{ funcionarioId: number; anio: number } | null>(null);

  useEffect(() => {
    setFuncionariosLocal(funcionarios);
  }, [funcionarios]);

  const handleFuncionarioUpdated = (
    id: number,
    anio: number,
    datos: {
      horas_tomadas: number;
      dias_tomados: number;
      horas_pendientes: number;
      dias_pendientes: number;
    }
  ) => {
    setFuncionariosLocal((prev) =>
      prev.map((f) => {
        if (f.id_funcionario !== id || !f.vacaciones || f.vacaciones.anio !== anio) return f;
        return {
          ...f,
          vacaciones: { ...f.vacaciones, ...datos },
        };
      })
    );
    setFuncionarioSeleccionado((prev) => {
      if (!prev || prev.id_funcionario !== id || prev.anio !== anio) return prev;
      return { ...prev, ...datos };
    });
  };

  const handleRefresh = () => {
    router.refresh();
  };

  // Convertir FuncionarioConEnte a VacacionFuncionario para el modal
  const convertirAVacacion = (func: FuncionarioConEnte): VacacionFuncionario | null => {
    if (!func.vacaciones) return null;

    return {
      id_vacacion: func.vacaciones.id_vacacion,
      anio: func.vacaciones.anio,
      tipo_vacacion: func.vacaciones.tipo_vacacion,
      dias_totales: func.vacaciones.dias_totales,
      dias_tomados: func.vacaciones.dias_tomados,
      dias_pendientes: func.vacaciones.dias_pendientes,
      horas_totales: func.vacaciones.horas_totales,
      horas_tomadas: func.vacaciones.horas_tomadas,
      horas_pendientes: func.vacaciones.horas_pendientes,
      notas: func.vacaciones.notas,
      activo: func.vacaciones.activo,
      id_funcionario: func.id_funcionario,
      ente_id: func.ente_id,
      nombres: func.nombres,
      apellidos: func.apellidos,
      nombre_completo: func.nombre_completo,
      ci: func.ci,
      sexo: func.sexo,
      fecha_nacimiento: func.fecha_nacimiento,
      departamento: func.departamento,
      cargo: func.cargo,
      item: func.item,
      fecha_ingreso_ips: func.fecha_ingreso_ips,
      antiguedad_anios: func.antiguedad_anios,
      antiguedad_meses: func.antiguedad_meses,
      jerarquia_organizacional: func.jerarquia_organizacional,
      ente_nombre: func.ente.nombre,
      ente_codigo: func.ente.codigo,
    };
  };

  // Filtrar funcionarios en cliente
  const funcionariosFiltrados = useMemo(() => {
    let resultado = funcionariosLocal;

    if (filtros.ente_id) {
      resultado = resultado.filter((f) => f.ente_id === filtros.ente_id);
    }

    if (filtros.departamento) {
      resultado = resultado.filter((f) => f.departamento === filtros.departamento);
    }

    if (filtros.cargo) {
      resultado = resultado.filter((f) => f.cargo === filtros.cargo);
    }

    if (filtros.buscar) {
      const buscarLower = filtros.buscar.toLowerCase();
      resultado = resultado.filter(
        (f) =>
          f.nombre_completo.toLowerCase().includes(buscarLower) ||
          f.ci.toLowerCase().includes(buscarLower)
      );
    }

    return resultado;
  }, [funcionariosLocal, filtros]);

  const handleFiltroChange = (nuevosFiltros: Partial<FiltrosRRHH>) => {
    setFiltros((prev) => ({ ...prev, ...nuevosFiltros }));
  };

  const limpiarFiltros = () => {
    setFiltros({});
  };

  const filtrosActivos = Object.values(filtros).filter(Boolean).length;

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Panel de Filtros */}
      <FiltrosPanel
        filtros={filtros}
        onFiltroChange={handleFiltroChange}
        onLimpiar={limpiarFiltros}
        entes={entes}
        departamentos={departamentos}
        cargos={cargos}
        filtrosActivos={filtrosActivos}
      />

      {/* Contador de resultados */}
      <div className="mb-6 flex items-center justify-between border-b border-neutral-200 pb-4">
        <div className="text-sm text-neutral-600">
          {funcionariosFiltrados.length === funcionarios.length ? (
            <>
              Mostrando <strong>{funcionariosFiltrados.length}</strong> funcionarios
            </>
          ) : (
            <>
              Mostrando <strong>{funcionariosFiltrados.length}</strong> de{" "}
              <strong>{funcionarios.length}</strong> funcionarios
            </>
          )}
        </div>

        {filtrosActivos > 0 && (
          <button
            onClick={limpiarFiltros}
            className="text-sm font-medium text-rimec-azul hover:text-rimec-azul-dark"
          >
            Limpiar {filtrosActivos} filtro{filtrosActivos > 1 ? "s" : ""}
          </button>
        )}
      </div>

      {/* Lista de funcionarios */}
      {funcionariosFiltrados.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 py-16 text-center">
          <div className="text-5xl">🔍</div>
          <p className="mt-4 text-lg font-medium text-neutral-700">
            No se encontraron funcionarios
          </p>
          <p className="mt-2 text-sm text-neutral-600">
            Intenta ajustar los filtros o realizar una búsqueda diferente
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {funcionariosFiltrados.map((funcionario) => (
            <FuncionarioCard
              key={funcionario.id_funcionario}
              funcionario={funcionario}
              onClick={() => {
                const vacacion = convertirAVacacion(funcionario);
                if (vacacion) setFuncionarioSeleccionado(vacacion);
              }}
            />
          ))}
        </div>
      )}

      {/* Modal de vacaciones OPTIMIZADO */}
      <FuncionarioModalOptimizado
        funcionario={funcionarioSeleccionado}
        onClose={() => setFuncionarioSeleccionado(null)}
        onFuncionarioUpdated={handleFuncionarioUpdated}
        onOpenHistorial={(fid, anio) => {
          setHistorialAbierto({ funcionarioId: fid, anio });
        }}
      />

      {/* Historial SEPARADO */}
      <HistorialVacacionesModal
        funcionarioId={historialAbierto?.funcionarioId || 0}
        anio={historialAbierto?.anio || 2026}
        isOpen={!!historialAbierto}
        onClose={() => setHistorialAbierto(null)}
        onVacacionUpdated={handleFuncionarioUpdated}
      />

      {/* Estadísticas por ente principal (footer) */}
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {estadisticas.por_ente.map((stat) => (
          <div
            key={stat.ente_nombre}
            className="rounded-lg border border-neutral-200 bg-card-bg p-4 text-center"
          >
            <div className="text-2xl font-bold text-rimec-azul">{stat.count}</div>
            <div className="mt-1 text-sm text-neutral-600">{stat.ente_nombre}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
