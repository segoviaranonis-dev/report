"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { TipoV2Id } from "@/lib/pilares/types";

interface PilaresLineaSearchInputProps {
  tipoV2Id: TipoV2Id;
  value: string;
  onChange: (value: string) => void;
  onPick?: (codigo: string) => void;
  placeholder?: string;
  label: string;
}

export function PilaresLineaSearchInput({
  tipoV2Id,
  value,
  onChange,
  onPick,
  placeholder = "Buscar línea…",
  label,
}: PilaresLineaSearchInputProps) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSuggestions = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) {
        setSuggestions([]);
        return;
      }
      setLoading(true);
      try {
        const params = new URLSearchParams({
          tipo_v2_id: String(tipoV2Id),
          q: trimmed,
          limit: "12",
        });
        const res = await fetch(`/api/pilares/lineas/codigos?${params}`);
        const data = await res.json();
        setSuggestions(res.ok ? (data.codigos ?? []) : []);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    },
    [tipoV2Id],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      if (open) fetchSuggestions(value);
    }, 220);
    return () => clearTimeout(t);
  }, [value, open, fetchSuggestions]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (codigo: string) => {
    if (onPick) onPick(codigo);
    else onChange(codigo);
    setOpen(false);
  };

  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-semibold uppercase text-report-muted">{label}</span>
      <div ref={wrapRef} className="relative">
        <input
          type="search"
          role="combobox"
          aria-expanded={open && suggestions.length > 0}
          aria-controls={listId}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-full border-2 border-rimec-azul bg-white py-3 pl-5 pr-11 text-base font-mono text-report-ink shadow-sm placeholder:text-neutral-400 focus:border-rimec-azul-dark focus:outline-none focus:ring-2 focus:ring-rimec-azul/20"
        />
        {value ? (
          <button
            type="button"
            aria-label="Limpiar"
            onClick={() => {
              onChange("");
              setSuggestions([]);
            }}
            className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-xl font-bold leading-none text-rimec-azul hover:bg-rimec-celeste-bg"
          >
            ×
          </button>
        ) : null}

        {open && (suggestions.length > 0 || loading) ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-report-rule bg-white py-1 shadow-lg"
          >
            {loading && !suggestions.length ? (
              <li className="px-4 py-2 text-xs text-report-muted">Buscando…</li>
            ) : null}
            {suggestions.map((codigo) => (
              <li key={codigo}>
                <button
                  type="button"
                  role="option"
                  aria-selected={value === codigo}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(codigo)}
                  className="w-full px-4 py-2 text-left font-mono text-sm hover:bg-rimec-celeste-bg/40"
                >
                  {codigo}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </label>
  );
}
