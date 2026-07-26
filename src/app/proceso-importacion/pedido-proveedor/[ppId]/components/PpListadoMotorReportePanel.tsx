"use client";

import type { ListadoMotorFiReport } from "@/lib/pedido-proveedor/listado-motor-fi-types";
import {
  fmtDeltaListadoMotor,
  fmtGsListadoMotor,
  veredictoListadoMotor,
} from "@/lib/pedido-proveedor/listado-motor-fi-types";

type Props = {
  report: ListadoMotorFiReport;
};

/** Cajas monto anterior/nuevo + desglose SKUs tras imponer listado motor. */
export function PpListadoMotorReportePanel({ report: r }: Props) {
  const alerta =
    r.skus_sin_match > 0 || !r.todos_skus_ok
      ? "amber"
      : !r.hubo_cambio_monto
        ? "orange"
        : "emerald";

  const border =
    alerta === "amber"
      ? "border-amber-500"
      : alerta === "orange"
        ? "border-orange-500"
        : "border-emerald-500";
  const bg =
    alerta === "amber"
      ? "bg-amber-50"
      : alerta === "orange"
        ? "bg-orange-50"
        : "bg-emerald-50";

  return (
    <div className={`mt-2 rounded-xl border-2 ${border} ${bg} p-3`} onClick={(e) => e.stopPropagation()}>
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-800">
        Reporte listado motor
        {r.evento_id_antes != null && r.evento_id_antes !== r.evento_id && (
          <span className="ml-2 font-mono font-normal normal-case text-slate-600">
            #{r.evento_id_antes} → #{r.evento_id}
          </span>
        )}
      </p>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <div className="rounded-lg border-2 border-orange-400 bg-white px-2 py-2 text-center">
          <p className="text-[9px] font-bold uppercase text-orange-900">Monto anterior</p>
          <p className="mt-0.5 text-sm font-black tabular-nums text-slate-900">
            {fmtGsListadoMotor(r.monto_antes)}
          </p>
        </div>
        <div className="rounded-lg border-2 border-orange-400 bg-white px-2 py-2 text-center">
          <p className="text-[9px] font-bold uppercase text-orange-900">Monto nuevo</p>
          <p className="mt-0.5 text-sm font-black tabular-nums text-slate-900">
            {fmtGsListadoMotor(r.monto_despues)}
          </p>
        </div>
        <div
          className={`rounded-lg border-2 px-2 py-2 text-center ${
            r.delta_monto === 0
              ? "border-slate-300 bg-slate-100"
              : r.delta_monto > 0
                ? "border-blue-500 bg-blue-50"
                : "border-violet-500 bg-violet-50"
          }`}
        >
          <p className="text-[9px] font-bold uppercase text-slate-700">Variación</p>
          <p className="mt-0.5 text-sm font-black tabular-nums text-slate-900">
            {fmtDeltaListadoMotor(r.delta_monto)}
          </p>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] font-semibold text-slate-800 sm:grid-cols-4">
        <span>
          SKUs total: <strong>{r.skus_total}</strong>
        </span>
        <span className="text-emerald-800">
          Con precio listado: <strong>{r.skus_ok}</strong>
        </span>
        <span className={r.skus_cambiados > 0 ? "text-blue-800" : "text-slate-600"}>
          Precio distinto: <strong>{r.skus_cambiados}</strong>
        </span>
        <span className={r.skus_sin_cambio_precio > 0 ? "text-orange-800" : "text-slate-600"}>
          Mismo precio: <strong>{r.skus_sin_cambio_precio}</strong>
        </span>
        {r.skus_sin_match > 0 && (
          <span className="col-span-2 text-amber-900 sm:col-span-4">
            Sin match → precio 0: <strong>{r.skus_sin_match}</strong>
          </span>
        )}
      </div>

      <p className="mt-2 text-[10px] font-bold leading-snug text-slate-900">{veredictoListadoMotor(r)}</p>

      {r.sin_match.length > 0 && (
        <p className="mt-1 font-mono text-[9px] text-amber-950">
          Sin precio: {r.sin_match.join(" · ")}
        </p>
      )}
      {r.sin_cambio_precio.length > 0 && r.skus_sin_match === 0 && (
        <p className="mt-1 font-mono text-[9px] text-orange-900">
          SKU(s) sin cambio unitario: {r.sin_cambio_precio.join(" · ")}
        </p>
      )}

      <p className="mt-1 text-[9px] text-slate-600">
        Tier LPC{r.tier === 1 ? "N" : r.tier === 2 ? "02" : r.tier === 3 ? "03" : "04"}
        {r.logistica_sync ? " · Logística OK sincronizada" : " · Logística sin fila para esta FI"}
        {" · "}
        {(r.ms_server / 1000).toFixed(1)}s servidor
      </p>
    </div>
  );
}
