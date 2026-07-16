"use client";

import { useCallback, useEffect, useState } from "react";

type Props = {
  batchLabel: string;
  onCadenaChange?: (cadena: string | null) => void;
};

type FiltroWeb = {
  batch_label: string;
  cadena_comercial: string | null;
  pulse_liquidacion: boolean;
};

/**
 * Control Report → parámetro filtro RIMEC Web (LIQUIDACIÓN).
 * Persiste en pe_catalogo_filtro_web.
 */
export function PeComercialWebFiltroBar({ batchLabel, onCadenaChange }: Props) {
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
      onCadenaChange?.(j.filtro?.cadena_comercial ?? null);
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
      onCadenaChange?.(cadena);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const activa = String(filtro?.cadena_comercial ?? "").toUpperCase() === "LIQUIDACION";

  return (
    <div className="rounded-xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/80 to-white px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
          Filtro Web · catálogo PE
        </span>
        <button
          type="button"
          disabled={loading || saving}
          onClick={() => void guardar(activa ? null : "LIQUIDACION")}
          className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
            activa
              ? "catalog-card-liquidacion-pulse border-emerald-600 bg-emerald-600 text-white"
              : "border-emerald-300 bg-white text-emerald-800 hover:border-emerald-500"
          }`}
        >
          {activa ? "LIQUIDACIÓN activa en Web" : "Activar LIQUIDACIÓN en Web"}
        </button>
        {loading ? (
          <span className="text-[10px] text-slate-500">…</span>
        ) : activa ? (
          <span className="text-[10px] font-semibold text-emerald-700">
            Latido verde · 1.35s · solo artículos LIQUIDACIÓN
          </span>
        ) : (
          <span className="text-[10px] text-slate-500">Sin filtro comercial en catálogo Web</span>
        )}
      </div>
      {err ? <p className="mt-1 text-[10px] font-semibold text-red-600">{err}</p> : null}
    </div>
  );
}
