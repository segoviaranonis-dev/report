"use client";

import { useCallback, useEffect, useState } from "react";
import type { IcCatalogos } from "@/lib/intencion-compra/catalogos-query";
import type { IcDevueltaRow } from "@/lib/intencion-compra/pendientes-query";
import { IcPendienteCard } from "./IcPendienteCard";

export function IcDevueltasPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ics, setIcs] = useState<IcDevueltaRow[]>([]);
  const [catalogos, setCatalogos] = useState<IcCatalogos | null>(null);
  const [quincenaLookup, setQuincenaLookup] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/proceso-importacion/intencion-compra/devueltas", { credentials: "same-origin" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setIcs(data.ics ?? []);
      setCatalogos(data.catalogos ?? null);
      setQuincenaLookup(data.quincena_lookup ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="py-8 text-center text-sm text-slate-500">Cargando devueltas…</p>;
  if (error) return <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>;
  if (!catalogos) return null;

  if (ics.length === 0) {
    return (
      <p className="mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-12 text-center text-slate-500">
        No hay ICs devueltas pendientes de revisión.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {ics.map((ic) => (
        <div key={ic.id}>
          <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900">
            <strong>Devuelta por Digitación</strong>
            {ic.devuelto_at ? ` (${ic.devuelto_at})` : ""}: {ic.motivo_devolucion ?? "Sin motivo registrado"}
          </div>
          <IcPendienteCard ic={ic} catalogos={catalogos} quincenaLookup={quincenaLookup} onUpdated={load} />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={async () => {
                const res = await fetch(`/api/proceso-importacion/intencion-compra/${ic.id}/reautorizar`, {
                  method: "POST",
                  credentials: "same-origin",
                });
                const data = await res.json();
                if (!res.ok) alert(data.error);
                else load();
              }}
              className="flex-1 rounded-lg bg-rimec-azul px-4 py-2 text-xs font-bold text-white hover:bg-rimec-azul-dark"
            >
              ↩ Re-autorizar
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!confirm("¿Anular definitivamente esta IC?")) return;
                const res = await fetch(`/api/proceso-importacion/intencion-compra/${ic.id}/anular`, {
                  method: "POST",
                  credentials: "same-origin",
                });
                const data = await res.json();
                if (!res.ok) alert(data.error);
                else load();
              }}
              className="flex-1 rounded-lg border border-slate-400 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              ✗ Anular definitivamente
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
