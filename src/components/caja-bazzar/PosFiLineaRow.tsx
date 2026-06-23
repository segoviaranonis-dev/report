"use client";

import type { TicketPosRow } from "@/lib/caja-bazzar/tickets-db";

type Props = {
  linea: TicketPosRow;
};

/** Réplica visual ItemRow (Aprobaciones FI) — miniatura · solo lectura en bandeja cajero. */
export function PosFiLineaRow({ linea }: Props) {
  const lc = linea.linea_codigo ?? "?";
  const rc = linea.referencia_codigo ?? "?";
  const alt = `L${lc} R${rc} ${linea.descp_color ?? linea.color_code ?? ""}`.trim();
  const img = linea.imagen_url?.trim();

  return (
    <div className="flex items-stretch gap-4 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border-2 border-neutral-200 bg-neutral-50">
        {img ? (
          <img
            src={img}
            alt={alt}
            className="h-full w-full object-contain"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center"
            role="img"
            aria-label={alt}
          >
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Sin foto</p>
            <p className="font-mono text-[9px] leading-tight text-slate-500">
              {lc}.{rc}
            </p>
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-base font-bold text-rimec-azul-dark">
          L{lc} · R{rc}
        </div>
        <div className="mt-0.5 text-sm text-neutral-700">
          {linea.descp_color || linea.color_code || "Sin color"}
          {linea.descp_material || linea.material_code
            ? ` · ${linea.descp_material || linea.material_code}`
            : ""}
        </div>
        <div className="mt-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rimec-azul">Grada</span>
          <div className="mt-0.5 inline-block rounded-md border border-rimec-azul/30 bg-rimec-azul/5 px-2.5 py-1 font-mono text-sm font-bold text-rimec-azul-dark">
            G.{linea.grada}
          </div>
        </div>
      </div>
    </div>
  );
}
