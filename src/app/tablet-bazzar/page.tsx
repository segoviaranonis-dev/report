"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";

type HubCard = {
  cliente_id: number;
  label: string;
  ente: string;
  tipo: string;
  deposito_pares: number;
  tickets_pendientes: number;
  pares_vendidos_hoy: number;
};

export default function CajaBazzarHubPage() {
  const [cards, setCards] = useState<HubCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [multi, setMulti] = useState(true);

  const loadHub = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/tablet-bazzar/hub", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setMulti(Boolean(data.multi_tienda));
        setCards(data.tiendas ?? []);
      })
      .catch(() => setError("Error de red"))
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadHub();
  }, [loadHub]);

  return (
    <div className="min-h-screen bg-app-bg">
      <NexusGlobalHeader active="tablet-bazzar" title="Caja Bazzar" />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="mb-2 font-serif text-4xl font-light text-neutral-ink">Caja Bazzar</h1>
            <p className="max-w-2xl text-neutral-muted">
              Módulo cajero · consulta automática de pendientes · Actualizar cajas cuando llegue otro cliente
            </p>
          </div>
          <button
            type="button"
            onClick={loadHub}
            disabled={loading}
            className="rounded-lg bg-bazzar-naranja px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {loading ? "Actualizando…" : "Actualizar cajas"}
          </button>
        </div>

        {multi === false && !loading && cards.length > 0 && (
          <p className="mb-6 text-sm font-semibold text-bazzar-naranja">Acceso restringido a tu tienda asignada</p>
        )}

        {error && <p className="mb-6 text-red-700">{error}</p>}

        {loading ? (
          <p className="text-neutral-muted">Consultando pendientes en base de datos…</p>
        ) : cards.length === 0 ? (
          <p className="text-neutral-muted">
            Sin cajas visibles para tu usuario. Revisá permisos o{" "}
            <button type="button" onClick={loadHub} className="font-semibold text-bazzar-naranja underline">
              reintentar
            </button>
            .
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((c) => (
              <Link
                key={c.cliente_id}
                href={`/tablet-bazzar/${c.cliente_id}?mod=operativa`}
                className="group rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-bazzar-naranja hover:shadow-lg"
              >
                <p className="text-xs font-bold uppercase tracking-wider text-bazzar-naranja">{c.ente}</p>
                <h2 className="mt-1 text-xl font-bold text-neutral-ink group-hover:text-bazzar-naranja">
                  {c.tipo}
                </h2>
                <p className="text-xs text-neutral-muted">ID {c.cliente_id}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-bazzar-naranja px-3 py-1 text-xs font-bold text-white">
                    {Math.round(c.pares_vendidos_hoy)} vendidos hoy
                  </span>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                    {c.tickets_pendientes} pendientes
                  </span>
                </div>
                <p className="mt-3 text-xs text-neutral-muted">
                  Depósito: {Math.round(c.deposito_pares).toLocaleString("es-PY")} pares
                </p>
              </Link>
            ))}
          </div>
        )}

        <p className="mt-10 text-sm text-neutral-muted">
          POS vendedor:{" "}
          <a href="https://tablet-bazzar.vercel.app/cadena" className="font-semibold text-bazzar-naranja hover:underline">
            tablet-bazzar.vercel.app/cadena
          </a>
        </p>
      </main>
    </div>
  );
}
