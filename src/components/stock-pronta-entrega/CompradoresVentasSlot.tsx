"use client";

import { useEffect, useState } from "react";
import type { VentaCompradorLinea } from "@/lib/clientes/etiqueta-comprador";
import { VENTA_VISUAL } from "@/lib/nexus/venta-visual";

type Props = {
  compradores: VentaCompradorLinea[];
  /** Tarjeta extendida (Extender todos los datos). */
  visible: boolean;
  /** Cierra acordeón al compactar tarjetas */
  resetKey?: boolean;
};

function fmtPares(n: number) {
  return new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(Math.round(n));
}

const LIST_MAX_H = "max-h-[6.5rem]";

/** Acordeón compradores — lista completa al expandir · sin truncar «+N más». */
export function CompradoresVentasSlot({ compradores, visible, resetKey = false }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (resetKey) setOpen(false);
  }, [resetKey]);

  if (!visible || compradores.length === 0) {
    return null;
  }

  const totalVendido = compradores.reduce((s, c) => s + c.pares, 0);

  return (
    <div className={`shrink-0 overflow-hidden rounded-md border border-violet-200/90 bg-violet-50/70 ${open ? "flex flex-col" : ""}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-h-[1.375rem] items-center justify-between gap-1 px-1.5 py-0.5 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-0.5 text-[7px] font-bold uppercase leading-none tracking-wide text-violet-900">
          <span className={`inline-block transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
            ▾
          </span>
          Compradores
        </span>
        <span className="shrink-0 text-[7px] font-semibold tabular-nums leading-none text-violet-800">
          {compradores.length} · {fmtPares(totalVendido)} v
        </span>
      </button>
      {open ? (
        <div className={`overflow-x-hidden overflow-y-auto border-t border-violet-200/60 px-1.5 py-0.5 ${LIST_MAX_H}`}>
          <div className="flex flex-col gap-px">
            {compradores.map((c, i) => (
              <div
                key={`${c.etiqueta}-${i}`}
                className="flex items-center justify-between gap-1 text-[8px] leading-[1.15] tabular-nums"
              >
                <span className="min-w-0 flex-1 truncate font-semibold text-slate-800" title={c.etiqueta}>
                  {c.etiqueta}
                </span>
                <span className={`shrink-0 font-bold whitespace-nowrap ${VENTA_VISUAL.label}`}>{fmtPares(c.pares)} v</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
