"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import { Skeleton } from "@/components/ui/LoadingState";
import type {
  PpAlaNorteRow,
  PpDetalleHeader,
  PpFacturaInternaRow,
  PpIcVinculada,
} from "@/lib/pedido-proveedor/detail-query";
import { DIGITACION, INTENCION_COMPRA_BANDEJA, PEDIDO_PROVEEDOR, type PpDetalleTab, pedidoProveedorDetalle } from "@/lib/report/routes";

const ESTADO_STYLE: Record<string, string> = {
  ABIERTO: "bg-amber-100 text-amber-900",
  CERRADO: "bg-sky-100 text-sky-900",
  ENVIADO: "bg-emerald-100 text-emerald-900",
  ANULADO: "bg-slate-200 text-slate-700",
  RESERVADA: "bg-violet-100 text-violet-900",
  CONFIRMADA: "bg-emerald-100 text-emerald-900",
};

const TABS: { id: PpDetalleTab; label: string; icon: string }[] = [
  { id: "ics", label: "ICs Asignadas", icon: "📋" },
  { id: "stock", label: "Importación / Stock", icon: "📦" },
  { id: "fi", label: "Facturas Internas", icon: "🧾" },
];

function parseTab(raw: string | null): PpDetalleTab {
  if (raw === "stock" || raw === "fi") return raw;
  return "ics";
}

type Props = { ppId: string };

