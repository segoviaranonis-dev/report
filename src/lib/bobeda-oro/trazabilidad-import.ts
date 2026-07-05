import type { Pool, PoolClient } from "pg";
import { getCajaTienda } from "@/lib/caja-bazzar/tiendas";

export type TrazabilidadImportCongelada = {
  deposito_tabla: string;
  import_batch_label: string | null;
  import_fecha: string | null;
  retail_batch_label: string | null;
  archivo_origen: string | null;
};

type DbConn = Pool | PoolClient;

/** Trazabilidad import depósito tienda — batch CSV vigente al par (sdsm4708, etc.). */
export async function resolverTrazabilidadDeposito(
  conn: DbConn,
  clienteId: number,
  pilares: {
    linea_id: number;
    referencia_id: number;
    material_id: number;
    color_id: number;
    grada: string;
  },
): Promise<TrazabilidadImportCongelada | null> {
  const tienda = getCajaTienda(clienteId);
  if (!tienda?.tabla_tienda) return null;
  const tabla = tienda.tabla_tienda;

  try {
    const mol = await conn.query<{
      batch_label: string | null;
      created_at: Date | null;
    }>(
      `
        SELECT batch_label, created_at
        FROM public.${tabla}
        WHERE linea_id = $1 AND referencia_id = $2 AND material_id = $3 AND color_id = $4 AND grada = $5
        ORDER BY created_at DESC NULLS LAST
        LIMIT 1
      `,
      [pilares.linea_id, pilares.referencia_id, pilares.material_id, pilares.color_id, pilares.grada],
    );
    const row = mol.rows[0];
    const batchLabel = row?.batch_label?.trim() || null;
    const importFecha = row?.created_at?.toISOString() ?? null;

    let archivoOrigen: string | null = null;
    try {
      const retail = await conn.query<{ archivo_origen: string | null; batch_label: string | null }>(
        `
          SELECT archivo_origen, batch_label
          FROM public.registro_st_vt_rc_reposicion
          WHERE cliente_id = $1
          ORDER BY created_at DESC NULLS LAST
          LIMIT 1
        `,
        [clienteId],
      );
      archivoOrigen = retail.rows[0]?.archivo_origen?.trim() || null;
    } catch {
      /* retail staging opcional */
    }

    return {
      deposito_tabla: tabla,
      import_batch_label: batchLabel,
      import_fecha: importFecha,
      retail_batch_label: batchLabel,
      archivo_origen: archivoOrigen,
    };
  } catch {
    return {
      deposito_tabla: tabla,
      import_batch_label: null,
      import_fecha: null,
      retail_batch_label: null,
      archivo_origen: null,
    };
  }
}

export function trazabilidadDesdeSnapshot(
  snap: Record<string, unknown>,
): Partial<TrazabilidadImportCongelada> {
  const str = (k: string) => {
    const v = snap[k];
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  return {
    deposito_tabla: str("deposito_tabla") ?? undefined,
    import_batch_label: str("import_batch_label") ?? str("batch_label") ?? undefined,
    import_fecha: str("import_fecha") ?? undefined,
    retail_batch_label: str("retail_batch_label") ?? str("batch_label") ?? undefined,
    archivo_origen:
      str("archivo_origen") ?? str("excel_archivo") ?? str("retail_archivo_origen") ?? undefined,
  };
}

export function mergeTrazabilidadEnSnapshot(
  snap: Record<string, unknown>,
  tr: TrazabilidadImportCongelada,
): Record<string, unknown> {
  return {
    ...snap,
    deposito_tabla: tr.deposito_tabla,
    import_batch_label: tr.import_batch_label,
    import_fecha: tr.import_fecha,
    retail_batch_label: tr.retail_batch_label,
    batch_label: tr.import_batch_label ?? tr.retail_batch_label,
    archivo_origen: tr.archivo_origen,
  };
}
