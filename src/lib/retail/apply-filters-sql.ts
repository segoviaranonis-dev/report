import type { RetailFilterState } from "./retail-filters";

/**
 * Escapa valores para SQL (protección básica contra inyección)
 */
function escapeSql(value: string | number): string {
  if (typeof value === 'number') {
    return value.toString();
  }
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Construye el string WHERE completo para usar en SQL
 * Inserta los valores directamente (sin parámetros parametrizados)
 */
export function buildWhereClause(filters: RetailFilterState): string {
  const whereClauses: string[] = [];

  // Filtro por género
  if (filters.generoId) {
    whereClauses.push(`s.genero_id = ${Number(filters.generoId)}`);
  }

  // Filtro por marca
  if (filters.marcaId) {
    whereClauses.push(`s.marca_id = ${Number(filters.marcaId)}`);
  }

  // Filtro por estilo
  if (filters.grupoEstiloId) {
    whereClauses.push(`s.grupo_estilo_id = ${Number(filters.grupoEstiloId)}`);
  }

  // Filtro por líneas (IN clause)
  if (filters.lineaIds.length > 0) {
    const ids = filters.lineaIds.map(id => Number(id)).join(',');
    whereClauses.push(`s.linea_id IN (${ids})`);
  }

  // Filtro por tipos (IN clause)
  if (filters.tipoIds.length > 0) {
    const ids = filters.tipoIds.map(id => Number(id)).join(',');
    whereClauses.push(`s.tipo_1_id IN (${ids})`);
  }

  // Filtro por tipo V2 - Calzados/Confecciones (default calzado = 1)
  if (filters.tipoV2Ids.length > 0) {
    const ids = filters.tipoV2Ids.map(id => Number(id)).join(',');
    whereClauses.push(`COALESCE(s.tipo_v2_id, 1) IN (${ids})`);
  }

  // Filtro por colores (IN clause)
  if (filters.colorIds.length > 0) {
    const ids = filters.colorIds.map(id => Number(id)).join(',');
    whereClauses.push(`s.color_id IN (${ids})`);
  }

  // Filtro por búsqueda de texto
  if (filters.q.trim()) {
    const searchTerm = escapeSql(filters.q.trim().toLowerCase());
    whereClauses.push(`(
      lower(s.linea_codigo_proveedor) LIKE '%' || ${searchTerm} || '%' OR
      lower(s.referencia_codigo_proveedor) LIKE '%' || ${searchTerm} || '%' OR
      lower(mv.descp_marca) LIKE '%' || ${searchTerm} || '%' OR
      lower(ge.descp_grupo_estilo) LIKE '%' || ${searchTerm} || '%'
    )`);
  }

  return whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
}
