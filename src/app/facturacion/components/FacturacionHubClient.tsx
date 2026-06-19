"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CompraWebFiPanel } from "@/app/bazzar-web/compra/components/CompraWebFiPanel";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import { TRP_ESTADO_COLOR, TRP_ESTADO_LABEL } from "@/lib/rimec-abastecimiento/constants";
import type { FacturaKpis, FacturaListItem } from "@/lib/facturacion/types";
import type { FiDetalleCanonico, FiRegistroRow } from "@/lib/bazzar-web/compra-web/types";
import { FACTURACION } from "@/lib/report/routes";

export function FacturacionHubClient() {
  const [facturas, setFacturas] = useState<FacturaListItem[]>([]);
  const [kpis, setKpis] = useState<FacturaKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [fiDetail, setFiDetail] = useState<{
    fi: FiRegistroRow;
    detalles: FiDetalleCanonico[];
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/facturacion");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      if (data.configured === false) {
        setConfigured(false);
        return;
      }
      setConfigured(true);
      setFacturas(data.facturas ?? []);
      setKpis(data.kpis ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function loadFiDetail(facturaLegacy: string) {
    setExpanded(facturaLegacy);
    setFiDetail(null);
    try {
      const res = await fetch(`/api/facturacion/${encodeURIComponent(facturaLegacy)}`);
      const data = await res.json();
      if (res.ok && data.fi) {
        setFiDetail({ fi: data.fi, detalles: data.detalles ?? [] });
      }
    } catch {
      /* opcional */
    }
  }

  async function enviarWeb(f: FacturaListItem) {
    if (!confirm(`¿Enviar ${f.factura} a Web Bazar (cliente 5000)?`)) return;
    setEnviando(f.factura_legacy);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/facturacion/${encodeURIComponent(f.factura_legacy)}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setSuccess(data.message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setEnviando(null);
    }
  }

  const puedeEnviar = (estado: string) =>
    estado === "SIN_TRASPASO" || estado === "BORRADOR";

  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusGlobalHeader active="facturacion" />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Link href="/" className="text-sm font-semibold text-rimec-azul hover:underline">
          ← Inicio Report
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-rimec-azul/70">
          2.3.1.9 · RIMEC
        </p>
        <h1 className="mt-2 font-serif text-3xl text-rimec-azul-dark">Facturación</h1>
        <p className="mt-2 max-w-2xl text-neutral-700">
          FAC-INT en tránsito · distribución a sucursales y cliente 5000. Ley FI + protocolo imágenes.
        </p>

        {!configured && (
          <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            DATABASE_URL no configurada.
          </p>
        )}

        {kpis && (
          <div className="mt-6 grid gap-3 sm:grid-cols-5">
            {[
              { l: "Total FAC", v: kpis.total },
              { l: "Sin traspaso", v: kpis.sin_traspaso },
              { l: "Borrador", v: kpis.borrador },
              { l: "Enviados", v: kpis.enviado },
              { l: "Confirmados", v: kpis.confirmado },
            ].map((k) => (
              <div key={k.l} className="rounded-lg border-2 border-neutral-300 bg-white px-3 py-2">
                <p className="text-[10px] font-bold uppercase text-neutral-500">{k.l}</p>
                <p className="text-xl font-semibold tabular-nums">{k.l === "Total FAC" ? k.v : k.v}</p>
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        )}
        {success && (
          <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {success}
          </p>
        )}

        {loading ? (
          <p className="mt-8 text-neutral-600">Cargando bandeja…</p>
        ) : (
          <div className="mt-8 space-y-4">
            {facturas.map((f) => {
              const badge = TRP_ESTADO_COLOR[f.traspaso_estado] ?? TRP_ESTADO_COLOR.SIN_TRASPASO;
              const isOpen = expanded === f.factura_legacy;
              return (
                <article key={`${f.factura}-${f.pedido}`} className="rounded-xl border-2 border-neutral-300 bg-card-bg overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <div>
                      <p className="font-serif text-lg font-semibold text-rimec-azul-dark">{f.factura}</p>
                      <p className="text-sm text-neutral-600">
                        {f.marca} · {f.cliente} · {f.pares.toLocaleString("es-PY")} pares · CL {f.compra}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="rounded-full px-3 py-1 text-xs font-bold"
                        style={{ backgroundColor: badge.bg, color: badge.fg }}
                      >
                        {TRP_ESTADO_LABEL[f.traspaso_estado] ?? f.traspaso_estado}
                      </span>
                      <button
                        type="button"
                        onClick={() => (isOpen ? setExpanded(null) : loadFiDetail(f.factura_legacy))}
                        className="rounded-lg border border-neutral-400 px-3 py-1.5 text-xs font-semibold hover:bg-neutral-50"
                      >
                        {isOpen ? "Cerrar FI" : "Ver FI card"}
                      </button>
                      {puedeEnviar(f.traspaso_estado) && (
                        <button
                          type="button"
                          disabled={enviando === f.factura_legacy}
                          onClick={() => enviarWeb(f)}
                          className="rounded-lg bg-[#F97316] px-4 py-1.5 text-xs font-bold text-white hover:bg-orange-600 disabled:opacity-50"
                        >
                          {enviando === f.factura_legacy ? "Enviando…" : "Enviar Web Bazar"}
                        </button>
                      )}
                    </div>
                  </div>
                  {isOpen && fiDetail && fiDetail.fi.nro_factura === f.factura_legacy && (
                    <div className="border-t border-neutral-300 p-4">
                      <CompraWebFiPanel fi={fiDetail.fi} detalles={fiDetail.detalles} />
                    </div>
                  )}
                </article>
              );
            })}
            {!facturas.length && configured && (
              <p className="text-neutral-600">
                No hay FAC-INT en compras DISTRIBUIDA/CERRADA. Finalice una compra en{" "}
                <Link href="/compra-legal" className="font-semibold text-rimec-azul underline">
                  Compra legal
                </Link>
                .
              </p>
            )}
          </div>
        )}
      </main>
      <ReportFooter note={`Facturación · ${FACTURACION} · 2.3.1.9`} />
    </div>
  );
}
