"use client";

import { useEffect, useRef, useState } from "react";
import type { ProgramadoResumenProforma } from "@/lib/stock-programado/queries-resumen";

type Props = {
  proformas: ProgramadoResumenProforma[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

/** Multi-select Proforma proveedor — dato duro pp_id + numero_proforma. */
export function FiltroProformaMulti({ proformas, selectedIds, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState<string[]>(selectedIds);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTemp(selectedIds);
  }, [selectedIds]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function toggle(id: string) {
    setTemp((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const active = selectedIds.length > 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
          active
            ? "border-amber-500/50 bg-amber-50 text-amber-950"
            : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
        }`}
      >
        Proforma
        {active ? (
          <span className="rounded border border-amber-100 bg-white px-1.5 py-0.5 text-[10px] tabular-nums">
            {selectedIds.length}
          </span>
        ) : null}
        <svg
          className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-40 mt-1.5 w-80 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-lg">
          <div className="max-h-60 overflow-y-auto py-1">
            {proformas.map((p) => {
              const id = String(p.pp_id);
              const sel = temp.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggle(id)}
                  className="flex w-full items-start gap-2.5 px-3 py-2 text-left text-xs hover:bg-slate-50"
                >
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      sel ? "border-amber-600 bg-amber-600" : "border-slate-300 bg-white"
                    }`}
                  >
                    {sel ? (
                      <svg className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block ${sel ? "font-semibold text-amber-950" : "text-slate-700"}`}>
                      {p.proforma}
                      {p.n_fi > 0 ? (
                        <span className="ml-1 rounded bg-violet-100 px-1 py-0.5 text-[9px] font-bold text-violet-900">
                          {p.n_fi} FI
                        </span>
                      ) : null}
                    </span>
                    <span className="block text-[10px] text-slate-500">
                      {p.pp_nro} · {Math.round(p.pares_vendidos).toLocaleString("es-PY")} vendido ·{" "}
                      {Math.round(p.pares_saldo).toLocaleString("es-PY")} saldo
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 border-t border-slate-100 px-3 py-2">
            <button
              type="button"
              className="text-[11px] font-medium text-slate-500 hover:text-slate-800"
              onClick={() => {
                setTemp([]);
                onChange([]);
                setOpen(false);
              }}
            >
              Limpiar
            </button>
            <button
              type="button"
              className="ml-auto rounded-md bg-amber-600 px-3 py-1 text-[11px] font-semibold text-white"
              onClick={() => {
                onChange(temp);
                setOpen(false);
              }}
            >
              Aplicar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
