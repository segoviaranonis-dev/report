import type { Pool } from "pg";

export type VincularBibliotecaPeResult =
  | {
      ok: true;
      biblioteca_id: number;
      biblioteca_nombre: string;
      actualizados: number;
      promocionales: number;
      sin_caso_bcl: number;
      pp_candados: number;
      numero_proforma: string | null;
    }
  | { ok: false; error: string; detail?: string };

export function normalizePeBatchLabel(batch?: string | null): string | null {
  const norm = batch?.trim().toLowerCase() || null;
  return norm && norm !== "—" ? norm : null;
}

type RpcPayload = {
  success?: boolean;
  error?: string;
  detail?: string;
  biblioteca_id?: number;
  biblioteca_nombre?: string;
  actualizados?: number;
  promocionales?: number;
  sin_caso_bcl?: number;
  pp_candados?: number;
  numero_proforma?: string | null;
};

function normalizeBatch(batch?: string | null): string | null {
  return normalizePeBatchLabel(batch);
}

export async function vincularBibliotecaPe(
  pool: Pool,
  opts: {
    bibliotecaId: number;
    usuarioId?: number | null;
    numeroProforma?: string | null;
  },
): Promise<VincularBibliotecaPeResult> {
  const { bibliotecaId, usuarioId, numeroProforma } = opts;
  const batchNorm = normalizeBatch(numeroProforma);
  if (!Number.isFinite(bibliotecaId) || bibliotecaId <= 0) {
    return { ok: false, error: "biblioteca_id inválido", detail: "BIB_INVALIDA" };
  }

  try {
    const { rows } = await pool.query<{ result: RpcPayload }>(
      `SELECT vincular_biblioteca_a_pe($1, $2, $3) AS result`,
      [bibliotecaId, usuarioId ?? null, batchNorm],
    );
    const r = rows[0]?.result;
    if (!r?.success) {
      return {
        ok: false,
        error: r?.error ?? "Error al vincular biblioteca PE",
        detail: r?.detail,
      };
    }
    const ppCandados = Number(r.pp_candados ?? 0);
    const actualizados = Number(r.actualizados ?? 0);
    if (batchNorm && ppCandados <= 0 && actualizados <= 0) {
      return {
        ok: false,
        error: `Candado no persistió — batch «${batchNorm}» sin filas PE STOCK`,
        detail: "BATCH_SIN_PP",
      };
    }

    return {
      ok: true,
      biblioteca_id: Number(r.biblioteca_id ?? bibliotecaId),
      biblioteca_nombre: String(r.biblioteca_nombre ?? ""),
      actualizados: Number(r.actualizados ?? 0),
      promocionales: Number(r.promocionales ?? 0),
      sin_caso_bcl: Number(r.sin_caso_bcl ?? 0),
      pp_candados: ppCandados,
      numero_proforma: r.numero_proforma ?? batchNorm,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al vincular biblioteca PE";
    if (msg.includes("vincular_biblioteca_a_pe")) {
      return {
        ok: false,
        error: "Función vincular_biblioteca_a_pe no existe — aplicar MIG-153.",
        detail: "MIG_153_PENDIENTE",
      };
    }
    return { ok: false, error: msg };
  }
}

export async function getBibliotecaVinculadaPe(
  pool: Pool,
  numeroProforma?: string | null,
): Promise<{ biblioteca_id: number | null; biblioteca_nombre: string | null }> {
  const params: unknown[] = [];
  let batchFilter = "";
  const batchNorm = normalizeBatch(numeroProforma);
  if (batchNorm) {
    params.push(batchNorm);
    batchFilter = `AND lower(btrim(pp.numero_proforma)) = $1`;
  }

  const { rows } = await pool.query<{ biblioteca_id: string | null; biblioteca_nombre: string | null }>(
    `
    SELECT
      pp.biblioteca_precio_id::text AS biblioteca_id,
      bp.nombre AS biblioteca_nombre
    FROM pedido_proveedor pp
    JOIN quincena_arribo qa ON qa.id = pp.quincena_arribo_id
    LEFT JOIN biblioteca_precio bp ON bp.id = pp.biblioteca_precio_id
    WHERE pp.entidad_comercial = 'STOCK'
      AND pp.deposito_codigo IS NOT NULL
      AND pp.estado_transito = 'EN_DEPOSITO'
      AND pp.categoria_id = 1
      AND lower(trim(qa.descripcion)) = lower('Pronta entrega')
      ${batchFilter}
    ORDER BY pp.id DESC
    LIMIT 1
    `,
    params,
  );

  const row = rows[0];
  return {
    biblioteca_id: row?.biblioteca_id ? Number(row.biblioteca_id) : null,
    biblioteca_nombre: row?.biblioteca_nombre ?? null,
  };
}
