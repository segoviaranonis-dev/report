"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";

type DepositoEstado = {
  cliente_id: number;
  ente: string;
  tipo: string;
  registros: number;
};

/** Report = administrador. El POS (fotos, stock, tickets) vive en tablet-bazzar. */
export default function TabletBazzarPage() {
  const [depositos, setDepositos] = useState<DepositoEstado[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/depositos/sync", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setDepositos(data.depositos ?? []))
      .finally(() => setLoading(false));
  }, []);

  const conStock = depositos.filter((d) => d.registros > 0);

  return (
    <div className="min-h-screen bg-app-bg">
      <NexusGlobalHeader active="tablet-bazzar" title="Tablet Bazzar" />

      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="mb-2 font-serif text-4xl font-light text-neutral-ink">📱 Tablet Bazzar — Monitoreo</h1>
        <p className="mb-8 max-w-2xl text-neutral-muted">
          Este módulo en Report solo administra y audita. Los vendedores operan en la PWA{" "}
          <strong className="text-bazzar-naranja">tablet-bazzar</strong> (repo y deploy separados).
        </p>

        <div className="mb-8 rounded-2xl border-2 border-bazzar-naranja/30 bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-bazzar-naranja">App ejecutora (POS)</p>
          <a
            href="https://tablet-bazzar.vercel.app/deposito"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-lg font-bold text-bazzar-text-dark hover:text-bazzar-naranja"
          >
            tablet-bazzar.vercel.app/deposito →
          </a>
          <p className="mt-2 text-sm text-neutral-muted">Local: http://localhost:3002/deposito</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 font-semibold text-neutral-ink">Estado depósitos (sync desde Report)</h2>
          {loading ? (
            <p className="text-neutral-muted">Cargando…</p>
          ) : conStock.length === 0 ? (
            <p className="text-neutral-muted">
              Sin stock sincronizado.{" "}
              <Link href="/depositos-bazzar" className="font-semibold text-bazzar-naranja hover:underline">
                Depósitos Bazzar → Sincronizar
              </Link>
            </p>
          ) : (
            <ul className="space-y-2">
              {conStock.map((d) => (
                <li key={d.cliente_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-bazzar-naranja/5 px-4 py-3">
                  <span className="font-medium">
                    {d.ente} {d.tipo} <span className="text-neutral-muted">({d.cliente_id})</span>
                  </span>
                  <span className="text-sm font-semibold text-bazzar-naranja">{d.registros.toLocaleString()} SKUs</span>
                  <Link
                    href={`/depositos-bazzar/${d.cliente_id}`}
                    className="text-sm font-semibold text-bazzar-naranja hover:underline"
                  >
                    Admin depósito
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
