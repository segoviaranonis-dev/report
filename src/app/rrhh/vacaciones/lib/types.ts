/**
 * Types para módulo Vacaciones (RRHH)
 * NIIF UI - Report
 */

export interface VacacionFuncionario {
  id_vacacion: number;
  anio: number;

  // Sistema DUAL: días + horas
  tipo_vacacion: 'DIAS' | 'HORAS' | 'MIXTO';

  // Vacaciones por DÍAS
  dias_totales: number;
  dias_tomados: number;
  dias_pendientes: number;

  // Vacaciones por HORAS (gerentes)
  horas_totales: number;
  horas_tomadas: number;
  horas_pendientes: number;

  notas: string | null;
  activo: boolean;

  // Datos funcionario (join)
  id_funcionario: number;
  ente_id: number;
  nombres: string;
  apellidos: string;
  nombre_completo: string;
  ci: string;
  sexo: string | null;
  fecha_nacimiento: string | null;
  departamento: string;
  cargo: string;
  item: number | null;
  fecha_ingreso_ips: string | null;
  antiguedad_anios: number | null;
  antiguedad_meses: number | null;
  jerarquia_organizacional: string | null;
  ente_nombre: string;
  ente_codigo: number;
}

export interface FiltrosVacaciones {
  buscar?: string; // Nombre o CI
  anio?: number;
  ente_id?: number;
  solo_pendientes?: boolean;
}

export interface EstadisticasVacaciones {
  total_funcionarios: number;
  total_dias_pendientes: number;
  promedio_dias_pendientes: number;
  funcionarios_sin_tomar: number;
}
