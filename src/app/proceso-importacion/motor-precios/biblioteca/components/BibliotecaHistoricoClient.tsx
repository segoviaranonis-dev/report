"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import { BIBLIOTECA_CANONICA_LABEL, MOTOR_PROVEEDOR_DEFAULT } from "@/lib/motor-precios/constants";
import type { BibliotecaRow } from "@/lib/motor-precios/queries";
import {
  MOTOR_BIBLIOTECA_NUEVA,
  MOTOR_PRECIOS,
  motorBibliotecaEditor,
} from "@/lib/report/routes";

export function BibliotecaHistoricoClient() {
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bibliotecas, setBibliotecas] = useState<BibliotecaRow[]>([]);
  const [canonica, setCanonica] = useState<BibliotecaRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/motor-precios/biblioteca?proveedor_id=${MOTOR_PROVEEDOR_DEFAULT}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar");
      if (data.configured === false) {
        setConfigured(false);
        setBibliotecas([]);
        return;
      }
      setConfigured(true);
      setBibliotecas(data.bibliotecas ?? []);
      setCanonica(data.canonica ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusGlobalHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Link href={MOTOR_PRECIOS} className="text-sm font-semibold text-rimec-azul hover:underline">
          ← Motor de precios
        </Link>
        <h1 className="mt-4 font-serif text-3xl text-rimec-azul-dark">Histórico de biblioteca de precios</h1>
        <p className="mt-2 text-neutral-700">
          Proveedor <strong>{MOTOR_PROVEEDOR_DEFAULT}</strong> · válida:{" "}
          <strong className="text-rimec-azul">{BIBLIOTECA_CANONICA_LABEL}</strong>
        </p>

        {canonica && (
          <div className="mt-6 rounded-xl border-2 border-emerald-500/40 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <strong>Canónica activa:</strong> #{canonica.id} · {canonica.nombre} · {canonica.casos_count} casos ·{" "}
            {canonica.lineas_count} líneas en matriz
          </div>
        )}

        {!canonica && !loading && configured && (
          <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            No se encontró biblioteca con nombre <strong>1905</strong>. Crear o renombrar en Streamlit/Report.
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        )}

        {!configured && (
          <div className="mt-6 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm">
            DATABASE_URL no configurada en Report.
          </div>
        )}

        <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Casos</th>
                <th className="px-4 py-3">Líneas BCL</th>
                <th className="px-4 py-3">Actualizado</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Cargando…
                  </td>
                </tr>
              ) : bibliotecas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Sin bibliotecas activas
                  </td>
                </tr>
              ) : (
                bibliotecas.map((b) => (
                  <tr
                    key={b.id}
                    className={`border-t border-slate-100 ${b.canonica ? "bg-emerald-50/60" : ""}`}
                  >
                    <td className="px-4 py-3 font-mono">{b.id}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-rimec-azul-dark">{b.nombre}</span>
                      {b.canonica && (
                        <span className="ml-2 rounded bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">
                          CANÓNICA
                        </span>
                      )}
                      {b.descripcion && <p className="mt-0.5 text-xs text-slate-500">{b.descripcion}</p>}
                    </td>
                    <td className="px-4 py-3">{b.casos_count}</td>
                    <td className="px-4 py-3">{b.lineas_count}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(b.updated_at).toLocaleString("es-PY")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={motorBibliotecaEditor(b.id)}
                        className="inline-block rounded-lg bg-rimec-azul px-3 py-1.5 text-xs font-bold text-white hover:bg-rimec-azul-light"
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Link
          href={MOTOR_BIBLIOTECA_NUEVA}
          className="mt-6 inline-block rounded-lg bg-rimec-azul px-4 py-2 text-sm font-semibold text-white hover:bg-rimec-azul-light"
        >
          Crear biblioteca
        </Link>
      </main>
      <ReportFooter note="Histórico biblioteca · motor precios" />
    </div>
  );
}
