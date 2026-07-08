"use client";

import {
  LISTADO_PRECIO_TIERS,
  type ListadoPrecioTierId,
} from "@/lib/intencion-compra/listado-precio-tiers";

type Props = {
  value: ListadoPrecioTierId | null;
  onChange: (id: ListadoPrecioTierId) => void;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
};

/** Selector obligatorio política LP (1 tier) — PROGRAMADO. */
export function SelectorPoliticaLp({ value, onChange, required, disabled, hint }: Props) {
  return (
    <div className="rounded-xl border border-rimec-azul/20 bg-slate-50 p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-bold text-rimec-azul-dark">
          Política de precio (LP) {required ? <span className="text-red-600">*</span> : null}
        </p>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          2.3.1.7.3.1 · Obligatorio PROGRAMADO
        </p>
      </div>
      {hint ? <p className="mb-3 text-xs text-slate-600">{hint}</p> : null}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {LISTADO_PRECIO_TIERS.map((tier) => {
          const active = value === tier.id;
          return (
            <button
              key={tier.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(tier.id)}
              className={`rounded-lg border px-2 py-2.5 text-left transition ${
                active
                  ? "border-rimec-azul bg-rimec-azul text-white shadow-sm"
                  : "border-slate-300 bg-white text-slate-800 hover:border-rimec-azul/40"
              } disabled:opacity-50`}
            >
              <span className="block text-sm font-extrabold tracking-wide">{tier.label}</span>
              <span className={`mt-0.5 block text-[9px] leading-snug ${active ? "text-sky-100" : "text-slate-500"}`}>
                {tier.hint}
              </span>
            </button>
          );
        })}
      </div>
      {required && value == null && (
        <p className="mt-2 text-xs text-amber-800">Elegí LPN, LPC02, LPC03 o LPC04 antes de registrar.</p>
      )}
    </div>
  );
}
