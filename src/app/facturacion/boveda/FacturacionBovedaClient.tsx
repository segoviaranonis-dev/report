"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CompraWebFiPanel } from "@/app/bazzar-web/compra/components/CompraWebFiPanel";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import { FACTURACION_BOVEDA, FACTURACION_PRONTA_ENTREGA } from "@/lib/report/routes";
import type { BovedaRow } from "@/lib/facturacion/boveda";
import type { FiDetalleCanonico, FiRegistroRow } from "@/lib/bazzar-web/compra-web/types";

function fmtGs(n: number): string {
  return Math.round(n).toLocaleString("es-PY");
}

function fmtFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-PY", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

import { descargarCsvFacturacionPorNro } from "@/lib/facturacion/csv-download-client";

export function FacturacionBovedaClient() {
  const [items, setItems] = useState<BovedaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [fiDetail, setFiDetail] = useState<{
    fi: FiRegistroRow;
    detalles: FiDetalleCanonico[];
  } | null>(null);
  const [fiDetailLoading, setFiDetailLoading] = useState(false);
  const [fiDetailError, setFiDetailError] = useState<string | null>(null);
  const [descargandoCsv, setDescargandoCsv] = useState<string | null>(null);
  const fiDetailReqRef = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/facturacion/boveda?origen=pronta-entrega", {
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 503) {
        setConfigured(false);
        setItems([]);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Error al cargar bóveda");
      setConfigured(true);
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function loadFiDetail(nroFactura: string) {
    const nro = String(nroFactura ?? "").trim();
    const reqId = ++fiDetailReqRef.current;
    setExpanded(nro);
    setFiDetail(null);
    setFiDetailError(null);
    setFiDetailLoading(true);
    try {
      const res = await fetch(`/api/facturacion/${encodeURIComponent(nro)}`, {
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => ({}));
      if (reqId !== fiDetailReqRef.current) return;
      if (!res.ok || !data.fi) {
        setFiDetailError(data.error || `No se pudo cargar el detalle (${res.status})`);
        return;
      }
      setFiDetail({ fi: data.fi, detalles: data.detalles ?? [] });
    } catch (e) {
      if (reqId !== fiDetailReqRef.current) return;
      setFiDetailError(e instanceof Error ? e.message : "Error al cargar detalle");
    } finally {
      if (reqId === fiDetailReqRef.current) setFiDetailLoading(false);
    }
  }

  async function onDescargarCsv(nroFactura: string) {
    setDescargandoCsv(nroFactura);
    setError(null);
    try {
      await descargarCsvFacturacionPorNro(nroFactura);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error CSV");
    } finally {
      setDescargandoCsv(null);
    }
  }

  const puedeCsvPe = (estado: string) => estado === "CONFIRMADA";

  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusGlobalHeader active="facturacion" />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={FACTURACION_PRONTA_ENTREGA}
            className="text-sm font-semibold text-rimec-azul hover:underline"
          >
            ← Facturación Pronta entrega
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-50"
          >
            Refrescar
          </button>
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-slate-600">
          2.3.1.9.B · Bóveda RIMEC
        </p>
        <h1 className="mt-2 font-serif text-3xl text-rimec-azul-dark">Bóveda RIMEC</h1>
        <p className="mt-2 max-w-3xl text-neutral-700">
          Facturas internas de Pronta entrega archivadas desde la bandeja de trabajo. Podés abrir el
          detalle de productos (mismas líneas que en bandeja). Archivar no anula la FI.
        </p>

        {!configured && (
          <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            DATABASE_URL no configurada.
          </p>
        )}
        {error && (
          <p
            className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
              error.includes("NIVEL DIOS")
                ? "border-red-600 bg-red-100 font-semibold text-red-950 whitespace-pre-line"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {error}
          </p>
        )}

        {loading ? (
          <p className="mt-8 text-neutral-600">Cargando bóveda…</p>
        ) : (
          <div className="mt-8 space-y-3">
            {items.map((row) => {
              const isOpen = expanded === row.nro_factura;
              return (
                <article
                  key={row.boveda_id}
                  className="overflow-hidden rounded-xl border-2 border-slate-200 bg-white shadow-sm"
                >
                  <div className="px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Factura interna
                        </p>
                        <p className="font-mono text-lg font-bold text-rimec-azul-dark">
                          {row.factura_display}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">{row.nro_factura}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold uppercase text-slate-500">Archivada</p>
                        <p className="text-sm font-semibold tabular-nums text-slate-800">
                          {fmtFecha(row.archivado_en)}
                        </p>
                        <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700">
                          {row.fi_estado}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-500">Cliente</p>
                        <p className="text-sm font-semibold">
                          {row.cliente} · {row.codigo_cliente}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-500">Marca</p>
                        <p className="text-sm font-semibold">{row.marca}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-500">Vendedor</p>
                        <p className="text-sm font-semibold">{row.vendedor}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-500">Pares · Monto</p>
                        <p className="text-sm font-bold tabular-nums text-emerald-800">
                          {(Number(row.total_pares) || 0).toLocaleString("es-PY")} p · Gs.{" "}
                          {fmtGs(Number(row.total_monto) || 0)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      {puedeCsvPe(row.fi_estado) && (
                        <button
                          type="button"
                          disabled={descargandoCsv === row.nro_factura}
                          onClick={() => void onDescargarCsv(row.nro_factura)}
                          className="rounded-lg border-2 border-rimec-azul bg-rimec-azul/5 px-4 py-2 text-xs font-bold text-rimec-azul-dark hover:bg-rimec-azul/10 disabled:opacity-50"
                        >
                          {descargandoCsv === row.nro_factura ? "Generando…" : "Descargar CSV"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          isOpen ? setExpanded(null) : void loadFiDetail(row.nro_factura)
                        }
                        className="rounded-lg border border-neutral-400 px-3 py-2 text-xs font-semibold hover:bg-neutral-50"
                      >
                        {isOpen ? "Cerrar detalle" : "Ver detalle"}
                      </button>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="border-t border-slate-200 p-4">
                      {fiDetailLoading && (
                        <p className="text-sm text-neutral-600">Cargando detalle…</p>
                      )}
                      {!fiDetailLoading && fiDetailError && (
                        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                          {fiDetailError}
                        </p>
                      )}
                      {!fiDetailLoading &&
                        !fiDetailError &&
                        fiDetail &&
                        String(fiDetail.fi.nro_factura ?? "").trim() ===
                          String(row.nro_factura ?? "").trim() && (
                          <CompraWebFiPanel fi={fiDetail.fi} detalles={fiDetail.detalles} />
                        )}
                    </div>
                  )}
                </article>
              );
            })}
            {!items.length && configured && !error && (
              <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-600">
                Bóveda vacía. Desde{" "}
                <Link
                  href={FACTURACION_PRONTA_ENTREGA}
                  className="font-semibold text-rimec-azul underline"
                >
                  Facturación Pronta entrega
                </Link>{" "}
                usá el botón grande <strong>PROCESAR</strong> en la bandeja PE.
              </p>
            )}
          </div>
        )}
      </main>
      <ReportFooter note={`Bóveda RIMEC · ${FACTURACION_BOVEDA} · MIG-186 · CSV PE desde bóveda`} />
    </div>
  );
}
