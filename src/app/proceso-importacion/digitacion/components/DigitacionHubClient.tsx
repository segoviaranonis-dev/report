"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import { Skeleton } from "@/components/ui/LoadingState";
import type { IcDigitacionPendiente, PpDigitacionQuincenaGrupo, PpEnProceso } from "@/lib/digitacion/bandeja-query";
import { groupPpDigitacionPorQuincena } from "@/lib/digitacion/bandeja-query";
import { FECHA_DE_EMBARQUE_LABEL } from "@/lib/intencion-compra/quincena-arribo";
import { DIGITACION, PROCESO_IMPORTACION, PEDIDO_PROVEEDOR, digitacionAsignar, pedidoProveedorDetalle } from "@/lib/report/routes";

type Vista = "pendientes" | "en_proceso" | "cerrados";

function DevolverModal({
  ic,
  onClose,
  onDone,
}: {
  ic: IcDigitacionPendiente;
  onClose: () => void;
  onDone: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/proceso-importacion/digitacion/devolver/${ic.id}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al devolver");
      onDone();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border-2 border-red-200 bg-white p-6 shadow-xl">
        <h3 className="font-serif text-lg font-semibold text-red-900">Devolver IC</h3>
        <p className="mt-1 text-sm text-slate-600">
          {ic.numero_registro} · {ic.marca}
        </p>
        <label className="mt-4 block text-xs font-bold uppercase text-slate-500">Motivo obligatorio</label>
        <textarea
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          rows={4}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Motivo de devolución a administración…"
        />
        {err && <p className="mt-2 text-sm text-red-700">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy || !motivo.trim()}
            onClick={submit}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? "…" : "← Devolver"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PpExpander({ pp, onRefresh }: { pp: PpEnProceso; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [ics, setIcs] = useState<{ ic_id: number; nro_ic: string; marca: string; proveedor: string; pares: number; nro_pedido_fabrica: string | null }[]>([]);
  const [loadingIcs, setLoadingIcs] = useState(false);
  const [nroFactura, setNroFactura] = useState(pp.nro_factura_importacion ?? "");
  const [cerrando, setCerrando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function loadIcs() {
    setLoadingIcs(true);
    try {
      const res = await fetch(`/api/proceso-importacion/digitacion/pp/${pp.id}`, { credentials: "same-origin" });
      const data = await res.json();
      if (res.ok) setIcs(data.ics ?? []);
    } finally {
      setLoadingIcs(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && ics.length === 0) loadIcs();
  }

  async function cerrar() {
    setCerrando(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/proceso-importacion/digitacion/pp/${pp.id}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nro_factura_importacion: nroFactura }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setMsg("PP cerrado en digitación.");
      onRefresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error");
    } finally {
      setCerrando(false);
    }
  }

  const digCerrado = pp.estado_digitacion === "CERRADO";

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
      >
        <div>
          <span className="font-mono text-sm font-bold text-rimec-azul-dark">{pp.numero_registro}</span>
          <span className="ml-2 text-xs text-slate-500">{pp.marcas}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-600">{pp.n_ics} IC · {pp.pares_comprometidos.toLocaleString("es-PY")} pares</span>
          <span className={`rounded px-2 py-0.5 text-xs font-bold ${digCerrado ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
            {pp.estado_digitacion ?? pp.estado}
          </span>
          <span className="text-slate-400">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 py-3">
          {loadingIcs ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500">
                  <th className="pb-2">IC</th>
                  <th className="pb-2">Marca</th>
                  <th className="pb-2">Proveedor</th>
                  <th className="pb-2">Pares</th>
                  <th className="pb-2">Nro. fábrica</th>
                </tr>
              </thead>
              <tbody>
                {ics.map((ic) => (
                  <tr key={ic.ic_id} className="border-t border-slate-100">
                    <td className="py-2 font-mono text-xs">{ic.nro_ic}</td>
                    <td className="py-2">{ic.marca}</td>
                    <td className="py-2">{ic.proveedor}</td>
                    <td className="py-2">{ic.pares.toLocaleString("es-PY")}</td>
                    <td className="py-2 font-mono text-xs">{ic.nro_pedido_fabrica ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-bold uppercase text-slate-500">Nro. factura importación</label>
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={nroFactura}
                onChange={(e) => setNroFactura(e.target.value)}
                disabled={digCerrado}
              />
            </div>
            {!digCerrado && (
              <button
                type="button"
                disabled={cerrando || !nroFactura.trim()}
                onClick={cerrar}
                className="rounded-lg bg-rimec-azul px-4 py-2 text-sm font-bold text-white hover:bg-rimec-azul-dark disabled:opacity-50"
              >
                {cerrando ? "…" : "Cerrar PP"}
              </button>
            )}
            <Link
              href={pedidoProveedorDetalle(pp.id)}
              className="rounded-lg border border-rimec-azul/30 px-4 py-2 text-sm font-semibold text-rimec-azul hover:bg-rimec-azul/5"
            >
              Detalle PP →
            </Link>
          </div>
          {msg && <p className="mt-2 text-sm text-slate-600">{msg}</p>}
        </div>
      )}
    </div>
  );
}

function PpCerradoRow({ pp }: { pp: PpEnProceso }) {
  return (
    <div className="border-t border-emerald-100 px-4 py-3 hover:bg-emerald-50/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-mono text-sm font-bold text-rimec-azul-dark">{pp.numero_registro}</span>
          <span className="ml-2 text-xs text-slate-600">{pp.marcas}</span>
        </div>
        <span className="rounded bg-emerald-200 px-2 py-0.5 text-xs font-bold text-emerald-900">CERRADO</span>
      </div>
      <p className="mt-2 text-sm">
        Factura importación:{" "}
        <strong className="font-mono">{pp.nro_factura_importacion ?? "—"}</strong> · {pp.n_ics} IC ·{" "}
        {pp.pares_comprometidos.toLocaleString("es-PY")} pares
      </p>
      <Link href={pedidoProveedorDetalle(pp.id)} className="mt-2 inline-block text-xs font-semibold text-rimec-azul hover:underline">
        Abrir detalle PP →
      </Link>
    </div>
  );
}

function QuincenaCerradosExpander({ grupo, defaultOpen }: { grupo: PpDigitacionQuincenaGrupo; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const label = `${grupo.quincena} — ${grupo.n_preventas} preventa${grupo.n_preventas !== 1 ? "s" : ""} · ${grupo.total_pares.toLocaleString("es-PY")} pares`;

  return (
    <div className="overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 bg-emerald-50/80 px-4 py-3.5 text-left hover:bg-emerald-50"
      >
        <span className="text-sm font-semibold text-rimec-azul-dark">
          <span className="mr-2" aria-hidden>
            📅
          </span>
          {label}
        </span>
        <span className="text-slate-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="border-t border-emerald-100">
          {grupo.pps.map((pp) => (
            <PpCerradoRow key={pp.id} pp={pp} />
          ))}
        </div>
      )}
    </div>
  );
}

export function DigitacionHubClient() {
  const [vista, setVista] = useState<Vista>("pendientes");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendientes, setPendientes] = useState<IcDigitacionPendiente[]>([]);
  const [enProceso, setEnProceso] = useState<PpEnProceso[]>([]);
  const [cerrados, setCerrados] = useState<PpEnProceso[]>([]);
  const [devolverIc, setDevolverIc] = useState<IcDigitacionPendiente | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/proceso-importacion/digitacion/bandeja", { credentials: "same-origin" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar bandeja");
      setPendientes(data.pendientes ?? []);
      setEnProceso(data.en_proceso ?? []);
      setCerrados(data.cerrados_digitacion ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const nPend = pendientes.length;
  const gruposCerrados = useMemo(() => groupPpDigitacionPorQuincena(cerrados), [cerrados]);

  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusGlobalHeader active="proceso-importacion" />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Link href={PROCESO_IMPORTACION} className="text-sm font-semibold text-rimec-azul hover:underline">
          ← Ciclo de importación
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-rimec-azul/70">2.3.1.7.4 · P.1.5</p>
        <h1 className="mt-2 font-serif text-3xl text-rimec-azul-dark">Digitación</h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-700">
          Puente IC <code className="text-xs">AUTORIZADO</code> → PP · tabla{" "}
          <code className="text-xs">intencion_compra_pedido</code>
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <div
            className={`rounded-xl border-2 px-5 py-3 ${nPend > 0 ? "border-red-300 bg-red-50" : "border-emerald-300 bg-emerald-50"}`}
          >
            <span className="text-xs font-bold uppercase text-slate-600">ICs pendientes de procesar</span>
            <p className={`font-serif text-3xl font-bold ${nPend > 0 ? "text-red-700" : "text-emerald-700"}`}>{nPend}</p>
          </div>
        </div>

        <div className="mt-6 flex gap-1 border-b border-slate-200">
          {(["pendientes", "en_proceso", "cerrados"] as Vista[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVista(v)}
              className={`px-4 py-2.5 text-sm font-bold uppercase tracking-wide transition ${
                vista === v
                  ? "border-b-2 border-rimec-azul text-rimec-azul"
                  : "text-slate-500 hover:text-rimec-azul-dark"
              }`}
            >
              {v === "pendientes"
                ? `Pendientes (${nPend})`
                : v === "en_proceso"
                  ? `En proceso (${enProceso.length})`
                  : `Cerrados (${cerrados.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-20 w-full" count={4} />
          </div>
        ) : error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
        ) : vista === "pendientes" ? (
          <div className="mt-4">
            {pendientes.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 px-4 py-12 text-center text-slate-500">
                No hay IC autorizadas sin asignar
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-3">IC</th>
                      <th className="px-3 py-3">Marca</th>
                      <th className="px-3 py-3">Categoría</th>
                      <th className="px-3 py-3">{FECHA_DE_EMBARQUE_LABEL}</th>
                      <th className="px-3 py-3">Pares</th>
                      <th className="px-3 py-3">Evento</th>
                      <th className="px-3 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendientes.map((ic) => (
                      <tr key={ic.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                        <td className="px-3 py-3 font-mono text-xs font-bold">{ic.numero_registro}</td>
                        <td className="px-3 py-3">{ic.marca}</td>
                        <td className="px-3 py-3">{ic.categoria}</td>
                        <td className="px-3 py-3 text-xs">{ic.fecha_embarque ?? "—"}</td>
                        <td className="px-3 py-3">{ic.pares.toLocaleString("es-PY")}</td>
                        <td className="px-3 py-3 text-xs text-slate-600">{ic.evento_precio ?? "—"}</td>
                        <td className="px-3 py-3 text-right">
                          <Link
                            href={digitacionAsignar(ic.id)}
                            className="mr-2 inline-block rounded-lg bg-rimec-azul px-3 py-1.5 text-xs font-bold text-white hover:bg-rimec-azul-dark"
                          >
                            Asignar →
                          </Link>
                          <button
                            type="button"
                            onClick={() => setDevolverIc(ic)}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50"
                          >
                            ← Devolver
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : vista === "en_proceso" ? (
          <div className="mt-4 space-y-3">
            {enProceso.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 px-4 py-12 text-center text-slate-500">
                No hay PP abiertos en digitación
              </p>
            ) : (
              enProceso.map((pp) => <PpExpander key={pp.id} pp={pp} onRefresh={load} />)
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-slate-600">
              PP con digitación cerrada (nro. factura importación). No aceptan IC nuevas — ver también{" "}
              <Link href={PEDIDO_PROVEEDOR} className="font-semibold text-rimec-azul hover:underline">
                Pedido proveedor
              </Link>
              .
            </p>
            {cerrados.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 px-4 py-12 text-center text-slate-500">
                No hay PP cerrados en digitación
              </p>
            ) : (
              gruposCerrados.map((g, i) => (
                <QuincenaCerradosExpander key={g.key} grupo={g} defaultOpen={i === 0} />
              ))
            )}
          </div>
        )}
      </main>
      <ReportFooter note="Digitación · 2.3.1.7.4 · bandeja operativa" />

      {devolverIc && (
        <DevolverModal ic={devolverIc} onClose={() => setDevolverIc(null)} onDone={load} />
      )}
    </div>
  );
}
