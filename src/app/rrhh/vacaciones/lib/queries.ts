/**
 * Queries para módulo Vacaciones
 * Usa pool PostgreSQL directo (DATABASE_URL)
 */

import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import type {
  VacacionFuncionario,
  FiltrosVacaciones,
  EstadisticasVacaciones,
} from "./types";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string {
  return v != null ? String(v) : "";
}

/**
 * Obtener vacaciones con filtros
 */
export async function fetchVacaciones(
  filtros: FiltrosVacaciones = {}
): Promise<VacacionFuncionario[]> {
  console.log('[fetchVacaciones] 🔄 Ejecutando query...', { timestamp: new Date().toISOString() });

  if (!isRimecDatabaseConfigured()) return [];

  const pool = getRimecPool();

  // Construir WHERE dinámico
  const conditions: string[] = ["v.activo = true"];
  const params: unknown[] = [];
  let paramCount = 1;

  // Filtro por año (default: año actual)
  const anio = filtros.anio ?? new Date().getFullYear();
  conditions.push(`v.anio = $${paramCount}`);
  params.push(anio);
  paramCount++;

  if (filtros.ente_id) {
    conditions.push(`f.ente_id = $${paramCount}`);
    params.push(filtros.ente_id);
    paramCount++;
  }

  if (filtros.buscar) {
    conditions.push(`(
      f.nombre_completo ILIKE $${paramCount} OR
      f.ci ILIKE $${paramCount}
    )`);
    params.push(`%${filtros.buscar}%`);
    paramCount++;
  }

  if (filtros.solo_pendientes) {
    conditions.push(`v.dias_pendientes > 0`);
  }

  const whereClause = conditions.join(" AND ");

  const res = await pool.query(
    `
    SELECT
      v.id_vacacion,
      v.anio,
      v.tipo_vacacion,
      v.dias_totales,
      v.dias_tomados,
      v.dias_pendientes,
      v.horas_totales,
      v.horas_tomadas,
      v.horas_pendientes,
      v.notas,
      v.activo,
      f.id_funcionario,
      f.ente_id,
      f.nombres,
      f.apellidos,
      f.nombre_completo,
      f.ci,
      f.sexo,
      f.fecha_nacimiento,
      f.departamento,
      f.cargo,
      f.item,
      f.fecha_ingreso_ips,
      f.antiguedad_anios,
      f.antiguedad_meses,
      f.jerarquia_organizacional,
      e.nombre AS ente_nombre,
      e.codigo AS ente_codigo
    FROM vacaciones v
    INNER JOIN funcionarios f ON f.id_funcionario = v.funcionario_id
    INNER JOIN entes e ON e.id_ente = f.ente_id
    WHERE ${whereClause}
    ORDER BY v.dias_pendientes DESC, f.apellidos ASC
    LIMIT 500
  `,
    params
  );

  const funcionarios = res.rows.map(
    (r): VacacionFuncionario => ({
      id_vacacion: num(r.id_vacacion),
      anio: num(r.anio),
      tipo_vacacion: (r.tipo_vacacion as 'DIAS' | 'HORAS' | 'MIXTO') || 'DIAS',
      dias_totales: num(r.dias_totales),
      dias_tomados: num(r.dias_tomados),
      dias_pendientes: num(r.dias_pendientes),
      horas_totales: num(r.horas_totales),
      horas_tomadas: num(r.horas_tomadas),
      horas_pendientes: num(r.horas_pendientes),
      notas: r.notas ? str(r.notas) : null,
      activo: Boolean(r.activo),
      id_funcionario: num(r.id_funcionario),
      ente_id: num(r.ente_id),
      nombres: str(r.nombres),
      apellidos: str(r.apellidos),
      nombre_completo: str(r.nombre_completo),
      ci: str(r.ci),
      sexo: r.sexo ? str(r.sexo) : null,
      fecha_nacimiento: r.fecha_nacimiento ? str(r.fecha_nacimiento) : null,
      departamento: str(r.departamento),
      cargo: str(r.cargo),
      item: r.item ? num(r.item) : null,
      fecha_ingreso_ips: r.fecha_ingreso_ips ? str(r.fecha_ingreso_ips) : null,
      antiguedad_anios: r.antiguedad_anios ? num(r.antiguedad_anios) : null,
      antiguedad_meses: r.antiguedad_meses ? num(r.antiguedad_meses) : null,
      jerarquia_organizacional: r.jerarquia_organizacional ? str(r.jerarquia_organizacional) : null,
      ente_nombre: str(r.ente_nombre),
      ente_codigo: num(r.ente_codigo),
    })
  );

  console.log(`[fetchVacaciones] ✅ ${funcionarios.length} funcionarios cargados`);

  // Log de ejemplo para Alejandro (CI 5659702)
  const alejandro = funcionarios.find(f => f.ci === '5659702');
  if (alejandro) {
    console.log('[fetchVacaciones] 👤 Alejandro Mohamed:', {
      dias_tomados: alejandro.dias_tomados,
      horas_tomadas: alejandro.horas_tomadas,
      dias_pendientes: alejandro.dias_pendientes,
      horas_pendientes: alejandro.horas_pendientes
    });
  }

  return funcionarios;
}

