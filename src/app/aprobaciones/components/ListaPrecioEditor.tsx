"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cambiarListaPrecioFiAction } from "../actions";
import {
  LISTAS_PRECIO_OPCIONES,
  listaPrecioLabel,
} from "../lib/aprobaciones-utils";

type ListaPrecioEditorProps = {
  fiId: number;
  listaPrecioId: number | null;
  editable: boolean;
  onFeedback?: (tipo: "success" | "error", texto: string) => void;
  onApplied?: () => void;
};

export function ListaPrecioEditor({
  fiId,
  listaPrecioId,
  editable,
  onFeedback,
  onApplied,
}: ListaPrecioEditorProps) {
  const [actual, setActual] = useState(listaPrecioId ?? 1);
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActual(listaPrecioId ?? 1);
  }, [listaPrecioId]);

  useEffect(() => {
    if (!abierto) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [abierto]);

  async function elegir(listaId: number) {
    if (listaId === actual || guardando) {
      setAbierto(false);
      return;
    }
    setGuardando(true);
    setAbierto(false);
    setErrorLocal(null);
    const res = await cambiarListaPrecioFiAction(fiId, listaId);
    if (res.success) {
      setActual(listaId);
      onFeedback?.("success", res.message ?? "Lista actualizada.");
      onApplied?.();
    } else {
      const err = res.error ?? "No se pudo cambiar la lista.";
      setErrorLocal(err);
      onFeedback?.("error", err);
    }
    setGuardando(false);
  }

  const label = listaPrecioLabel(actual);

  if (!editable) {
    return (
      <div className="rounded-lg border-2 border-rimec-azul/40 bg-rimec-azul/10 px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-rimec-azul">LPN</p>
        <p className="mt-0.5 text-lg font-semibold text-rimec-azul-dark">{label}</p>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative rounded-lg border-2 border-rimec-azul/40 bg-rimec-azul/10 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-rimec-azul">Lista precio</p>
      <div className="mt-0.5 flex items-center gap-1">
        <span className="text-lg font-semibold text-rimec-azul-dark">
          {guardando ? "…" : label}
        </span>
        <button
          type="button"
          aria-label="Cambiar lista de precios"
          aria-expanded={abierto}
          disabled={guardando}
          onClick={() => setAbierto((v) => !v)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-rimec-azul/30 bg-white text-rimec-azul shadow-sm hover:bg-rimec-azul/5 disabled:opacity-50"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${abierto ? "rotate-180" : ""}`} />
        </button>
      </div>
      {abierto && (
        <ul
          className="absolute left-0 top-full z-20 mt-1 min-w-[8.5rem] overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
          role="listbox"
        >
          {LISTAS_PRECIO_OPCIONES.map((op) => (
            <li key={op.id}>
              <button
                type="button"
                role="option"
                aria-selected={op.id === actual}
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-rimec-azul/10 ${
                  op.id === actual ? "bg-rimec-azul/15 font-bold text-rimec-azul-dark" : "text-neutral-ink"
                }`}
                onClick={() => elegir(op.id)}
              >
                {op.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-[9px] text-rimec-azul/80">Precio desde PP · recalcula descuentos</p>
      {errorLocal && (
        <p className="mt-1 text-[10px] font-medium text-semantic-error">{errorLocal}</p>
      )}
    </div>
  );
}
