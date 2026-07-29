/**
 * Triángulo filtros — Estilo + Género desde Administrador de Pilares (FK).
 * Siamese: AM · DPE · Web. Prohibido armar facetas estilo/género solo desde stock.
 */
import type { Pool } from "pg";
import { parseTipoV2Id } from "./constants";
import { loadEstilosForTipoV2 } from "./validar-maestras-pilares";
import type { TipoV2Id } from "./types";

export type MaestraFiltroItem = { id: number; label: string };

export type MaestrasFiltroTriangulo = {
  tipo_v2_id: TipoV2Id;
  estilos: MaestraFiltroItem[];
  generos: MaestraFiltroItem[];
};

/** ramo UI → tipo_v2 pilares (654 calzado · 638 confecciones). */
export function tipoV2IdFromRamoTipo(ramoTipo: string | null | undefined): TipoV2Id | null {
  const u = String(ramoTipo ?? "")
    .trim()
    .toUpperCase();
  if (u === "CALZADO" || u === "CALZADOS") return 1;
  if (u === "CONFECCIONES" || u === "CONFECCION") return 2;
  return null;
}

export async function loadMaestrasFiltroTriangulo(
  pool: Pool,
  tipoV2Id: TipoV2Id,
): Promise<MaestrasFiltroTriangulo> {
  const [estilos, generosRes] = await Promise.all([
    loadEstilosForTipoV2(pool, tipoV2Id),
    pool.query<{ id: number; label: string }>(
      `SELECT id, TRIM(descripcion) AS label
       FROM genero
       WHERE descripcion IS NOT NULL AND TRIM(descripcion) <> ''
       ORDER BY descripcion`,
    ),
  ]);
  return {
    tipo_v2_id: tipoV2Id,
    estilos,
    generos: generosRes.rows,
  };
}

export function parseTipoV2IdParam(raw: string | null | undefined): TipoV2Id {
  return parseTipoV2Id(raw);
}
