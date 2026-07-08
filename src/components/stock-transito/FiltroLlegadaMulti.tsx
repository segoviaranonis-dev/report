"use client";

import { useEffect, useRef, useState } from "react";
import type { StockTransitoResumen } from "@/lib/stock-transito/queries-resumen";

type Props = {
  quincenas: StockTransitoResumen["por_quincena"];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

/** Multi-select Llegada — paridad visual RIMEC Web `DropdownFilterQuincena`. */
export function FiltroLlegadaMulti({ quincenas, selectedIds, onChange }: Props) {
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
            ? "border-rimec-azul/40 bg-rimec-azul/5 text-rimec-azul"
            : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
        }`}
      >
        Llegada
        {active ? (
          <span className="rounded border border-sky-100 bg-white px-1.5 py-0.5 text-[10px] tabular-nums">
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
        <div className="absolute left-0 top-full z-40 mt-1.5 w-72 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-lg">
          <div className="max-h-60 overflow-y-auto py-1">
            {quincenas.map((q) => {
              const id = String(q.quincena_arribo_id);
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
                      sel ? "border-rimec-azul bg-rimec-azul" : "border-slate-300 bg-white"
                    }`}
                  >
                    {sel ? (
                      <svg className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block ${sel ? "font-semibold text-rimec-azul" : "text-slate-700"}`}>
                      {q.label}
                    </span>
                    <span className="block text-[10px] text-slate-500">
                      {Math.round(q.pares_saldo).toLocaleString("es-PY")} saldo · {q.pp_count} PP
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
              className="ml-auto rounded-md bg-rimec-azul px-3 py-1 text-[11px] font-semibold text-white"
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
