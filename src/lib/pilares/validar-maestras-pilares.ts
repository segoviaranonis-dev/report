import type { Pool } from "pg";
import {
  estiloPermitidoParaTipoV2,
  ESTILOS_CALZADO_EXCLUSIVOS,
  ESTILOS_POR_TIPO_V2,
  normMaestraLabel,
  tipo1PermitidoParaTipoV2,
  TIPO1_POR_TIPO_V2,
} from "./constants";
import type { TipoV2Id } from "./types";

async function loadEstilosByLabels(
  pool: Pool,
  labels: readonly string[],
): Promise<{ id: number; label: string }[]> {
  if (!labels.length) return [];
  const keys = labels.map((l) => normMaestraLabel(l));
  const { rows } = await pool.query<{ id: number; label: string }>(
    `
    SELECT id_grupo_estilo AS id, TRIM(descp_grupo_estilo) AS label
    FROM grupo_estilo_v2
    WHERE upper(regexp_replace(trim(descp_grupo_estilo), '\\s+', ' ', 'g')) = ANY($1::text[])
    ORDER BY descp_grupo_estilo
    `,
    [keys],
  );
  return rows.filter((row, idx, all) => {
    const id = Number(row.id);
    return all.findIndex((r) => Number(r.id) === id) === idx;
  });
}

/** 638: todo grupo_estilo_v2 menos calzado (col J comercial ya cargado en maestros). */
async function loadEstilosConfecciones638(
  pool: Pool,
): Promise<{ id: number; label: string }[]> {
  const banned = ESTILOS_CALZADO_EXCLUSIVOS.map((l) => normMaestraLabel(l));
  const { rows } = await pool.query<{ id: number; label: string }>(
    `
    SELECT id_grupo_estilo AS id, TRIM(descp_grupo_estilo) AS label
    FROM grupo_estilo_v2
    WHERE NULLIF(TRIM(descp_grupo_estilo), '') IS NOT NULL
      AND upper(regexp_replace(trim(descp_grupo_estilo), '\\s+', ' ', 'g')) <> ALL($1::text[])
    ORDER BY descp_grupo_estilo
    `,
    [banned],
  );
  return rows.filter((row, idx, all) => {
    const id = Number(row.id);
    return all.findIndex((r) => Number(r.id) === id) === idx;
  });
}

async function loadTipos1ByLabels(
  pool: Pool,
  labels: readonly string[],
): Promise<{ id: number; label: string }[]> {
  if (!labels.length) return [];
  const keys = labels.map((l) => normMaestraLabel(l));
  const { rows } = await pool.query<{ id: number; label: string }>(
    `
    SELECT id_tipo_1 AS id, TRIM(descp_tipo_1) AS label
    FROM tipo_1
    WHERE upper(regexp_replace(trim(descp_tipo_1), '\\s+', ' ', 'g')) = ANY($1::text[])
    ORDER BY descp_tipo_1
    `,
    [keys],
  );
  return rows.filter((row, idx, all) => {
    const id = Number(row.id);
    return all.findIndex((r) => Number(r.id) === id) === idx;
  });
}

/** Catálogo estilo acotado al proveedor activo (654 calzado · 638 conf col J). */
export async function loadEstilosForTipoV2(
  pool: Pool,
  tipoV2Id: TipoV2Id,
): Promise<{ id: number; label: string }[]> {
  if (tipoV2Id === 2) return loadEstilosConfecciones638(pool);
  return loadEstilosByLabels(pool, ESTILOS_POR_TIPO_V2[1]);
}

/** Catálogo tipo 1 acotado al proveedor activo. */
export async function loadTipos1ForTipoV2(
  pool: Pool,
  tipoV2Id: TipoV2Id,
): Promise<{ id: number; label: string }[]> {
  return loadTipos1ByLabels(pool, TIPO1_POR_TIPO_V2[tipoV2Id]);
}

async function labelGrupoEstilo(pool: Pool, id: number): Promise<string | null> {
  const { rows } = await pool.query<{ label: string }>(
    `SELECT TRIM(descp_grupo_estilo) AS label FROM grupo_estilo_v2 WHERE id_grupo_estilo = $1`,
    [id],
  );
  return rows[0]?.label ?? null;
}

async function labelTipo1(pool: Pool, id: number): Promise<string | null> {
  const { rows } = await pool.query<{ label: string }>(
    `SELECT TRIM(descp_tipo_1) AS label FROM tipo_1 WHERE id_tipo_1 = $1`,
    [id],
  );
  return rows[0]?.label ?? null;
}

/** Valida FK antes de PATCH — rechaza manzanas con peras. */
export async function assertMaestrasPermitidasParaTipoV2(
  pool: Pool,
  tipoV2Id: TipoV2Id,
  fields: { grupo_estilo_id?: number | null; tipo_1_id?: number | null },
): Promise<string | null> {
  if (fields.grupo_estilo_id != null) {
    const lbl = await labelGrupoEstilo(pool, fields.grupo_estilo_id);
    if (!lbl) return "Estilo inexistente";
    if (!estiloPermitidoParaTipoV2(tipoV2Id, lbl)) {
      return `Estilo «${lbl}» no aplica a ${tipoV2Id === 2 ? "Confecciones (638)" : "Calzados (654)"}`;
    }
  }
  if (fields.tipo_1_id != null) {
    const lbl = await labelTipo1(pool, fields.tipo_1_id);
    if (!lbl) return "Tipo 1 inexistente";
    if (!tipo1PermitidoParaTipoV2(tipoV2Id, lbl)) {
      return `Tipo 1 «${lbl}» no aplica a ${tipoV2Id === 2 ? "Confecciones (638)" : "Calzados (654)"}`;
    }
  }
  return null;
}
