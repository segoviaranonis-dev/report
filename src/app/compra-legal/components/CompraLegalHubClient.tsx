"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import { CL_ESTADO_COLOR, CL_ESTADO_LABEL } from "@/lib/rimec-abastecimiento/constants";
import type { CompraLegalListItem } from "@/lib/compra-legal/types";
import { compraLegalDetalle, COMPRA_LEGAL } from "@/lib/report/routes";

export function CompraLegalHubClient() {
  const [compras, setCompras] = useState<CompraLegalListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/compra-legal");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar");
      if (data.configured === false) {
        setConfigured(false);
        setCompras([]);
        return;
      }
      setConfigured(true);
      setCompras(data.compras ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = compras.reduce<Record<string, CompraLegalListItem[]>>((acc, cl) => {
    const key = cl.fecha_factura?.slice(0, 7) ?? "Sin fecha";
    (acc[key] ??= []).push(cl);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusGlobalHeader active="compra-legal" />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Link href="/" className="text-sm font-semibold text-rimec-azul hover:underline">
          ← Inicio Report
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-rimec-azul/70">
          2.3.1.8 · RIMEC
        </p>
        <h1 className="mt-2 font-serif text-3xl text-rimec-azul-dark">Compra legal</h1>
        <p className="mt-2 max-w-2xl text-neutral-700">
          Consolidación PPs · compras legales · traspasos. Paridad{" "}
          <code className="text-sm">compra_legal/ui.py</code>.
        </p>

        {!configured && (
          <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            DATABASE_URL no configurada — configure el pool RIMEC en el servidor.
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        )}

        {loading ? (
          <p className="mt-8 text-neutral-600">Cargando compras legales…</p>
        ) : (
          <div className="mt-8 space-y-8">
            {Object.entries(grouped).map(([mes, items]) => (
              <section key={mes}>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-neutral-500">{mes}</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {items.map((cl) => {
                    const badge = CL_ESTADO_COLOR[cl.estado] ?? { bg: "#F1F5F9", fg: "#475569" };
                    const pct =
                      cl.total_pares > 0
                        ? Math.round(((cl.n_confirmados / Math.max(cl.n_traspasos, 1)) * 100))
                        : 0;
                    return (
                      <Link
                        key={cl.id}
                        href={compraLegalDetalle(cl.id)}
                        className="block rounded-xl border-2 border-neutral-300 bg-card-bg p-5 shadow-sm transition hover:border-rimec-azul/40 hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-serif text-xl font-semibold text-rimec-azul-dark">
                            {cl.numero_registro}
                          </span>
                          <span
                            className="rounded-full px-2.5 py-0.5 text-xs font-bold"
                            style={{ backgroundColor: badge.bg, color: badge.fg }}
                          >
                            {CL_ESTADO_LABEL[cl.estado] ?? cl.estado}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-neutral-600">Proforma: {cl.proforma_referencia}</p>
                        <p className="text-sm text-neutral-600">PPs: {cl.pps_vinculados}</p>
                        <div className="mt-3 flex flex-wrap gap-3 text-sm tabular-nums">
                          <span>
                            <strong>{cl.total_pares.toLocaleString("es-PY")}</strong> pares F9
                          </span>
                          <span>
                            Traspasos: {cl.n_traspasos} · Confirmados: {cl.n_confirmados}
                            {cl.n_traspasos > 0 ? ` (${pct}%)` : ""}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
            {!compras.length && configured && (
              <p className="text-neutral-600">No hay compras legales registradas.</p>
            )}
          </div>
        )}
      </main>
      <ReportFooter note={`Compra legal · ${COMPRA_LEGAL} · 2.3.1.8`} />
    </div>
  );
}
