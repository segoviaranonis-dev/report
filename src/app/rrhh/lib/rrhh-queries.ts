/**
 * Queries para módulo RRHH (Recursos Humanos)
 * Usa pool PostgreSQL directo (DATABASE_URL)
 */

import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import type {
  Ente,
  Funcionario,
  FuncionarioConEnte,
  FiltrosRRHH,
  EstadisticasRRHH,
} from "./types";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string {
  return v != null ? String(v) : "";
}

/**
 * Obtener todos los entes activos
 */
export async function fetchEntes(): Promise<Ente[]> {
  if (!isRimecDatabaseConfigured()) return [];

  const pool = getRimecPool();
  const res = await pool.query(`
    SELECT
      id_ente,
      codigo,
      nombre,
      tipo,
      activo,
      created_at
    FROM entes
    WHERE activo = true
    ORDER BY codigo ASC
  `);

  return res.rows.map((r) => ({
    id_ente: num(r.id_ente),
    codigo: num(r.codigo),
    nombre: str(r.nombre),
    tipo: r.tipo === "tienda" ? "tienda" : "empresa",
    activo: Boolean(r.activo),
    created_at: str(r.created_at),
  }));
}

/**
 * Obtener funcionarios con filtros opcionales
 */
export async function fetchFuncionarios(
  filtros: FiltrosRRHH = {}
): Promise<FuncionarioConEnte[]> {
  if (!isRimecDatabaseConfigured()) return [];

  const pool = getRimecPool();

  // Construir WHERE dinámico
  const conditions: string[] = ["f.activo = true"];
  const params: unknown[] = [];
  let paramCount = 1;

  if (filtros.ente_id) {
    conditions.push(`f.ente_id = $${paramCount}`);
    params.push(filtros.ente_id);
    paramCount++;
  }

  if (filtros.departamento) {
    conditions.push(`f.departamento = $${paramCount}`);
    params.push(filtros.departamento);
    paramCount++;
  }

  if (filtros.cargo) {
    conditions.push(`f.cargo = $${paramCount}`);
    params.push(filtros.cargo);
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

  const whereClause = conditions.join(" AND ");

  const anioActual = new Date().getFullYear();

  const res = await pool.query(
    `
    SELECT
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
      f.activo,
      f.created_at,
      f.updated_at,
      e.id_ente AS ente_id_ente,
      e.codigo AS ente_codigo,
      e.nombre AS ente_nombre,
      e.tipo AS ente_tipo,
      e.activo AS ente_activo,
      e.created_at AS ente_created_at,
      v.id_vacacion AS vac_id_vacacion,
      v.anio AS vac_anio,
      v.tipo_vacacion AS vac_tipo_vacacion,
      v.dias_totales AS vac_dias_totales,
      v.dias_tomados AS vac_dias_tomados,
      v.dias_pendientes AS vac_dias_pendientes,
      v.horas_totales AS vac_horas_totales,
      v.horas_tomadas AS vac_horas_tomadas,
      v.horas_pendientes AS vac_horas_pendientes,
      v.notas AS vac_notas,
      v.activo AS vac_activo
    FROM funcionarios f
    INNER JOIN entes e ON e.id_ente = f.ente_id
    LEFT JOIN vacaciones v ON v.funcionario_id = f.id_funcionario AND v.anio = ${anioActual} AND v.activo = true
    WHERE ${whereClause}
    ORDER BY f.apellidos ASC, f.nombres ASC
    LIMIT 500
  `,
    params
  );

  return res.rows.map((r): FuncionarioConEnte => ({
    id_funcionario: num(r.id_funcionario),
    ente_id: num(r.ente_id),
    nombres: str(r.nombres),
    apellidos: str(r.apellidos),
    nombre_completo: str(r.nombre_completo),
    ci: str(r.ci),
    sexo: r.sexo === "M" || r.sexo === "F" ? r.sexo : null,
    fecha_nacimiento: r.fecha_nacimiento ? str(r.fecha_nacimiento) : null,
    departamento: str(r.departamento),
    cargo: str(r.cargo),
    item: r.item != null ? num(r.item) : null,
    fecha_ingreso_ips: str(r.fecha_ingreso_ips),
    antiguedad_anios: r.antiguedad_anios != null ? num(r.antiguedad_anios) : null,
    antiguedad_meses: r.antiguedad_meses != null ? num(r.antiguedad_meses) : null,
    jerarquia_organizacional: r.jerarquia_organizacional ? str(r.jerarquia_organizacional) : null,
    activo: Boolean(r.activo),
    created_at: str(r.created_at),
    updated_at: str(r.updated_at),
    ente: {
      id_ente: num(r.ente_id_ente),
      codigo: num(r.ente_codigo),
      nombre: str(r.ente_nombre),
      tipo: r.ente_tipo === "tienda" ? "tienda" : "empresa",
      activo: Boolean(r.ente_activo),
      created_at: str(r.ente_created_at),
    },
    vacaciones: r.vac_id_vacacion != null ? {
      id_vacacion: num(r.vac_id_vacacion),
      anio: num(r.vac_anio),
      tipo_vacacion: (r.vac_tipo_vacacion as 'DIAS' | 'HORAS' | 'MIXTO') || 'DIAS',
      dias_totales: num(r.vac_dias_totales),
      dias_tomados: num(r.vac_dias_tomados),
      dias_pendientes: num(r.vac_dias_pendientes),
      horas_totales: num(r.vac_horas_totales),
      horas_tomadas: num(r.vac_horas_tomadas),
      horas_pendientes: num(r.vac_horas_pendientes),
      notas: r.vac_notas ? str(r.vac_notas) : null,
      activo: Boolean(r.vac_activo),
    } : null,
  }));
}

/**
 * Obtener estadísticas agregadas
 */
export async function fetchEstadisticas(): Promise<EstadisticasRRHH> {
  if (!isRimecDatabaseConfigured()) {
    return {
      total: 0,
      antiguedad_promedio_anios: 0,
      por_departamento: [],
      por_ente: [],
    };
  }

  const pool = getRimecPool();

  // Total y promedio antigüedad
  const resTotal = await pool.query(`
    SELECT
      COUNT(*) AS total,
      ROUND(AVG(antiguedad_anios), 1) AS antiguedad_promedio
    FROM funcionarios
    WHERE activo = true
  `);

  const total = num(resTotal.rows[0]?.total);
  const antiguedad_promedio_anios = num(resTotal.rows[0]?.antiguedad_promedio);

  // Por departamento
  const resDpto = await pool.query(`
    SELECT
      departamento,
      COUNT(*) AS count
    FROM funcionarios
    WHERE activo = true
    GROUP BY departamento
    ORDER BY count DESC
  `);

  const por_departamento = resDpto.rows.map((r) => ({
    departamento: str(r.departamento),
    count: num(r.count),
  }));

  // Por ente
  const resEnte = await pool.query(`
    SELECT
      e.nombre AS ente_nombre,
      COUNT(f.id_funcionario) AS count
    FROM entes e
    LEFT JOIN funcionarios f ON f.ente_id = e.id_ente AND f.activo = true
    WHERE e.activo = true
    GROUP BY e.nombre, e.codigo
    ORDER BY e.codigo ASC
  `);

  const por_ente = resEnte.rows.map((r) => ({
    ente_nombre: str(r.ente_nombre),
    count: num(r.count),
  }));

  return {
    total,
    antiguedad_promedio_anios,
    por_departamento,
    por_ente,
  };
}

/**
 * Obtener lista única de departamentos
 */
export async function fetchDepartamentos(): Promise<string[]> {
  if (!isRimecDatabaseConfigured()) return [];

  const pool = getRimecPool();
  const res = await pool.query(`
    SELECT DISTINCT departamento
    FROM funcionarios
    WHERE activo = true AND departamento IS NOT NULL AND departamento != ''
    ORDER BY departamento ASC
  `);

  return res.rows.map((r) => str(r.departamento));
}

/**
 * Obtener lista única de cargos
 */
export async function fetchCargos(): Promise<string[]> {
  if (!isRimecDatabaseConfigured()) return [];

  const pool = getRimecPool();
  const res = await pool.query(`
    SELECT DISTINCT cargo
    FROM funcionarios
    WHERE activo = true AND cargo IS NOT NULL AND cargo != ''
    ORDER BY cargo ASC
  `);

  return res.rows.map((r) => str(r.cargo));
}
