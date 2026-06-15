/**
 * Types para módulo RRHH (Recursos Humanos)
 * Proyecto: Report (rimec-report)
 */

export interface Ente {
  id_ente: number;
  codigo: number;
  nombre: string;
  tipo: "empresa" | "tienda";
  activo: boolean;
  created_at: string;
}

export interface Funcionario {
  id_funcionario: number;
  ente_id: number;

  // Personales
  nombres: string;
  apellidos: string;
  nombre_completo: string;
  ci: string;
  sexo: "M" | "F" | null;
  fecha_nacimiento: string | null; // ISO date

  // Laborales
  departamento: string;
  cargo: string;
  item: number | null;
  fecha_ingreso_ips: string; // ISO date

  // Antigüedad
  antiguedad_anios: number | null;
  antiguedad_meses: number | null;
  jerarquia_organizacional: string | null;

  // Meta
  activo: boolean;
  created_at: string;
  updated_at: string;

  // Join
  ente?: Ente;
}

export interface VacacionesResumen {
  id_vacacion: number;
  anio: number;
  tipo_vacacion: 'DIAS' | 'HORAS' | 'MIXTO';
  dias_totales: number;
  dias_tomados: number;
  dias_pendientes: number;
  horas_totales: number;
  horas_tomadas: number;
  horas_pendientes: number;
  notas: string | null;
  activo: boolean;
}

export interface FuncionarioConEnte extends Funcionario {
  ente: Ente;
  vacaciones: VacacionesResumen | null;
}

export interface FiltrosRRHH {
  ente_id?: number;
  departamento?: string;
  cargo?: string;
  buscar?: string;
}

export interface EstadisticasRRHH {
  total: number;
  antiguedad_promedio_anios: number;
  por_departamento: { departamento: string; count: number }[];
  por_ente: { ente_nombre: string; count: number }[];
}