export function PedidoProveedorDetalleClient({ ppId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pp, setPp] = useState<PpDetalleHeader | null>(null);
  const [ics, setIcs] = useState<PpIcVinculada[]>([]);
  const [alaNorte, setAlaNorte] = useState<PpAlaNorteRow[]>([]);
  const [facturas, setFacturas] = useState<PpFacturaInternaRow[]>([]);
  const [nroFactura, setNroFactura] = useState("");
  const [cerrando, setCerrando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/proceso-importacion/pedido-proveedor/${ppId}`, {
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "PP no encontrado");
      setPp(data.pp);
      setIcs(data.ics ?? []);
      setAlaNorte(data.alaNorte ?? []);
      setFacturas(data.facturas ?? []);
      setNroFactura(data.pp?.nro_factura_importacion ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [ppId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (pp?.fi_bloqueada && tab === "fi") {
      router.replace(pedidoProveedorDetalle(ppId, "ics"));
    }
  }, [pp?.fi_bloqueada, tab, ppId, router]);

  function setTab(next: PpDetalleTab) {
    router.push(pedidoProveedorDetalle(ppId, next));
  }

  async function cerrarDigitacion() {
    if (!pp) return;
    setCerrando(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/proceso-importacion/pedido-proveedor/${pp.id}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nro_factura_importacion: nroFactura }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cerrar");
      setMsg("Digitación cerrada · factura importación guardada.");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error");
    } finally {
      setCerrando(false);
    }
  }

  async function descargarCsv() {
    if (!pp) return;
    setCsvLoading(true);
    try {
      const res = await fetch(`/api/proceso-importacion/pedido-proveedor/${pp.id}/csv-ventas`, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error CSV");
      }
      const blob = await res.blob();
      const disp = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disp);
      const filename = match?.[1] ?? `${pp.numero_registro}_ventas.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error CSV");
    } finally {
      setCsvLoading(false);
    }
  }

  const digitacionAbierta = pp?.estado_digitacion !== "CERRADO";
  const totalStockPares = useMemo(() => alaNorte.reduce((s, r) => s + r.cantidad_inicial, 0), [alaNorte]);

  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusGlobalHeader active="proceso-importacion" />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Link href={PEDIDO_PROVEEDOR} className="text-sm font-semibold text-rimec-azul hover:underline">
          ← Lista pedidos proveedor
        </Link>

        {loading ? (
          <div className="mt-8 space-y-4">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
        ) : pp ? (
          <>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-rimec-azul/70">2.3.1.7.5 · Detalle PP</p>
                <h1 className="mt-2 font-mono text-3xl font-bold text-rimec-azul-dark">{pp.numero_registro}</h1>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-bold ${ESTADO_STYLE[pp.estado] ?? "bg-slate-100"}`}>
                    {pp.estado}
                  </span>
                  <span className="rounded bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-900">
                    Digitación: {pp.estado_digitacion ?? "ABIERTO"}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center text-sm">
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs uppercase text-slate-500">Pares IC</p>
                  <p className="font-mono text-lg font-bold tabular-nums">{pp.pares_comprometidos.toLocaleString("es-PY")}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs uppercase text-slate-500">Artículos F9</p>
                  <p className="font-mono text-lg font-bold tabular-nums">{pp.total_articulos.toLocaleString("es-PY")}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs uppercase text-slate-500">Saldo</p>
                  <p className="font-mono text-lg font-bold tabular-nums">{pp.saldo.toLocaleString("es-PY")}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xs font-bold uppercase text-slate-500">Cabecera</h2>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-4">
                <div>
                  <dt className="text-xs text-slate-500">Proveedor</dt>
                  <dd>{pp.proveedor}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Marcas</dt>
                  <dd>{pp.marcas}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Cliente</dt>
                  <dd>{pp.cliente}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Vendedor</dt>
                  <dd>{pp.vendedor}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Quincena ETA</dt>
                  <dd>{pp.quincena ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Proforma</dt>
                  <dd className="font-mono text-xs">{pp.numero_proforma ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Factura import.</dt>
                  <dd className="font-mono text-xs">{pp.nro_factura_importacion ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Listado precio</dt>
                  <dd className="text-xs">{pp.listado_precio?.nombre ?? "Sin vincular"}</dd>
                </div>
              </dl>
            </div>

            <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-200 pb-1">
              {TABS.map((t) => {
                const locked = t.id === "fi" && pp.fi_bloqueada;
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={locked}
                    onClick={() => !locked && setTab(t.id)}
                    className={`rounded-t-lg px-4 py-2 text-sm font-bold transition ${
                      locked
                        ? "cursor-not-allowed text-slate-400"
                        : active
                          ? "bg-rimec-azul text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {locked ? "🔒" : t.icon} {t.label}
                  </button>
                );
              })}
              {pp.n_fi_confirmadas > 0 && (
                <button
                  type="button"
                  disabled={csvLoading}
                  onClick={descargarCsv}
                  className="ml-auto rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                >
                  {csvLoading ? "Generando…" : "📄 CSV ventas"}
                </button>
              )}
            </div>

            {tab === "ics" && (
              <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-bold text-rimec-azul-dark">ICs vinculadas ({ics.length})</h2>
                {ics.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">Sin IC en puente · asigná desde Digitación.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {ics.map((ic) => (
                      <li key={ic.ic_id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Link
                            href={INTENCION_COMPRA_BANDEJA}
                            className="font-mono text-xs font-bold text-rimec-azul hover:underline"
                          >
                            {ic.nro_ic}
                          </Link>
                          <span className="text-xs text-slate-600">{ic.pares.toLocaleString("es-PY")} pares</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">
                          {ic.marca} · Nro. fábrica{" "}
                          <span className="font-mono">{ic.nro_pedido_fabrica ?? "—"}</span>
                        </p>
                        {ic.evento_nombre && (
                          <p className="mt-0.5 text-xs text-violet-800">Evento: {ic.evento_nombre}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <Link href={DIGITACION} className="mt-4 inline-block text-xs font-semibold text-rimec-azul hover:underline">
                  + Asignar otra IC en Digitación
                </Link>
              </section>
            )}

            {tab === "stock" && (
              <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-bold text-rimec-azul-dark">Ala Norte · F9 / Proforma</h2>
                  <p className="text-xs text-slate-600">
                    {alaNorte.length} moléculas · {totalStockPares.toLocaleString("es-PY")} pares
                  </p>
                </div>
                {!pp.listado_editable && (
                  <p className="mt-2 text-xs text-amber-800">PP ENVIADO — listado de precios bloqueado.</p>
                )}
                {alaNorte.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">
                    Sin artículos importados. Cargá proforma Excel desde Streamlit (próximo hito: upload en Report).
                  </p>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-2 pr-2">Línea</th>
                          <th className="py-2 pr-2">Ref.</th>
                          <th className="py-2 pr-2">Material</th>
                          <th className="py-2 pr-2">Color</th>
                          <th className="py-2 pr-2">Grada</th>
                          <th className="py-2 pr-2 text-right">Inicial</th>
                          <th className="py-2 pr-2 text-right">Vendido</th>
                          <th className="py-2 text-right">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {alaNorte.map((r) => (
                          <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                            <td className="py-2 pr-2 font-mono">{r.linea}</td>
                            <td className="py-2 pr-2 font-mono">{r.referencia}</td>
                            <td className="py-2 pr-2">{r.material}</td>
                            <td className="py-2 pr-2">{r.color}</td>
                            <td className="py-2 pr-2 font-mono text-slate-600">{r.grada ?? "—"}</td>
                            <td className="py-2 pr-2 text-right tabular-nums">{r.cantidad_inicial.toLocaleString("es-PY")}</td>
                            <td className="py-2 pr-2 text-right tabular-nums">{r.vendido.toLocaleString("es-PY")}</td>
                            <td className="py-2 text-right tabular-nums font-semibold">{r.saldo.toLocaleString("es-PY")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="mt-4 text-xs text-slate-500">
                  Listado RIMEC vinculado: {pp.listado_precio?.nombre ?? "pendiente"} · upload proforma en Report = siguiente entrega.
                </p>
              </section>
            )}

            {tab === "fi" && !pp.fi_bloqueada && (
              <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-bold text-rimec-azul-dark">Ala Sur · Facturas internas ({facturas.length})</h2>
                {facturas.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">
                    Sin FI aún. Creá facturas internas tras import F9 y listado de precios (Streamlit o próximo hito Report).
                  </p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {facturas.map((fi) => (
                      <li key={fi.id} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono text-sm font-bold text-rimec-azul-dark">{fi.nro_factura}</span>
                          <span className={`rounded px-2 py-0.5 text-xs font-bold ${ESTADO_STYLE[fi.estado] ?? "bg-slate-100"}`}>
                            {fi.estado}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">
                          {fi.cliente} · {fi.vendedor}
                        </p>
                        <p className="mt-1 text-xs tabular-nums text-slate-700">
                          {fi.total_pares.toLocaleString("es-PY")} pares · USD{" "}
                          {fi.total_monto.toLocaleString("es-PY", { minimumFractionDigits: 2 })}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {digitacionAbierta && pp.estado !== "ENVIADO" && tab === "ics" && (
              <div className="mt-6 rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-5">
                <h2 className="text-sm font-bold text-emerald-900">Cerrar digitación</h2>
                <p className="mt-1 text-xs text-emerald-800">
                  Obligatorio antes de import F9. Mismo criterio que Digitación → tab En proceso.
                </p>
                <label className="mt-3 block text-xs font-bold uppercase text-slate-600">Nro. factura importación</label>
                <input
                  type="text"
                  className="mt-1 w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  value={nroFactura}
                  onChange={(e) => setNroFactura(e.target.value)}
                  placeholder="Factura proveedor / importación"
                />
                {msg && (
                  <p className={`mt-2 text-sm ${msg.startsWith("Digitación") ? "text-emerald-800" : "text-red-700"}`}>
                    {msg}
                  </p>
                )}
                <button
                  type="button"
                  disabled={cerrando || !nroFactura.trim()}
                  onClick={cerrarDigitacion}
                  className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {cerrando ? "Guardando…" : "Cerrar digitación PP"}
                </button>
              </div>
            )}
          </>
        ) : null}
      </main>
      <ReportFooter note="Pedido proveedor · detalle" />
    </div>
  );
}
