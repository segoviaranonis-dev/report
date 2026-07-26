"use client";

import { useCallback, useEffect, useState } from "react";
import { PE_DICCIONARIO_FALLBACK } from "@/lib/pe/pe-diccionario";

type Props = {
  batchLabel: string;
  /** Modo dictador · Asignación de descuentos */
  modoAsignacion?: boolean;
  onToggleAsignacion?: () => void;
};

type FiltroWeb = {
  batch_label: string;
  cadena_comercial: string | null;
  pulse_liquidacion: boolean;
};

const CADENAS = PE_DICCIONARIO_FALLBACK.map((c) => ({
  clave: c.cadena_pe,
  label: c.etiqueta_ui,
}));

function pillWebActiva(clave: string): string {
  if (clave === "LIQUIDACION") return "catalog-card-casino-oro border-amber-600 bg-amber-500 text-amber-950";
  if (clave === "PROMOCIONAL") return "catalog-card-casino-fucsia border-fuchsia-600 bg-fuchsia-600 text-white";
  if (clave === "COMUN") return "border-emerald-700 bg-emerald-600 text-white";
  return "border-slate-700 bg-slate-800 text-white";
}

/**
 * Control Report → catálogo RIMEC Web.
 * Habitat del diccionario PE: solo Report escribe pe_catalogo_filtro_web.
 */
export function PeDiccionarioWebControlBar({
  batchLabel,
  modoAsignacion = false,
  onToggleAsignacion,
}: Props) {
  const [filtro, setFiltro] = useState<FiltroWeb | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const q = new URLSearchParams({ batch: batchLabel });
      const res = await fetch(`/api/stock-pronta-entrega/filtro-web-catalogo?${q}`, {
        cache: "no-store",
      });
      const j = (await res.json()) as { ok?: boolean; filtro?: FiltroWeb; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error ?? "Error al leer filtro Web");
      setFiltro(
        j.filtro ?? {
          batch_label: batchLabel,
          cadena_comercial: null,
          pulse_liquidacion: true,
        },
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [batchLabel]);

  useEffect(() => {
    void load();
  }, [load]);

  const guardar = async (cadena: string | null) => {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/stock-pronta-entrega/filtro-web-catalogo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batch: batchLabel,
          cadena_comercial: cadena,
          pulse_liquidacion: true,
        }),
      });
      const j = (await res.json()) as { ok?: boolean; filtro?: FiltroWeb; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error ?? "Error al guardar");
      setFiltro(j.filtro ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const activa = String(filtro?.cadena_comercial ?? "").toUpperCase();

  return (
    <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white px-3 py-2.5 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-800">
            Filtro catálogo RIMEC Web
          </p>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">
            Diccionario PE · pe_catalogo_filtro_web · habitat Report
          </p>
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          <button
            type="button"
            disabled={loading || saving}
            onClick={() => void guardar(null)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase ${
              !activa
                ? "border-slate-700 bg-slate-800 text-white"
                : "border-gray-300 bg-white text-gray-700 hover:border-slate-400"
            }`}
          >
            Todos
          </button>
          {CADENAS.map((c) => (
            <button
              key={c.clave}
              type="button"
              disabled={loading || saving}
              onClick={() => void guardar(activa === c.clave ? null : c.clave)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase ${
                activa === c.clave
                  ? pillWebActiva(c.clave)
                  : "border-gray-300 bg-white text-gray-700 hover:border-slate-400"
              }`}
            >
              {c.label}
            </button>
          ))}
          {onToggleAsignacion ? (
            <button
              type="button"
              onClick={onToggleAsignacion}
              aria-pressed={modoAsignacion}
              className={`rounded border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${
                modoAsignacion
                  ? "border-slate-800 bg-slate-800 text-white"
                  : "border-slate-400 bg-white text-slate-800 hover:bg-slate-50"
              }`}
            >
              {modoAsignacion ? "Asignación ON" : "Asignar descuento"}
            </button>
          ) : null}
        </div>
      </div>
      {err ? <p className="mt-1 text-[10px] font-semibold text-red-600">{err}</p> : null}
    </div>
  );
}
