"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { IcCatalogos } from "@/lib/intencion-compra/ic-catalogos-types";
import type { IcPendienteRow } from "@/lib/intencion-compra/pendientes-query";
import { FECHA_DE_EMBARQUE_LABEL } from "@/lib/intencion-compra/quincena-arribo";
import { INTENCION_COMPRA_NUEVA } from "@/lib/report/routes";
import { Skeleton } from "@/components/ui/LoadingState";
import { IcPendienteCard } from "./IcPendienteCard";
import { fetchIcApiWithRetry, icApiErrorMessage } from "@/lib/intencion-compra/ic-api-fetch";

const EMAXCONN_RETRIES = 4;
const EMAXCONN_WAIT_MS = 8_000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function IcPendientesPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const mountedRef = useRef(true);
  const [ics, setIcs] = useState<IcPendienteRow[]>([]);
  const [catalogos, setCatalogos] = useState<IcCatalogos | null>(null);
  const [quincenaLookup, setQuincenaLookup] = useState<Record<number, string>>({});
  const [stats, setStats] = useState({ pares: 0, neto: 0 });
  const [descargandoCsv, setDescargandoCsv] = useState(false);

  async function descargarCsvProveedor() {
    setDescargandoCsv(true);
    try {
      const res = await fetch("/api/proceso-importacion/intencion-compra/export-csv", {
        credentials: "same-origin",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Error al generar CSV");
      }
      const blob = await res.blob();
      const dispo = res.headers.get("Content-Disposition") || "";
      const match = /filename="([^"]+)"/.exec(dispo);
      const filename = match?.[1] || "ic_pendientes_por_proveedor.csv";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo descargar el CSV");
    } finally {
      setDescargandoCsv(false);
    }
  }

  const removeIc = useCallback((icId: number) => {
    setIcs((prev) => {
      const next = prev.filter((x) => x.id !== icId);
      setStats({
        pares: next.reduce((s, ic) => s + ic.pares, 0),
        neto: next.reduce((s, ic) => s + ic.monto_neto, 0),
      });
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRetrying(false);
    try {
      for (let attempt = 0; attempt < EMAXCONN_RETRIES; attempt++) {
        const res = await fetchIcApiWithRetry("/api/proceso-importacion/intencion-compra/pendientes");
        const data = await res.json();
        if (res.ok) {
          if (!mountedRef.current) return;
          setIcs(data.ics ?? []);
          setCatalogos(data.catalogos ?? null);
          setQuincenaLookup(data.quincena_lookup ?? {});
          setStats(data.stats ?? { pares: 0, neto: 0 });
          return;
        }
        const saturated = res.status === 503 || data.code === "EMAXCONN";
        if (saturated && attempt < EMAXCONN_RETRIES - 1) {
          setRetrying(true);
          await sleep(EMAXCONN_WAIT_MS);
          continue;
        }
        throw new Error(icApiErrorMessage(data, "Error al cargar"));
      }
    } catch (e) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRetrying(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-4 py-4">
        {retrying ? (
          <p className="text-sm text-amber-800">
            Pool Supabase ocupado — reintentando automáticamente…
          </p>
        ) : null}
        <Skeleton className="h-24 w-full" count={3} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 space-y-3">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg bg-rimec-azul px-4 py-2 text-sm font-bold text-white hover:bg-rimec-azul-dark"
        >
          Reintentar ahora
        </button>
      </div>
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
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={descargandoCsv || ics.length === 0}
            onClick={() => void descargarCsvProveedor()}
            className="rounded-lg border-2 border-rimec-azul bg-white px-4 py-2.5 text-sm font-bold text-rimec-azul hover:bg-rimec-azul/5 disabled:opacity-50"
          >
            {descargandoCsv ? "Generando CSV…" : "↓ CSV por proveedor"}
          </button>
          <Link
            href={INTENCION_COMPRA_NUEVA}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
          >
            + Nueva Intención
          </Link>
        </div>
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
              onRemoved={removeIc}
            />
          ))}
        </div>
      )}
    </div>
  );
}
