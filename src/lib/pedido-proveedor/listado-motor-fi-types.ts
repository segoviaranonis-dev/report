/** Estadísticas resync FI desde listado motor (client-safe). */
export type ResyncFiStats = {
  skus_total: number;
  skus_ok: number;
  skus_sin_match: number;
  skus_sin_cambio_precio: number;
  skus_cambiados: number;
  sin_match: string[];
  sin_cambio_precio: string[];
  monto_antes: number;
  monto_despues: number;
  delta_monto: number;
  evento_id: number | null;
  tier: number;
  todos_skus_ok: boolean;
  hubo_cambio_monto: boolean;
};

/** Reporte visible al imponer listado motor en una FI. */
export type ListadoMotorFiReport = ResyncFiStats & {
  evento_id: number;
  evento_id_antes: number | null;
  logistica_sync: boolean;
  ms_server: number;
  nro_factura?: string;
};

export function fmtGsListadoMotor(n: number): string {
  return `Gs. ${Math.round(n).toLocaleString("es-PY")}`;
}

export function fmtDeltaListadoMotor(delta: number): string {
  if (delta === 0) return "Sin cambio";
  const sign = delta > 0 ? "+" : "−";
  return `${sign}${fmtGsListadoMotor(Math.abs(delta))}`;
}

export function veredictoListadoMotor(r: ListadoMotorFiReport): string {
  if (r.skus_sin_match === r.skus_total) {
    return `Listado #${r.evento_id} aplicado · ${r.skus_total} SKU(s) sin match → precio 0 (verdad listado)`;
  }
  if (r.skus_sin_match > 0) {
    return `Listado #${r.evento_id} · ${r.skus_ok}/${r.skus_total} con precio · ${r.skus_sin_match} sin match → 0`;
  }
  if (!r.todos_skus_ok) {
    return `⚠ Solo ${r.skus_ok}/${r.skus_total} SKU(s) recalculados`;
  }
  if (!r.hubo_cambio_monto) {
    const prev = r.evento_id_antes != null ? `#${r.evento_id_antes}` : "anterior";
    return `Listado #${r.evento_id} aplicado · mismo monto que ${prev} · ${r.skus_sin_cambio_precio}/${r.skus_total} SKU(s) sin cambio unitario`;
  }
  return `✓ ${r.skus_cambiados}/${r.skus_total} SKU(s) con precio distinto · todos recalculados`;
}

export function fmtReporteListadoMotor(r: ListadoMotorFiReport): string {
  return (
    `${veredictoListadoMotor(r)} · ${fmtGsListadoMotor(r.monto_antes)} → ${fmtGsListadoMotor(r.monto_despues)}` +
    ` · Δ ${fmtDeltaListadoMotor(r.delta_monto)}` +
    (r.logistica_sync ? " · Logística OK ✓" : " · Logística sin fila") +
    ` · ${(r.ms_server / 1000).toFixed(1)}s`
  );
}
