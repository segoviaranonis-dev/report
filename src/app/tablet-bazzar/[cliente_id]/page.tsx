"use client";

import { Suspense, use } from "react";
import { notFound } from "next/navigation";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { CajaSubNav, type CajaMod } from "@/components/caja-bazzar/CajaSubNav";
import { TicketsPanel } from "@/components/caja-bazzar/TicketsPanel";
import { EmpaquePanel } from "@/components/caja-bazzar/EmpaquePanel";
import { getCajaTienda, isCajaClienteId } from "@/lib/caja-bazzar/tiendas";

function CajaTiendaInner({ clienteId, mod }: { clienteId: number; mod: CajaMod }) {
  const tienda = getCajaTienda(clienteId);
  if (!tienda) notFound();

  return (
    <div className="min-h-screen bg-app-bg">
      <NexusGlobalHeader active="tablet-bazzar" title={`Caja ${tienda.label}`} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Suspense fallback={<div className="h-32 animate-pulse rounded-2xl bg-slate-200" />}>
          <CajaSubNav clienteId={clienteId} label={tienda.label} />
        </Suspense>
        {mod === "empaque" ? (
          <EmpaquePanel clienteId={clienteId} modoCronometro />
        ) : (
          <TicketsPanel clienteId={clienteId} modo={mod} />
        )}
      </main>
    </div>
  );
}

function parseMod(raw: string | null): CajaMod {
  if (raw === "facturable" || raw === "metricas" || raw === "empaque") return raw;
  return "operativa";
}

export default function CajaTiendaPage({
  params,
  searchParams,
}: {
  params: Promise<{ cliente_id: string }>;
  searchParams: Promise<{ mod?: string }>;
}) {
  const { cliente_id: raw } = use(params);
  const sp = use(searchParams);
  const clienteId = Number(raw);

  if (!isCajaClienteId(clienteId)) notFound();

  const mod = parseMod(sp.mod ?? null);

  return (
    <Suspense fallback={<p className="p-10 text-center text-neutral-muted">Cargando caja…</p>}>
      <CajaTiendaInner clienteId={clienteId} mod={mod} />
    </Suspense>
  );
}
