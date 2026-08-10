"use client";

import { calcularRatios, type RatioInput } from "@/lib/situacion-financiera/ratios-motor";
import { SF_ISLA } from "@/lib/situacion-financiera/isla";

/**
 * Ola 4 — muestra fórmulas; ROA/ROE/CCC quedan bloqueados sin insumos de linaje.
 * ISLA: no consume resultados Nexus operativos.
 */
export function SitFinRatiosTab({
  proxyCajaGs,
  proxyCxcGs,
}: {
  proxyCajaGs?: number | null;
  proxyCxcGs?: number | null;
}) {
  const input: RatioInput = {
    cajaBancosGs: proxyCajaGs ?? null,
    pasivoCorrienteGs: null,
    cxcGs: proxyCxcGs ?? null,
    ventasPeriodoGs: null,
    inventarioGs: null,
    cmvGs: null,
    cxpGs: null,
    comprasPeriodoGs: null,
    utilidadGs: null,
    activosGs: null,
    patrimonioGs: null,
    diasPeriodo: 30,
  };
  const rows = calcularRatios(input);

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded border-2 border-amber-500 bg-amber-50 px-3 py-2 text-[12px] text-amber-950">
        <strong>ISLA · Faro ({SF_ISLA.codigo})</strong> — ratios en laboratorio;
        no integran módulos Nexus. Bloqueados sin linaje contable propio.
      </div>
      <p className="text-sm text-slate-700">
        <strong>Motor de ratios (Ola 4)</strong> — puro, sin mentir. Sit Fin hoy
        es <em>caja/cobros</em>; ROA/ROE exigen utilidad + activos/patrimonio con
        linaje. Mientras falten, quedan <strong>bloqueados</strong>.
      </p>
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="bg-[#0f3d3e] text-white text-left">
            <th className="px-2 py-1.5">Ratio</th>
            <th className="px-2 py-1.5">Fórmula</th>
            <th className="px-2 py-1.5">Valor</th>
            <th className="px-2 py-1.5">Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className={`border-t border-slate-200 ${
                r.estado === "bloqueado" ? "bg-slate-50" : "bg-emerald-50"
              }`}
            >
              <td className="px-2 py-1.5 font-semibold">
                {r.label}{" "}
                <span className="text-[10px] font-normal text-slate-500">
                  ola {r.ola}
                </span>
              </td>
              <td className="px-2 py-1.5 font-mono text-xs">{r.formula}</td>
              <td className="px-2 py-1.5 tabular-nums">
                {r.valor == null
                  ? "—"
                  : `${r.valor.toFixed(2)} ${r.unidad}`}
              </td>
              <td className="px-2 py-1.5 text-xs">
                {r.estado === "ok" ? (
                  <span className="text-emerald-800 font-semibold">ok</span>
                ) : (
                  <span className="text-amber-900">{r.motivoBloqueo}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
