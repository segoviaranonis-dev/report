"use client";

import type { VentaCompradorLinea } from "@/lib/clientes/etiqueta-comprador";

type Props = {
  compradores: VentaCompradorLinea[];
  /** Tarjeta extendida (Extender todos los datos). */
  visible: boolean;
};

function fmtPares(n: number) {
  return new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(Math.round(n));
}

/** Slot inferior tarjeta CP — cadena o cliente (2 nombres) + pares vendidos. */
export function CompradoresVentasSlot({ compradores, visible }: Props) {
  if (!visible) return null;

  if (compradores.length === 0) {
    return <div className="h-7 shrink-0" aria-hidden />;
  }

  const top = compradores.slice(0, 3);
  const rest = compradores.length - top.length;

  return (
    <div className="mt-1 shrink-0 rounded-lg border border-violet-200/90 bg-violet-50/70 px-2 py-1">
      <p className="mb-0.5 text-[7px] font-bold uppercase tracking-wide text-violet-900">
        Compradores
      </p>
      <div className="flex flex-col gap-0.5">
        {top.map((c) => (
          <div
            key={c.etiqueta}
            className="flex items-center justify-between gap-1 text-[8px] leading-tight tabular-nums"
          >
            <span className="min-w-0 truncate font-semibold text-slate-800" title={c.etiqueta}>
              {c.etiqueta}
            </span>
            <span className="shrink-0 font-bold text-rose-700">{fmtPares(c.pares)} v</span>
          </div>
        ))}
        {rest > 0 ? (
          <p className="text-[7px] font-semibold text-violet-800">+{rest} más</p>
        ) : null}
      </div>
    </div>
  );
}
