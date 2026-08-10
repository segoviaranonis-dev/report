"use client";

import { SF_NORTE } from "@/lib/situacion-financiera/norte";
import { SF_ISLA } from "@/lib/situacion-financiera/isla";
import { CHECKLIST_PUENTE_BOVEDA } from "@/lib/situacion-financiera/checklist-migracion";
import { checklistPuenteBovedaOk } from "@/lib/situacion-financiera/evento-cobro-boveda";

const OLAS = [
  {
    n: 1,
    t: "Corazón operativo",
    d: "Ritual corte · descuadres visibles · DIFICIL/Luisito Excel · T01–T12",
  },
  {
    n: 2,
    t: "Puente bóveda → sf_pago",
    d: "MIG-204 T13/T14 · evento cobro · Bazzar parte relacionada",
  },
  {
    n: 3,
    t: "Corte cerrado en UI",
    d: "API lee sf_corte cerrado (Supabase) o LAB JSON",
  },
  {
    n: 4,
    t: "Ratios sin mentir",
    d: "ROA/ROE/CCC bloqueados hasta utilidad+activos/patrimonio",
  },
];

export function SitFinAbsorcionTab({
  metaFuente,
}: {
  metaFuente?: string | null;
}) {
  const puenteOk = checklistPuenteBovedaOk();

  return (
    <div className="mt-4 space-y-4 text-sm text-slate-800">
      <div className="rounded border-2 border-amber-500 bg-amber-50 px-3 py-2 text-[12px] text-amber-950">
        <strong>ISLA · Faro de Alejandría ({SF_ISLA.codigo})</strong>
        <span className="mt-1 block">
          Esta pestaña es <em>norte / laboratorio</em>. No alimenta la verdad Sit
          Fin. Sit Fin corre en paralelo (como Sales Report) hasta que el
          Director abra integración Nexus.
        </span>
      </div>
      <section className="rounded border border-slate-300 bg-white p-3">
        <h3 className="font-serif font-semibold text-[#0f3d3e]">
          Norte ratificado
        </h3>
        <p className="mt-2 italic">«{SF_NORTE.frase}»</p>
        <ul className="mt-2 list-disc pl-5 text-xs space-y-1">
          <li>Orden: caja/cobros primero · NIIF/ratios después</li>
          <li>Verdad híbrida: ERP cheques/CxC · Nexus bóveda/stock · Sit Fin consolida</li>
          <li>Blindajes: Sales Report · pilares ≠ contabilidad</li>
        </ul>
        {metaFuente ? (
          <p className="mt-2 text-xs text-sky-800">
            Fuente corte cerrada: <strong>{metaFuente}</strong>
          </p>
        ) : (
          <p className="mt-2 text-xs text-amber-800">
            Sin corte cerrado Supabase/LAB — UI usa demo/pipeline.
          </p>
        )}
      </section>

      <section className="rounded border border-slate-300 bg-white p-3">
        <h3 className="font-serif font-semibold">Olas de absorción</h3>
        <ol className="mt-2 space-y-2">
          {OLAS.map((o) => (
            <li key={o.n} className="flex gap-2">
              <span className="font-mono font-bold text-[#0f3d3e]">
                {o.n}
              </span>
              <span>
                <strong>{o.t}</strong> — {o.d}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded border border-slate-300 bg-white p-3">
        <h3 className="font-serif font-semibold">
          Checklist 8 puntos (puente bóveda)
        </h3>
        <p className="mt-1 text-xs">
          Validación tipada:{" "}
          {puenteOk ? (
            <span className="text-emerald-800 font-semibold">OK</span>
          ) : (
            <span className="text-red-800">FAIL</span>
          )}
        </p>
        <pre className="mt-2 overflow-x-auto rounded bg-slate-50 p-2 text-[11px]">
          {JSON.stringify(CHECKLIST_PUENTE_BOVEDA, null, 2)}
        </pre>
      </section>
    </div>
  );
}
