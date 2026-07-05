"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { IcCatalogos } from "@/lib/intencion-compra/ic-catalogos-types";
import type { IcPendienteRow } from "@/lib/intencion-compra/pendientes-query";
import { FECHA_DE_EMBARQUE_LABEL } from "@/lib/intencion-compra/quincena-arribo";
import { INTENCION_COMPRA_NUEVA } from "@/lib/report/routes";
import { Skeleton } from "@/components/ui/LoadingState";
import { IcPendienteCard } from "./IcPendienteCard";

export function IcPendientesPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ics, setIcs] = useState<IcPendienteRow[]>([]);
  const [catalogos, setCatalogos] = useState<IcCatalogos | null>(null);
  const [quincenaLookup, setQuincenaLookup] = useState<Record<number, string>>({});
  const [stats, setStats] = useState({ pares: 0, neto: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/proceso-importacion/intencion-compra/pendientes", {
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar");
      setIcs(data.ics ?? []);
      setCatalogos(data.catalogos ?? null);
      setQuincenaLookup(data.quincena_lookup ?? {});
      setStats(data.stats ?? { pares: 0, neto: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-4 py-4">
        <Skeleton className="h-24 w-full" count={3} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
    );
  }

  if (!catalogos) return null;

  return (
    <div className="mt-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-xs uppercase text-slate-500">Pendientes</span>
            <p className="font-serif text-2xl font-bold text-rimec-azul-dark">{ics.length}</p>
          </div>
          <div>
            <span className="text-xs uppercase text-slate-500">Pares</span>
            <p className="font-serif text-2xl font-bold text-rimec-azul-dark">{stats.pares.toLocaleString("es-PY")}</p>
          </div>
          <div>
            <span className="text-xs uppercase text-slate-500">Neto</span>
            <p className="font-serif text-2xl font-bold text-rimec-azul-dark">
              Gs. {stats.neto.toLocaleString("es-PY")}
            </p>
          </div>
        </div>
        <Link
          href={INTENCION_COMPRA_NUEVA}
          className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
        >
          + Nueva Intención
        </Link>
      </div>

      <p className="mb-3 text-xs text-slate-600">
        Paridad Streamlit PENDIENTES · {FECHA_DE_EMBARQUE_LABEL} = slider 0–24 →{" "}
        <code className="text-[10px]">quincena_arribo_id</code> · tabla <code className="text-[10px]">quincena_arribo</code>
      </p>

      {ics.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-12 text-center text-slate-500">
          No hay IC pendientes
        </p>
      ) : (
        <div className="space-y-4">
          {ics.map((ic) => (
            <IcPendienteCard
              key={ic.id}
              ic={ic}
              catalogos={catalogos}
              quincenaLookup={quincenaLookup}
              onUpdated={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}
