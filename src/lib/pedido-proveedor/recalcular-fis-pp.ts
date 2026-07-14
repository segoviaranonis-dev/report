import { resincronizarFiDesdeListadoPp } from "@/app/aprobaciones/lib/aprobaciones-mutations";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export type RecalcFisPpStats = {
  fi_procesadas: number;
  fi_actualizadas: number;
  lineas_actualizadas: number;
  lineas_sin_precio: number;
  monto_fi_antes: number;
  monto_fi_despues: number;
  delta_monto_fi: number;
};

function estadosFi(incluirConfirmadas: boolean): string[] {
  return incluirConfirmadas ? ["RESERVADA", "CONFIRMADA"] : ["RESERVADA"];
}

/** Recalc FI del PP desde snapshot PPD / precio_lista (paridad Python · serverless). */
export async function recalcularFisPp(
  ppId: number,
  opts?: { incluirConfirmadas?: boolean },
): Promise<
  | { ok: true; message: string; stats: RecalcFisPpStats }
  | { ok: false; error: string }
> {
  if (!isRimecDatabaseConfigured()) {
    return { ok: false, error: "DATABASE_URL no configurada" };
  }

  const pool = getRimecPool();
  const incluirConfirmadas = Boolean(opts?.incluirConfirmadas);
  const estados = estadosFi(incluirConfirmadas);

  const { rows: ppRows } = await pool.query<{ estado: string }>(
    `SELECT estado FROM pedido_proveedor WHERE id = $1`,
    [ppId],
  );
  if (!ppRows[0]) return { ok: false, error: "PP no encontrado" };
  if ((ppRows[0].estado || "").toUpperCase() === "ENVIADO") {
    return { ok: false, error: "PP ENVIADO — listado congelado." };
  }

  const montoAntesRes = await pool.query<{ s: string }>(
    `SELECT COALESCE(SUM(total_monto), 0)::text AS s
     FROM factura_interna
     WHERE pp_id = $1 AND UPPER(TRIM(estado)) = ANY($2::text[])`,
    [ppId, estados],
  );
  const montoFiAntes = Number(montoAntesRes.rows[0]?.s ?? 0);

  const { rows: fiRows } = await pool.query<{ id: string; nro_factura: string }>(
    `SELECT id, nro_factura FROM factura_interna
     WHERE pp_id = $1 AND UPPER(TRIM(estado)) = ANY($2::text[])
     ORDER BY nro_factura`,
    [ppId, estados],
  );

  if (fiRows.length === 0) {
    return {
      ok: true,
      message: incluirConfirmadas
        ? "Sin FI RESERVADA/CONFIRMADA para recalcular."
        : "Sin FI RESERVADA para recalcular.",
      stats: {
        fi_procesadas: 0,
        fi_actualizadas: 0,
        lineas_actualizadas: 0,
        lineas_sin_precio: 0,
        monto_fi_antes: montoFiAntes,
        monto_fi_despues: montoFiAntes,
        delta_monto_fi: 0,
      },
    };
  }

  const stats: RecalcFisPpStats = {
    fi_procesadas: fiRows.length,
    fi_actualizadas: 0,
    lineas_actualizadas: 0,
    lineas_sin_precio: 0,
    monto_fi_antes: montoFiAntes,
    monto_fi_despues: 0,
    delta_monto_fi: 0,
  };

  const errores: string[] = [];

  for (const fi of fiRows) {
    const fiId = Number(fi.id);
    const res = await resincronizarFiDesdeListadoPp(fiId, { usarRedondeoComercial: true });
    if (!res.ok) {
      errores.push(`${fi.nro_factura}: ${res.msg}`);
      continue;
    }
    stats.fi_actualizadas++;
    stats.lineas_actualizadas += res.lineas?.length ?? 0;
  }

  const montoDespuesRes = await pool.query<{ s: string }>(
    `SELECT COALESCE(SUM(total_monto), 0)::text AS s
     FROM factura_interna
     WHERE pp_id = $1 AND UPPER(TRIM(estado)) = ANY($2::text[])`,
    [ppId, estados],
  );
  stats.monto_fi_despues = Number(montoDespuesRes.rows[0]?.s ?? 0);
  stats.delta_monto_fi = Math.round((stats.monto_fi_despues - stats.monto_fi_antes) * 100) / 100;

  if (stats.fi_actualizadas === 0 && errores.length > 0) {
    return { ok: false, error: errores.join(" · ") };
  }

  let message = `Recalculadas ${stats.fi_actualizadas}/${stats.fi_procesadas} FI · ${stats.lineas_actualizadas} líneas.`;
  if (stats.delta_monto_fi !== 0) {
    message += ` Δ FI: Gs. ${stats.delta_monto_fi.toLocaleString("es-PY")}.`;
  }
  if (errores.length) {
    message += ` Parcial — fallos: ${errores.join("; ")}`;
  }

  return { ok: true, message, stats };
}
