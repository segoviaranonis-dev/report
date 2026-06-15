"use client";

import { useState, useMemo } from "react";
import type { VacacionFuncionario } from "../lib/types";
import { debeMostrarHoras, formatHoras } from "./VacacionTomadosDisplay";

interface VacacionesTableProps {
  vacaciones: VacacionFuncionario[];
  onSelectFuncionario: (funcionario: VacacionFuncionario) => void;
}

type Departamento = {
  nombre: string;
  funcionarios: VacacionFuncionario[];
  expanded: boolean;
};

export function VacacionesTable({ vacaciones, onSelectFuncionario }: VacacionesTableProps) {
  // Estado para controlar qué departamentos están colapsados
  const [collapsedDeps, setCollapsedDeps] = useState<Set<string>>(new Set());

  // Agrupar por departamentos
  const departamentos = useMemo(() => {
    const deps = new Map<string, Departamento>();

    vacaciones.forEach((v) => {
      const depNombre = v.departamento || "Sin departamento";
      if (!deps.has(depNombre)) {
        deps.set(depNombre, {
          nombre: depNombre,
          funcionarios: [],
          expanded: !collapsedDeps.has(depNombre),
        });
      }
      deps.get(depNombre)!.funcionarios.push(v);
    });

    // Ordenar funcionarios alfabéticamente dentro de cada departamento
    deps.forEach((dep) => {
      dep.funcionarios.sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo));
    });

    return deps;
  }, [vacaciones, collapsedDeps]);

  const toggleDepartamento = (depNombre: string) => {
    setCollapsedDeps((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(depNombre)) {
        newSet.delete(depNombre);
      } else {
        newSet.add(depNombre);
      }
      return newSet;
    });
  };

  const totalDiasPendientes = vacaciones.reduce((sum, v) => sum + v.dias_pendientes, 0);
  const totalDiasTomados = vacaciones.reduce((sum, v) => sum + v.dias_tomados, 0);

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-rimec-azul bg-card-bg shadow-lg">
      {/* Header tabla */}
      <div className="border-b-2 border-rimec-azul bg-gradient-to-r from-rimec-azul to-rimec-azul-light px-6 py-4">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-2xl font-bold text-white">
            Por Departamento
          </h3>
          <div className="flex gap-4 text-white">
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider opacity-90">Total pendientes</div>
              <div className="text-2xl font-bold">{totalDiasPendientes}</div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider opacity-90">Total tomados</div>
              <div className="text-2xl font-bold">{totalDiasTomados}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="bg-app-bg">
            <tr className="border-b-2 border-neutral-200 text-left text-xs font-bold uppercase tracking-wider text-neutral-600">
              <th className="px-4 py-3">Funcionario</th>
              <th className="px-3 py-3 text-center">Antigüedad</th>
              <th className="px-3 py-3 text-center">Vacaciones</th>
              <th className="px-3 py-3 text-center">Pendientes</th>
              <th className="px-3 py-3 text-center">Progreso</th>
              <th className="px-3 py-3 text-center"></th>
            </tr>
          </thead>
          <tbody>
            {Array.from(departamentos.values()).map((dep) => (
              <DepartamentoGroup
                key={dep.nombre}
                departamento={dep}
                onToggle={() => toggleDepartamento(dep.nombre)}
                onSelectFuncionario={onSelectFuncionario}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DepartamentoGroup({
  departamento,
  onToggle,
  onSelectFuncionario,
}: {
  departamento: Departamento;
  onToggle: () => void;
  onSelectFuncionario: (f: VacacionFuncionario) => void;
}) {
  const totalPendientes = departamento.funcionarios.reduce((sum, f) => sum + f.dias_pendientes, 0);
  const totalTomados = departamento.funcionarios.reduce((sum, f) => sum + f.dias_tomados, 0);

  return (
    <>
      {/* Header departamento */}
      <tr
        onClick={onToggle}
        className="cursor-pointer border-t-2 border-rimec-azul bg-gradient-to-r from-rimec-azul/10 to-transparent transition-colors hover:from-rimec-azul/20"
      >
        <td colSpan={6} className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-rimec-azul">
                {departamento.expanded ? "▼" : "▶"}
              </span>
              <span className="font-serif text-xl font-bold text-rimec-azul-dark">
                {departamento.nombre}
              </span>
              <span className="rounded-full bg-rimec-azul px-3 py-1 text-xs font-bold text-white">
                {departamento.funcionarios.length} funcionarios
              </span>
            </div>
            <div className="flex gap-6 text-sm">
              <div className="text-right">
                <div className="font-bold text-rimec-azul">{totalPendientes}</div>
                <div className="text-xs text-neutral-600">Pendientes</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-neutral-ink">{totalTomados}</div>
                <div className="text-xs text-neutral-600">Tomados</div>
              </div>
            </div>
          </div>
        </td>
      </tr>

      {/* Funcionarios */}
      {departamento.expanded &&
        departamento.funcionarios.map((funcionario, idx) => (
          <FuncionarioRow
            key={funcionario.id_funcionario}
            funcionario={funcionario}
            isEven={idx % 2 === 0}
            onSelect={() => onSelectFuncionario(funcionario)}
          />
        ))}
    </>
  );
}

function FuncionarioRow({
  funcionario,
  isEven,
  onSelect,
}: {
  funcionario: VacacionFuncionario;
  isEven: boolean;
  onSelect: () => void;
}) {
  const diasLegales = calcularDiasLegales(funcionario.antiguedad_anios || 0);
  const porcentajeTomado = Math.round((funcionario.dias_tomados / funcionario.dias_totales) * 100);

  return (
    <tr
      className={`group border-b border-neutral-200 transition-colors hover:bg-rimec-azul/5 ${
        isEven ? "bg-white" : "bg-neutral-50"
      }`}
    >
      {/* Funcionario */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-rimec-azul text-xs font-bold text-white">
            {funcionario.nombres.split(" ")[0][0]}
            {funcionario.apellidos.split(" ")[0][0]}
          </div>
          <div>
            <div className="font-bold text-sm text-neutral-ink">{funcionario.nombre_completo}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-block rounded bg-rimec-azul/10 px-2 py-0.5 text-xs font-semibold text-rimec-azul">
                {funcionario.cargo}
              </span>
              <span className="text-xs text-neutral-500">CI: {funcionario.ci}</span>
            </div>
          </div>
        </div>
      </td>

      {/* Antigüedad */}
      <td className="px-3 py-3 text-center whitespace-nowrap">
        <div className="text-sm font-bold text-neutral-ink">
          {funcionario.antiguedad_anios || 0}a {funcionario.antiguedad_meses || 0}m
        </div>
        <div className="text-xs text-success">
          {diasLegales}d legal
        </div>
      </td>

      {/* Vacaciones */}
      <td className="px-3 py-3 text-center whitespace-nowrap">
        <div className="font-bold text-sm">
          <span className="text-bazzar-naranja">{funcionario.dias_tomados}</span>
          <span className="text-neutral-400"> / </span>
          <span className="text-rimec-azul">{funcionario.dias_totales}</span>
        </div>
        {debeMostrarHoras(funcionario) && (
          <div className="text-xs font-bold text-bazzar-naranja">
            🕐 {formatHoras(funcionario.horas_tomadas)}
          </div>
        )}
      </td>

      {/* Pendientes */}
      <td className="px-3 py-3 text-center">
        <div className={`text-2xl font-extrabold ${
          funcionario.dias_pendientes === 0 ? "text-neutral-400" :
          funcionario.dias_pendientes <= 10 ? "text-bazzar-naranja" :
          "text-success"
        }`}>
          {funcionario.dias_pendientes}
        </div>
      </td>

      {/* Progreso */}
      <td className="px-3 py-3">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-bold text-neutral-600">{porcentajeTomado}%</span>
          <div className="h-2 w-20 overflow-hidden rounded-full bg-neutral-200">
            <div
              className="h-full bg-gradient-to-r from-rimec-azul to-bazzar-naranja"
              style={{ width: `${porcentajeTomado}%` }}
            />
          </div>
        </div>
      </td>

      {/* Acción */}
      <td className="px-3 py-3 text-center">
        <button
          onClick={onSelect}
          className="rounded bg-rimec-azul px-3 py-1.5 text-xs font-bold text-white opacity-0 transition-all group-hover:opacity-100 hover:bg-rimec-azul-dark"
        >
          Ver
        </button>
      </td>
    </tr>
  );
}

function calcularDiasLegales(antiguedadAnios: number): number {
  if (antiguedadAnios >= 10) return 30;
  if (antiguedadAnios >= 5) return 18;
  return 12;
}
