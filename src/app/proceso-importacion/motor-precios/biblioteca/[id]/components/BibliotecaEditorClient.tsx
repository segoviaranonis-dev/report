"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import type { BibliotecaEditorPayload } from "@/lib/motor-precios/biblioteca-editor";
import { BIBLIOTECA_CANONICA_LABEL } from "@/lib/motor-precios/constants";
import { MOTOR_BIBLIOTECA } from "@/lib/report/routes";
import { CasoPanel, NuevoCasoForm } from "./CasoPanel";
import { LineasLibresPanel } from "./LineasLibresPanel";

export function BibliotecaEditorClient({ bibliotecaId }: { bibliotecaId: number }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BibliotecaEditorPayload | null>(null);
  const [libresOpen, setLibresOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/motor-precios/biblioteca/${bibliotecaId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al cargar");
      if (json.configured === false) throw new Error("DATABASE_URL no configurada");
      setData(json as BibliotecaEditorPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }, [bibliotecaId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusGlobalHeader />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Link href={MOTOR_BIBLIOTECA} className="text-sm font-semibold text-rimec-azul hover:underline">
          ← Histórico de bibliotecas
        </Link>

        {loading && <p className="mt-6 text-slate-500">Cargando biblioteca…</p>}
        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        )}

        {data && (
          <>
            <h1 className="mt-4 font-serif text-3xl text-rimec-azul-dark">
              {data.biblioteca.nombre}
              {data.biblioteca.canonica && (
                <span className="ml-2 align-middle rounded bg-emerald-600 px-2 py-0.5 text-sm font-bold text-white">
                  CANÓNICA
                </span>
              )}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              ID {data.biblioteca.id} · proveedor {data.biblioteca.proveedor_id}
              {data.biblioteca.canonica && (
                <>
                  {" "}
                  · referencia <strong>{BIBLIOTECA_CANONICA_LABEL}</strong>
                </>
              )}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border bg-white p-4 text-center shadow-sm">
                <p className="text-xs uppercase text-slate-500">Líneas pilar</p>
                <p className="text-2xl font-bold text-rimec-azul-dark">{data.resumen.n_pilar.toLocaleString("es-PY")}</p>
              </div>
              <div className="rounded-xl border bg-white p-4 text-center shadow-sm">
                <p className="text-xs uppercase text-slate-500">Asignadas</p>
                <p className="text-2xl font-bold text-rimec-azul-dark">
                  {data.resumen.n_asignadas.toLocaleString("es-PY")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLibresOpen((v) => !v)}
                disabled={data.resumen.n_libres === 0}
                className={`rounded-xl border bg-white p-4 text-center shadow-sm transition hover:border-amber-400 hover:shadow-md disabled:cursor-default disabled:opacity-60 ${
                  libresOpen ? "border-amber-400 ring-2 ring-amber-200" : ""
                }`}
              >
                <p className="text-xs uppercase text-slate-500">Libres</p>
                <p className="text-2xl font-bold text-amber-700">{data.resumen.n_libres.toLocaleString("es-PY")}</p>
                {data.resumen.n_libres > 0 && (
                  <p className="mt-1 text-xs font-semibold text-rimec-azul">{libresOpen ? "▾ Ocultar" : "▸ Asignar"}</p>
                )}
              </button>
            </div>

            <LineasLibresPanel
              bibliotecaId={bibliotecaId}
              casos={data.casos}
              nLibres={data.resumen.n_libres}
              open={libresOpen}
              onClose={() => setLibresOpen(false)}
              onApplied={load}
            />

            <div className="mt-8 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-950">
              <strong>1. Casos comerciales (obligatorio)</strong> — cada caso tiene fórmula de precio + contenedor de
              líneas exclusivo (una línea del pilar solo en un caso por biblioteca).
            </div>

            <div className="mt-6 space-y-3">
              {data.casos.length === 0 ? (
                <p className="text-sm text-amber-800">Biblioteca vacía — creá el primer caso abajo.</p>
              ) : (
                data.casos.map((c, idx) => (
                  <CasoPanel
                    key={`${c.id}-${c.lineas_count}`}
                    bibliotecaId={bibliotecaId}
                    caso={c}
                    defaultOpen={data.casos.length === 1 || idx === 0}
                    onUpdated={load}
                  />
                ))
              )}
            </div>

            <div className="mt-6">
              <NuevoCasoForm bibliotecaId={bibliotecaId} onCreated={load} />
            </div>
          </>
        )}
      </main>
      <ReportFooter note="Editor biblioteca · casos y líneas" />
    </div>
  );
}
