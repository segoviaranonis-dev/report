import type { Pool } from "pg";
import { getCompraPreviaKpiCanon, type CompraPreviaKpiCanon } from "@/lib/panel-control/compra-previa-canonical";

/**
 * Réplica SQL de rimec-web/lib/controlStock (fetchControl + buildTree calcularKpis).
 * COMPRA PREVIA Panel = KPIs Estadísticas :3001 sin filtros opcionales.
 */
export type CompraPreviaEstadisticasWeb = CompraPreviaKpiCanon;

export async function getCompraPreviaEstadisticasWeb(pool: Pool): Promise<CompraPreviaEstadisticasWeb> {
  return getCompraPreviaKpiCanon(pool);
}
