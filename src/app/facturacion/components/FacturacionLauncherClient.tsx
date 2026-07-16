"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CAJA_RIMEC_HOME } from "@/lib/auth/caja-rimec";

const CARDS = [
  {
    href: "/facturacion/transito",
    title: "Facturación de proceso",
    lead: "Factura interna en tránsito · Compra Legal · distribución sucursales y cliente 5000.",
    badge: "PROCESO_PP",
    icon: "📦",
    border: "border-rimec-azul/30 hover:border-rimec-azul",
    bg: "hover:bg-rimec-celeste-bg/50",
    caja: false,
  },
  {
    href: "/facturacion/pronta-entrega",
    title: "Facturación Pronta entrega",
    lead: "Ventas PE agrupadas por fecha · enlazadas a pedido_proveedor_detalle · traspaso web.",
    badge: "STOCK_IMPORTADO · PPD",
    icon: "⚡",
    border: "border-orange-300 hover:border-orange-600",
    bg: "hover:bg-orange-50/80",
    caja: true,
  },
] as const;

export function FacturacionLauncherClient() {
  const router = useRouter();
  const [soloCaja, setSoloCaja] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        const cat = String(data?.user?.role ?? data?.user?.categoria ?? "")
          .toUpperCase()
          .trim();
        const rol = Number(data?.user?.rol_id);
        if (!cancelled && rol === 1 && cat === "CAJA") {
          setSoloCaja(true);
          router.replace(CAJA_RIMEC_HOME);
          return;
        }
      } catch {
        /* ignore */
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready || soloCaja) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-neutral-600">
        Redirigiendo a Pronta Entrega…
      </div>
    );
  }

  const cards = CARDS.filter((c) => !soloCaja || c.caja);

  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col justify-center px-6 py-12">
        <Link href="/" className="text-sm font-semibold text-rimec-azul hover:underline">
          ← Inicio Report
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-rimec-azul/70">
          2.3.1.9 · RIMEC
        </p>
        <h1 className="mt-2 font-serif text-3xl text-rimec-azul-dark">Facturación</h1>
        <p className="mt-2 text-sm text-neutral-700">
          Dos circuitos · mismo término canónico: <strong>Factura interna (FI)</strong> · una sola tabla{" "}
          <code className="text-xs">factura_interna</code> en RIMEC.
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {cards.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className={`group flex min-h-[190px] flex-col rounded-2xl border-2 bg-white p-6 shadow-sm transition-all ${c.border} ${c.bg}`}
            >
              <span className="text-3xl">{c.icon}</span>
              <p className="mt-4 text-xs font-bold uppercase tracking-wide text-neutral-500">{c.badge}</p>
              <h2 className="mt-1 text-lg font-bold text-rimec-azul-dark group-hover:text-rimec-azul">{c.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-snug text-neutral-600">{c.lead}</p>
              <span className="mt-4 text-sm font-semibold text-rimec-azul">Entrar →</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
