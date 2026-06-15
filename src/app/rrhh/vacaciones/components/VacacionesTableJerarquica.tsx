"use client";

import { useState, useMemo } from "react";
import type { VacacionFuncionario } from "../lib/types";
import { debeMostrarHoras, formatHoras } from "./VacacionTomadosDisplay";

interface Props {
  vacaciones: VacacionFuncionario[];
  onSelectFuncionario: (funcionario: VacacionFuncionario) => void;
}

type NodoJerarquico = {
  funcionario: VacacionFuncionario;
  hijos: NodoJerarquico[];
  nivel: string; // "1", "1.1", "1.1.1", etc.
};

export function VacacionesTableJerarquica({ vacaciones, onSelectFuncionario }: Props) {
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  // Agrupar por departamento
  const porDepartamento = useMemo(() => {
    const deps = new Map<string, VacacionFuncionario[]>();
    vacaciones.forEach((v) => {
      const dep = v.departamento || "Sin departamento";
      if (!deps.has(dep)) deps.set(dep, []);
      deps.get(dep)!.push(v);
    });
    return deps;
  }, [vacaciones]);

  // Construir árbol jerárquico para cada departamento
  const arbolesJerarquicos = useMemo(() => {
    const arboles = new Map<string, NodoJerarquico[]>();

    porDepartamento.forEach((funcionarios, depNombre) => {
      arboles.set(depNombre, construirArbol(funcionarios));
    });

    return arboles;
  }, [porDepartamento]);

  const toggleNode = (nodeId: string) => {
    setCollapsedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const totalPendientes = vacaciones.reduce((sum, v) => sum + v.dias_pendientes, 0);
  const totalTomados = vacaciones.reduce((sum, v) => sum + v.dias_tomados, 0);

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-rimec-azul bg-card-bg shadow-lg">
      {/* Header */}
      <div className="border-b-2 border-rimec-azul bg-gradient-to-r from-rimec-azul to-rimec-azul-light px-6 py-4">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-2xl font-bold text-white">
            Por Departamento (Jerarquía Organizacional)
          </h3>
          <div className="flex gap-4 text-white">
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider opacity-90">Total pendientes</div>
              <div className="text-2xl font-bold">{totalPendientes}</div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider opacity-90">Total tomados</div>
              <div className="text-2xl font-bold">{totalTomados}</div>
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
            {Array.from(arbolesJerarquicos.entries()).map(([depNombre, nodos]) => (
              <DepartamentoJerarquico
                key={depNombre}
                nombre={depNombre}
                nodos={nodos}
                collapsedNodes={collapsedNodes}
                onToggle={toggleNode}
                onSelectFuncionario={onSelectFuncionario}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Construir árbol jerárquico a partir de una lista plana
function construirArbol(funcionarios: VacacionFuncionario[]): NodoJerarquico[] {
  const nodos: NodoJerarquico[] = [];
  const mapaPorId = new Map<number, NodoJerarquico>();
  const mapaPorNivel = new Map<string, NodoJerarquico>();

  // Crear todos los nodos
  funcionarios.forEach((f) => {
    const nivel = f.jerarquia_organizacional || `sin-jerarquia-${f.id_funcionario}`;
    const nodo: NodoJerarquico = {
      funcionario: f,
      hijos: [],
      nivel,
    };
    mapaPorId.set(f.id_funcionario, nodo);
    // Solo agregar al mapa por nivel si tiene jerarquía definida
    if (f.jerarquia_organizacional) {
      mapaPorNivel.set(nivel, nodo);
    }
  });

  // Organizar en árbol
  funcionarios.forEach((f) => {
    const nodo = mapaPorId.get(f.id_funcionario)!;

    // Si tiene jerarquía organizacional, buscar su padre
    if (f.jerarquia_organizacional) {
      const nivelPadre = obtenerNivelPadre(f.jerarquia_organizacional);

      if (nivelPadre && mapaPorNivel.has(nivelPadre)) {
        mapaPorNivel.get(nivelPadre)!.hijos.push(nodo);
      } else {
        nodos.push(nodo); // Raíz (jefe sin padre)
      }
    } else {
      // Sin jerarquía, va directo a la raíz
      nodos.push(nodo);
    }
  });

  return nodos;
}

// Obtener el nivel padre de una jerarquía
function obtenerNivelPadre(nivel: string): string | null {
  const partes = nivel.split(".");
  if (partes.length === 1) return null; // Ya es raíz
  partes.pop();
  return partes.join(".");
}

function DepartamentoJerarquico({
  nombre,
  nodos,
  collapsedNodes,
  onToggle,
  onSelectFuncionario,
}: {
  nombre: string;
  nodos: NodoJerarquico[];
  collapsedNodes: Set<string>;
  onToggle: (id: string) => void;
  onSelectFuncionario: (f: VacacionFuncionario) => void;
}) {
  const depId = `dep-${nombre}`;
  const isCollapsed = collapsedNodes.has(depId);

  const totalFuncionarios = contarNodos(nodos);
  const totalPendientes = sumarPendientes(nodos);
  const totalTomados = sumarTomados(nodos);

  return (
    <>
      {/* Header Departamento */}
      <tr
        onClick={() => onToggle(depId)}
        className="cursor-pointer border-t-2 border-rimec-azul bg-gradient-to-r from-rimec-azul/10 to-transparent transition-colors hover:from-rimec-azul/20"
      >
        <td colSpan={6} className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-rimec-azul">
                {isCollapsed ? "▶" : "▼"}
              </span>
              <span className="font-serif text-xl font-bold text-rimec-azul-dark">
                {nombre}
              </span>
              <span className="rounded-full bg-rimec-azul px-3 py-1 text-xs font-bold text-white">
                {totalFuncionarios} funcionarios
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

      {/* Nodos Jerárquicos */}
      {!isCollapsed &&
        nodos.map((nodo) => (
          <NodoJerarquicoRow
            key={nodo.funcionario.id_funcionario}
            nodo={nodo}
            profundidad={0}
            collapsedNodes={collapsedNodes}
            onToggle={onToggle}
            onSelectFuncionario={onSelectFuncionario}
          />
        ))}
    </>
  );
}

function NodoJerarquicoRow({
  nodo,
  profundidad,
  collapsedNodes,
  onToggle,
  onSelectFuncionario,
}: {
  nodo: NodoJerarquico;
  profundidad: number;
  collapsedNodes: Set<string>;
  onToggle: (id: string) => void;
  onSelectFuncionario: (f: VacacionFuncionario) => void;
}) {
  const nodeId = `node-${nodo.funcionario.id_funcionario}`;
  const isCollapsed = collapsedNodes.has(nodeId);
  const tieneHijos = nodo.hijos.length > 0;

  const diasLegales = calcularDiasLegales(nodo.funcionario.antiguedad_anios || 0);
  const porcentaje = Math.round(
    (nodo.funcionario.dias_tomados / nodo.funcionario.dias_totales) * 100
  );

  const indent = profundidad * 24; // 24px por nivel

  return (
    <>
      {/* Fila del funcionario */}
      <tr className="group border-b border-neutral-200 bg-white transition-colors hover:bg-rimec-azul/5">
        <td className="px-4 py-3">
          <div className="flex items-center gap-3" style={{ paddingLeft: `${indent}px` }}>
            {/* Indicador de jerarquía */}
            {tieneHijos ? (
              <button
                onClick={() => onToggle(nodeId)}
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-rimec-azul hover:bg-rimec-azul/10"
              >
                <span className="text-sm font-bold">{isCollapsed ? "▶" : "▼"}</span>
              </button>
            ) : (
              <div className="w-6 flex-shrink-0" />
            )}

            {/* Avatar */}
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-rimec-azul text-xs font-bold text-white">
              {nodo.funcionario.nombres.split(" ")[0][0]}
              {nodo.funcionario.apellidos.split(" ")[0][0]}
            </div>

            {/* Info */}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-neutral-ink">{nodo.funcionario.nombre_completo}</span>
                {tieneHijos && (
                  <span className="rounded bg-success/10 px-2 py-0.5 text-xs font-bold text-success">
                    {nodo.nivel} • {nodo.hijos.length} subordinados
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-block rounded bg-rimec-azul/10 px-2 py-0.5 text-xs font-semibold text-rimec-azul">
                  {nodo.funcionario.cargo}
                </span>
                <span className="text-xs text-neutral-500">CI: {nodo.funcionario.ci}</span>
              </div>
            </div>
          </div>
        </td>

        <td className="px-3 py-3 text-center whitespace-nowrap">
          <div className="text-sm font-bold text-neutral-ink">
            {nodo.funcionario.antiguedad_anios || 0}a {nodo.funcionario.antiguedad_meses || 0}m
          </div>
          <div className="text-xs text-success">{diasLegales}d legal</div>
        </td>

        <td className="px-3 py-3 text-center whitespace-nowrap">
          <div className="font-bold text-sm">
            <span className="text-bazzar-naranja">{nodo.funcionario.dias_tomados}</span>
            <span className="text-neutral-400"> / </span>
            <span className="text-rimec-azul">{nodo.funcionario.dias_totales}</span>
          </div>
          {debeMostrarHoras(nodo.funcionario) && (
            <div className="text-xs font-bold text-bazzar-naranja">
              🕐 {formatHoras(nodo.funcionario.horas_tomadas)}
            </div>
          )}
        </td>

        <td className="px-3 py-3 text-center">
          <div
            className={`text-2xl font-extrabold ${
              nodo.funcionario.dias_pendientes === 0
                ? "text-neutral-400"
                : nodo.funcionario.dias_pendientes <= 10
                ? "text-bazzar-naranja"
                : "text-success"
            }`}
          >
            {nodo.funcionario.dias_pendientes}
          </div>
        </td>

        <td className="px-3 py-3">
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs font-bold text-neutral-600">{porcentaje}%</span>
            <div className="h-2 w-20 overflow-hidden rounded-full bg-neutral-200">
              <div
                className="h-full bg-gradient-to-r from-rimec-azul to-bazzar-naranja"
                style={{ width: `${porcentaje}%` }}
              />
            </div>
          </div>
        </td>

        <td className="px-3 py-3 text-center">
          <button
            onClick={() => onSelectFuncionario(nodo.funcionario)}
            className="rounded bg-rimec-azul px-3 py-1.5 text-xs font-bold text-white opacity-0 transition-all group-hover:opacity-100 hover:bg-rimec-azul-dark"
          >
            Ver
          </button>
        </td>
      </tr>

      {/* Hijos (subordinados) */}
      {!isCollapsed &&
        nodo.hijos.map((hijo) => (
          <NodoJerarquicoRow
            key={hijo.funcionario.id_funcionario}
            nodo={hijo}
            profundidad={profundidad + 1}
            collapsedNodes={collapsedNodes}
            onToggle={onToggle}
            onSelectFuncionario={onSelectFuncionario}
          />
        ))}
    </>
  );
}

// Helpers
function contarNodos(nodos: NodoJerarquico[]): number {
  return nodos.reduce((total, nodo) => total + 1 + contarNodos(nodo.hijos), 0);
}

function sumarPendientes(nodos: NodoJerarquico[]): number {
  return nodos.reduce(
    (total, nodo) => total + nodo.funcionario.dias_pendientes + sumarPendientes(nodo.hijos),
    0
  );
}

function sumarTomados(nodos: NodoJerarquico[]): number {
  return nodos.reduce(
    (total, nodo) => total + nodo.funcionario.dias_tomados + sumarTomados(nodo.hijos),
    0
  );
}

function calcularDiasLegales(antiguedadAnios: number): number {
  if (antiguedadAnios >= 10) return 30;
  if (antiguedadAnios >= 5) return 18;
  return 12;
}