/**
 * Obtener estadísticas de vacaciones
 */
export async function fetchEstadisticasVacaciones(
  anio?: number
): Promise<EstadisticasVacaciones> {
  if (!isRimecDatabaseConfigured()) {
    return {
      total_funcionarios: 0,
      total_dias_pendientes: 0,
      promedio_dias_pendientes: 0,
      funcionarios_sin_tomar: 0,
    };
  }

  const pool = getRimecPool();
  const anioFiltro = anio ?? new Date().getFullYear();

  const res = await pool.query(
    `
    SELECT
      COUNT(*) AS total_funcionarios,
      SUM(dias_pendientes) AS total_dias_pendientes,
      ROUND(AVG(dias_pendientes), 1) AS promedio_dias_pendientes,
      COUNT(*) FILTER (WHERE dias_tomados = 0) AS funcionarios_sin_tomar
    FROM vacaciones
    WHERE activo = true AND anio = $1
  `,
    [anioFiltro]
  );

  const row = res.rows[0];

  return {
    total_funcionarios: num(row?.total_funcionarios),
    total_dias_pendientes: num(row?.total_dias_pendientes),
    promedio_dias_pendientes: num(row?.promedio_dias_pendientes),
    funcionarios_sin_tomar: num(row?.funcionarios_sin_tomar),
  };
}

/**
 * Buscar vacaciones de un funcionario específico por CI
 */
export async function fetchVacacionesPorCI(
  ci: string,
  anio?: number
): Promise<VacacionFuncionario | null> {
  if (!isRimecDatabaseConfigured()) return null;

  const pool = getRimecPool();
  const anioFiltro = anio ?? new Date().getFullYear();

  const res = await pool.query(
    `
    SELECT
      v.id_vacacion,
      v.anio,
      v.tipo_vacacion,
      v.dias_totales,
      v.dias_tomados,
      v.dias_pendientes,
      v.horas_totales,
      v.horas_tomadas,
      v.horas_pendientes,
      v.notas,
      v.activo,
      f.id_funcionario,
      f.ente_id,
      f.nombres,
      f.apellidos,
      f.nombre_completo,
      f.ci,
      f.sexo,
      f.fecha_nacimiento,
      f.departamento,
      f.cargo,
      f.item,
      f.fecha_ingreso_ips,
      f.antiguedad_anios,
      f.antiguedad_meses,
      f.jerarquia_organizacional,
      e.nombre AS ente_nombre,
      e.codigo AS ente_codigo
    FROM vacaciones v
    INNER JOIN funcionarios f ON f.id_funcionario = v.funcionario_id
    INNER JOIN entes e ON e.id_ente = f.ente_id
    WHERE f.ci = $1 AND v.anio = $2 AND v.activo = true
    LIMIT 1
  `,
    [ci, anioFiltro]
  );

  if (res.rows.length === 0) return null;

  const r = res.rows[0];
  return {
    id_vacacion: num(r.id_vacacion),
    anio: num(r.anio),
    tipo_vacacion: (r.tipo_vacacion as 'DIAS' | 'HORAS' | 'MIXTO') || 'DIAS',
    dias_totales: num(r.dias_totales),
    dias_tomados: num(r.dias_tomados),
    dias_pendientes: num(r.dias_pendientes),
    horas_totales: num(r.horas_totales),
    horas_tomadas: num(r.horas_tomadas),
    horas_pendientes: num(r.horas_pendientes),
    notas: r.notas ? str(r.notas) : null,
    activo: Boolean(r.activo),
    id_funcionario: num(r.id_funcionario),
    ente_id: num(r.ente_id),
    nombres: str(r.nombres),
    apellidos: str(r.apellidos),
    nombre_completo: str(r.nombre_completo),
    ci: str(r.ci),
    sexo: r.sexo ? str(r.sexo) : null,
    fecha_nacimiento: r.fecha_nacimiento ? str(r.fecha_nacimiento) : null,
    departamento: str(r.departamento),
    cargo: str(r.cargo),
    item: r.item ? num(r.item) : null,
    fecha_ingreso_ips: r.fecha_ingreso_ips ? str(r.fecha_ingreso_ips) : null,
    antiguedad_anios: r.antiguedad_anios ? num(r.antiguedad_anios) : null,
    antiguedad_meses: r.antiguedad_meses ? num(r.antiguedad_meses) : null,
    jerarquia_organizacional: r.jerarquia_organizacional ? str(r.jerarquia_organizacional) : null,
    ente_nombre: str(r.ente_nombre),
    ente_codigo: num(r.ente_codigo),
  };
}
