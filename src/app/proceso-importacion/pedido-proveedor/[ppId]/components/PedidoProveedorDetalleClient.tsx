"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import { Skeleton } from "@/components/ui/LoadingState";
import type { IcCatalogos } from "@/lib/intencion-compra/ic-catalogos-types";
import type {
  PpAlaNorteRow,
  PpDetalleHeader,
  PpFacturaInternaRow,
  PpIcVinculada,
} from "@/lib/pedido-proveedor/detail-query";
import type { EventoPrecioOption, EventoPpDetalle } from "@/lib/pedido-proveedor/stock-listado";
import { DIGITACION, INTENCION_COMPRA_BANDEJA, PEDIDO_PROVEEDOR, type PpDetalleTab, pedidoProveedorDetalle } from "@/lib/report/routes";
import { CATEGORIA_PROGRAMADO_ID } from "@/lib/intencion-compra/categoria-ic";
import {
  FECHA_DE_EMBARQUE_LABEL,
  QUINCENA_ARRIBO_CATALOGO,
  quincenaSliderValue,
} from "@/lib/intencion-compra/quincena-arribo";
import {
  esListadoPrecioValido,
  labelListadoPrecio,
  type ListadoPrecioTierId,
} from "@/lib/intencion-compra/listado-precio-tiers";
import { SelectorPoliticaLp } from "@/app/proceso-importacion/intencion-compra/components/SelectorPoliticaLp";
import { IcProgramadoCabeceraGuide } from "@/app/proceso-importacion/intencion-compra/components/IcProgramadoCabeceraGuide";
import { PpTabStock } from "./PpTabStock";
import { PpTabFacturasInternas } from "./PpTabFacturasInternas";
import type { FiDetalle } from "@/app/aprobaciones/lib/aprobaciones-types";

const QUINCENA_IDS = Array.from({ length: 24 }, (_, i) => i + 1);

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

type IcFormDraft = {
  nro_pedido_fabrica: string;
  pares: number;
  id_marca: number;
  id_vendedor: number;
  id_proveedor: number;
  categoria_id: number | null;
  precio_evento_id: number | null;
  listado_precio_id: ListadoPrecioTierId | null;
};

function icToDraft(ic: PpIcVinculada): IcFormDraft {
  return {
    nro_pedido_fabrica: ic.nro_pedido_fabrica ?? "",
    pares: ic.pares,
    id_marca: ic.id_marca,
    id_vendedor: ic.id_vendedor,
    id_proveedor: ic.id_proveedor,
    categoria_id: ic.categoria_id,
    precio_evento_id: ic.evento_id,
    listado_precio_id: esListadoPrecioValido(ic.listado_precio_id) ? ic.listado_precio_id : null,
  };
}

const selectCls =
  "mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs";
const inputCls = "mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs";

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
  const [detallesPorFi, setDetallesPorFi] = useState<Record<number, FiDetalle[]>>({});
  const [eventoDetalle, setEventoDetalle] = useState<EventoPpDetalle | null>(null);
  const [eventos, setEventos] = useState<EventoPrecioOption[]>([]);
  const [nroFactura, setNroFactura] = useState("");
  const [proforma, setProforma] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [quincenaId, setQuincenaId] = useState(0);
  const [guardandoCabecera, setGuardandoCabecera] = useState(false);
  const [icDrafts, setIcDrafts] = useState<Record<number, IcFormDraft>>({});
  const [catalogos, setCatalogos] = useState<IcCatalogos | null>(null);
  const [icBusy, setIcBusy] = useState<number | null>(null);
  const [cerrando, setCerrando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [csvVentasLoading, setCsvVentasLoading] = useState(false);
  const [csvInicialLoading, setCsvInicialLoading] = useState(false);

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
      setDetallesPorFi(data.detallesPorFi ?? {});
      setEventoDetalle(data.eventoDetalle ?? null);
      setEventos(data.eventos ?? []);
      setNroFactura(data.pp?.nro_factura_importacion ?? "");
      setProforma(data.pp?.numero_proforma ?? "");
      setObservaciones(data.pp?.notas ?? "");
      setQuincenaId(quincenaSliderValue(data.pp?.quincena_arribo_id));
      const drafts: Record<number, IcFormDraft> = {};
      for (const ic of data.ics ?? []) {
        drafts[ic.ic_id] = icToDraft(ic);
      }
      setIcDrafts(drafts);
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
    fetch("/api/proceso-importacion/intencion-compra/catalogos", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setCatalogos(d.catalogos);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (pp?.fi_bloqueada && tab === "fi") {
      router.replace(pedidoProveedorDetalle(ppId, "ics"));
    }
  }, [pp?.fi_bloqueada, tab, ppId, router]);

  function setTab(next: PpDetalleTab) {
    router.push(pedidoProveedorDetalle(ppId, next));
  }

  async function guardarCabecera(partial?: {
    numero_proforma?: string;
    notas?: string;
    quincena_arribo_id?: number;
  }) {
    if (!pp) return;
    setGuardandoCabecera(true);
    setMsg(null);
    try {
      const q = partial?.quincena_arribo_id ?? quincenaId;
      const res = await fetch(`/api/proceso-importacion/pedido-proveedor/${pp.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numero_proforma: partial?.numero_proforma ?? proforma,
          notas: partial?.notas ?? observaciones,
          ...(partial?.quincena_arribo_id !== undefined || q !== quincenaSliderValue(pp.quincena_arribo_id)
            ? { quincena_arribo_id: q }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      setMsg(
        partial?.quincena_arribo_id !== undefined
          ? `Quincena aplicada a todo el lote (${QUINCENA_ARRIBO_CATALOGO[q] ?? q}).`
          : "Cabecera guardada.",
      );
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error");
    } finally {
      setGuardandoCabecera(false);
    }
  }

  async function aplicarQuincenaLote() {
    if (!pp?.cabecera_editable || quincenaId <= 0) {
      setMsg("Elegí una quincena válida (1–24).");
      return;
    }
    const label = QUINCENA_ARRIBO_CATALOGO[quincenaId] ?? `Quincena ${quincenaId}`;
    if (
      !window.confirm(
        `¿Aplicar "${label}" a todo el lote?\n\nActualiza PP + ICs vinculadas + catálogo web (quincena_arribo_id).`,
      )
    ) {
      return;
    }
    await guardarCabecera({ quincena_arribo_id: quincenaId });
  }

  function patchIcDraft(icId: number, patch: Partial<IcFormDraft>) {
    setIcDrafts((d) => {
      const cur = d[icId];
      if (!cur) return d;
      return { ...d, [icId]: { ...cur, ...patch } };
    });
  }

  async function guardarIc(icId: number) {
    if (!pp) return;
    const draft = icDrafts[icId];
    if (!draft) return;
    if (draft.categoria_id === CATEGORIA_PROGRAMADO_ID && !esListadoPrecioValido(draft.listado_precio_id)) {
      setMsg("PROGRAMADO exige elegir política LP antes de guardar.");
      return;
    }
    setIcBusy(icId);
    setMsg(null);
    try {
      const res = await fetch(
        `/api/proceso-importacion/pedido-proveedor/${pp.id}/ic/${icId}`,
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nro_pedido_fabrica: draft.nro_pedido_fabrica,
            cantidad_total_pares: draft.pares,
            id_marca: draft.id_marca,
            id_vendedor: draft.id_vendedor,
            id_proveedor: draft.id_proveedor,
            categoria_id: draft.categoria_id,
            precio_evento_id: draft.precio_evento_id,
            listado_precio_id:
              draft.categoria_id === CATEGORIA_PROGRAMADO_ID ? draft.listado_precio_id : null,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar IC");
      setMsg("IC actualizada.");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error");
    } finally {
      setIcBusy(null);
    }
  }

  async function desasignarIc(icId: number, nroIc: string) {
    if (!pp) return;
    if (!window.confirm(`¿Desasignar ${nroIc} de este PP? La IC vuelve al pool de Digitación.`)) return;
    setIcBusy(icId);
    setMsg(null);
    try {
      const res = await fetch(
        `/api/proceso-importacion/pedido-proveedor/${pp.id}/ic/${icId}`,
        { method: "DELETE", credentials: "same-origin" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al desasignar");
      setMsg(`IC ${data.nro_ic ?? nroIc} devuelta a Digitación.`);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error");
    } finally {
      setIcBusy(null);
    }
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

  async function descargarCsv(endpoint: "csv-ventas" | "csv-inicial", fallback: string) {
    if (!pp) return;
    const setLoading = endpoint === "csv-ventas" ? setCsvVentasLoading : setCsvInicialLoading;
    setLoading(true);
    try {
      const res = await fetch(`/api/proceso-importacion/pedido-proveedor/${pp.id}/${endpoint}`, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error CSV");
      }
      const blob = await res.blob();
      const disp = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disp);
      const filename = match?.[1] ?? fallback;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error CSV");
    } finally {
      setLoading(false);
    }
  }

  const digitacionAbierta = pp?.estado_digitacion !== "CERRADO";

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
                  {pp.web_alzado && (
                    <span className="rounded bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-900">
                      RIMEC Web · tránsito
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center text-sm sm:grid-cols-3 lg:grid-cols-5">
                <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3">
                  <p className="text-xs uppercase text-violet-700">ICs</p>
                  <p className="font-mono text-lg font-bold tabular-nums text-violet-950">
                    {ics.length.toLocaleString("es-PY")}
                  </p>
                </div>
                <div
                  className={`rounded-lg border px-4 py-3 ${
                    pp.categoria_id === CATEGORIA_PROGRAMADO_ID &&
                    ics.length > 0 &&
                    pp.n_facturas_internas !== ics.length
                      ? "border-amber-300 bg-amber-50"
                      : "border-emerald-200 bg-emerald-50"
                  }`}
                >
                  <p
                    className={`text-xs uppercase ${
                      pp.categoria_id === CATEGORIA_PROGRAMADO_ID &&
                      ics.length > 0 &&
                      pp.n_facturas_internas !== ics.length
                        ? "text-amber-800"
                        : "text-emerald-700"
                    }`}
                  >
                    Facturas
                  </p>
                  <p
                    className={`font-mono text-lg font-bold tabular-nums ${
                      pp.categoria_id === CATEGORIA_PROGRAMADO_ID &&
                      ics.length > 0 &&
                      pp.n_facturas_internas !== ics.length
                        ? "text-amber-950"
                        : "text-emerald-950"
                    }`}
                  >
                    {pp.n_facturas_internas.toLocaleString("es-PY")}
                  </p>
                </div>
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xs font-bold uppercase text-slate-500">Cabecera</h2>
                {pp.cabecera_editable && (
                  <button
                    type="button"
                    disabled={guardandoCabecera}
                    onClick={() => guardarCabecera()}
                    className="rounded-lg bg-rimec-azul px-3 py-1 text-xs font-bold text-white hover:bg-rimec-azul-dark disabled:opacity-50"
                  >
                    {guardandoCabecera ? "Guardando…" : "Guardar cabecera"}
                  </button>
                )}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm md:grid-cols-4">
                <div>
                  <dt className="text-xs text-slate-500">Proveedor</dt>
                  <dd>{pp.proveedor}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Marcas</dt>
                  <dd>{pp.marcas}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Categoría</dt>
                  <dd className="font-semibold">{pp.categoria}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Creador</dt>
                  <dd>{pp.creador}</dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="text-xs text-slate-500">{FECHA_DE_EMBARQUE_LABEL}</dt>
                  <dd className="mt-1">
                    {pp.cabecera_editable ? (
                      <div className="flex flex-wrap items-end gap-2">
                        <select
                          className={`${selectCls} min-w-[220px] flex-1`}
                          value={quincenaId}
                          disabled={guardandoCabecera}
                          onChange={(e) => setQuincenaId(Number(e.target.value))}
                        >
                          <option value={0}>— Elegir quincena —</option>
                          {QUINCENA_IDS.map((id) => (
                            <option key={id} value={id}>
                              {QUINCENA_ARRIBO_CATALOGO[id]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={guardandoCabecera || quincenaId <= 0}
                          onClick={() => void aplicarQuincenaLote()}
                          className="rounded-lg border-2 border-amber-500 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                        >
                          {guardandoCabecera ? "Aplicando…" : "Aplicar quincena a todo el lote"}
                        </button>
                      </div>
                    ) : (
                      <span>{pp.quincena ?? "—"}</span>
                    )}
                    {pp.cabecera_editable && (
                      <p className="mt-1 text-[10px] text-slate-500">
                        Retraso/advance: PP + ICs + filtros web · dato duro quincena_arribo_id
                      </p>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Proforma proveedor</dt>
                  <dd>
                    {pp.cabecera_editable ? (
                      <input
                        type="text"
                        className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                        value={proforma}
                        onChange={(e) => setProforma(e.target.value)}
                        onBlur={() => {
                          if (proforma !== (pp.numero_proforma ?? "")) void guardarCabecera({ numero_proforma: proforma });
                        }}
                        placeholder="Nro. proforma del proveedor"
                      />
                    ) : (
                      <span className="font-mono text-xs">{pp.numero_proforma ?? "—"}</span>
                    )}
                  </dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="text-xs text-slate-500">Observaciones</dt>
                  <dd>
                    {pp.cabecera_editable ? (
                      <textarea
                        rows={2}
                        className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                        onBlur={() => {
                          if (observaciones !== (pp.notas ?? "")) void guardarCabecera({ notas: observaciones });
                        }}
                        placeholder="Notas operativas del PP"
                      />
                    ) : (
                      <span className="text-xs">{pp.notas?.trim() || "—"}</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Listado precio</dt>
                  <dd className="text-xs">{pp.listado_precio?.nombre ?? "Sin vincular"}</dd>
                </div>
              </dl>
              {!pp.cabecera_editable && (
                <p className="mt-2 text-xs text-amber-800">PP {pp.estado} — cabecera e ICs en solo lectura.</p>
              )}
              {msg && tab !== "ics" && (
                <p className={`mt-2 text-xs ${msg.includes("guardad") || msg.includes("devuelta") || msg.includes("actualizado") ? "text-emerald-800" : "text-red-700"}`}>
                  {msg}
                </p>
              )}
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
              {(pp.n_fi_confirmadas > 0 ||
                pp.total_articulos > 0 ||
                (pp.categoria_id === CATEGORIA_PROGRAMADO_ID && pp.n_facturas_internas > 0)) && (
                <div className="ml-auto flex flex-wrap gap-2">
                  {(pp.categoria_id === CATEGORIA_PROGRAMADO_ID
                    ? pp.n_facturas_internas > 0
                    : pp.n_fi_confirmadas > 0) && (
                    <button
                      type="button"
                      disabled={csvVentasLoading}
                      onClick={() => descargarCsv("csv-ventas", `${pp.numero_registro}_ventas.csv`)}
                      className="rounded-lg border border-emerald-400 bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-950 hover:bg-emerald-200 disabled:opacity-50"
                    >
                      {csvVentasLoading ? "Generando…" : "📄 CSV ventas"}
                    </button>
                  )}
                  {pp.total_articulos > 0 && (
                    <button
                      type="button"
                      disabled={csvInicialLoading}
                      onClick={() => descargarCsv("csv-inicial", `${pp.numero_registro}_inicial.csv`)}
                      className="rounded-lg border-2 border-cyan-400 bg-cyan-200 px-3 py-1.5 text-xs font-bold text-cyan-950 hover:bg-cyan-300 disabled:opacity-50"
                    >
                      {csvInicialLoading ? "Generando…" : "📋 CSV inicial"}
                    </button>
                  )}
                </div>
              )}
            </div>

            {tab === "ics" && (
              <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-bold text-rimec-azul-dark">ICs vinculadas ({ics.length})</h2>
                {pp.categoria_id === CATEGORIA_PROGRAMADO_ID && (
                  <div className="mt-3">
                    <IcProgramadoCabeceraGuide compact />
                  </div>
                )}
                {pp.cabecera_editable && (
                  <p className="mt-2 text-xs text-slate-600">
                    Cabecera FI · editá SHOP/LP/vendedor/plazo mientras el PP no esté ENVIADO · al cierre → CSV Carlos.
                  </p>
                )}
                {ics.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">Sin IC en puente · asigná desde Digitación.</p>
                ) : (
                  <ul className="mt-3 space-y-4">
                    {ics.map((ic) => {
                      const draft = icDrafts[ic.ic_id] ?? icToDraft(ic);
                      const editable = pp.cabecera_editable && !!catalogos;
                      return (
                        <li key={ic.ic_id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link
                                href={INTENCION_COMPRA_BANDEJA}
                                className="font-mono text-xs font-bold text-rimec-azul hover:underline"
                              >
                                {ic.nro_ic}
                              </Link>
                              {ic.categoria_id === CATEGORIA_PROGRAMADO_ID && (
                                <span className="rounded border border-violet-200 bg-violet-50 px-2 py-0.5 font-mono text-[10px] font-bold text-violet-900">
                                  SHOP {ic.id_cliente} · {ic.cliente}
                                </span>
                              )}
                            </div>
                            {!editable && (
                              <span className="text-xs text-slate-600">
                                {ic.pares.toLocaleString("es-PY")} pares · {ic.marca} · {ic.vendedor}
                              </span>
                            )}
                          </div>
                          {editable ? (
                            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                              {draft.categoria_id === CATEGORIA_PROGRAMADO_ID && (
                                <div className="sm:col-span-2 lg:col-span-3 rounded-lg border border-sky-200 bg-sky-50/50 px-3 py-2">
                                  <p className="text-[10px] font-bold uppercase tracking-wide text-rimec-azul">
                                    SHOP · proforma col. J
                                  </p>
                                  <p className="font-mono text-sm font-bold text-slate-900">
                                    {ic.id_cliente} — {ic.cliente}
                                  </p>
                                  <p className="text-[10px] text-slate-500">id_cliente en BD · empareja filas Excel al importar</p>
                                </div>
                              )}
                              {draft.categoria_id === CATEGORIA_PROGRAMADO_ID && (
                                <div className="sm:col-span-2 lg:col-span-3">
                                  <SelectorPoliticaLp
                                    required
                                    disabled={icBusy === ic.ic_id}
                                    value={draft.listado_precio_id}
                                    onChange={(id) => patchIcDraft(ic.ic_id, { listado_precio_id: id })}
                                    hint={`Cabecera FI · CSV col. LISTA · actual ${labelListadoPrecio(draft.listado_precio_id)}`}
                                  />
                                </div>
                              )}
                              <label className="text-xs">
                                <span className="font-semibold text-slate-500">Marca</span>
                                <select
                                  className={selectCls}
                                  value={draft.id_marca}
                                  onChange={(e) => patchIcDraft(ic.ic_id, { id_marca: Number(e.target.value) })}
                                >
                                  {catalogos!.marcas.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="text-xs">
                                <span className="font-semibold text-slate-500">
                                  {draft.categoria_id === CATEGORIA_PROGRAMADO_ID ? "Vendedor → CSV" : "Vendedor"}
                                </span>
                                <select
                                  className={selectCls}
                                  value={draft.id_vendedor}
                                  onChange={(e) => patchIcDraft(ic.ic_id, { id_vendedor: Number(e.target.value) })}
                                >
                                  {catalogos!.vendedores.map((v) => (
                                    <option key={v.id} value={v.id}>
                                      {v.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="text-xs">
                                <span className="font-semibold text-slate-500">Proveedor</span>
                                <select
                                  className={selectCls}
                                  value={draft.id_proveedor}
                                  onChange={(e) => patchIcDraft(ic.ic_id, { id_proveedor: Number(e.target.value) })}
                                >
                                  {catalogos!.proveedores.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="text-xs">
                                <span className="font-semibold text-slate-500">Categoría</span>
                                <select
                                  className={selectCls}
                                  value={draft.categoria_id ?? ""}
                                  onChange={(e) => {
                                    const cat = e.target.value ? Number(e.target.value) : null;
                                    patchIcDraft(ic.ic_id, {
                                      categoria_id: cat,
                                      listado_precio_id:
                                        cat === CATEGORIA_PROGRAMADO_ID ? draft.listado_precio_id : null,
                                    });
                                  }}
                                >
                                  <option value="">—</option>
                                  {catalogos!.categorias.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="text-xs">
                                <span className="font-semibold text-slate-500">Pares</span>
                                <input
                                  type="number"
                                  min={1}
                                  className={`${inputCls} font-mono tabular-nums`}
                                  value={draft.pares}
                                  onChange={(e) =>
                                    patchIcDraft(ic.ic_id, { pares: Math.max(0, Number(e.target.value) || 0) })
                                  }
                                />
                              </label>
                              <label className="text-xs">
                                <span className="font-semibold text-slate-500">Nro. pedido fábrica</span>
                                <input
                                  type="text"
                                  className={`${inputCls} font-mono`}
                                  value={draft.nro_pedido_fabrica}
                                  onChange={(e) => patchIcDraft(ic.ic_id, { nro_pedido_fabrica: e.target.value })}
                                />
                              </label>
                              <label className="text-xs sm:col-span-2 lg:col-span-3">
                                <span className="font-semibold text-slate-500">Listado / evento precio</span>
                                <select
                                  className={selectCls}
                                  value={draft.precio_evento_id ?? ""}
                                  onChange={(e) =>
                                    patchIcDraft(ic.ic_id, {
                                      precio_evento_id: e.target.value ? Number(e.target.value) : null,
                                    })
                                  }
                                >
                                  {catalogos!.eventos.map((ev) => (
                                    <option key={String(ev.id)} value={ev.id ?? ""}>
                                      {ev.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          ) : (
                            <div className="mt-2 space-y-1 text-xs text-slate-600">
                              <p>
                                {ic.marca} · {ic.vendedor} · {ic.proveedor}
                              </p>
                              <p>{ic.pares.toLocaleString("es-PY")} pares · {ic.categoria}</p>
                              {ic.categoria_id === CATEGORIA_PROGRAMADO_ID && (
                                <>
                                  <p className="font-mono font-semibold text-rimec-azul">
                                    SHOP {ic.id_cliente} · {ic.cliente}
                                  </p>
                                  <p className="font-semibold text-violet-800">
                                    LP IC: {labelListadoPrecio(ic.listado_precio_id)} → CSV LISTA
                                  </p>
                                </>
                              )}
                              <p className="font-mono">Nro. fábrica: {ic.nro_pedido_fabrica ?? "—"}</p>
                              {ic.evento_nombre && <p className="text-violet-800">Evento: {ic.evento_nombre}</p>}
                            </div>
                          )}
                          {pp.cabecera_editable && (
                            <div className="mt-3 flex flex-wrap items-start gap-2">
                              <button
                                type="button"
                                disabled={
                                  icBusy === ic.ic_id
                                  || !catalogos
                                  || (draft.categoria_id === CATEGORIA_PROGRAMADO_ID
                                    && !esListadoPrecioValido(draft.listado_precio_id))
                                }
                                onClick={() => guardarIc(ic.ic_id)}
                                className="rounded border border-rimec-azul/30 bg-white px-3 py-1 text-xs font-bold text-rimec-azul hover:bg-sky-50 disabled:opacity-50"
                              >
                                {icBusy === ic.ic_id ? "Guardando…" : "Guardar IC"}
                              </button>
                              <button
                                type="button"
                                disabled={icBusy === ic.ic_id}
                                onClick={() => desasignarIc(ic.ic_id, ic.nro_ic)}
                                className="rounded border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-800 hover:bg-red-100 disabled:opacity-50"
                              >
                                Devolver a Digitación
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                <Link href={DIGITACION} className="mt-4 inline-block text-xs font-semibold text-rimec-azul hover:underline">
                  + Asignar otra IC en Digitación
                </Link>
              </section>
            )}

            {tab === "stock" && (
              <PpTabStock
                pp={pp}
                ppId={ppId}
                alaNorte={alaNorte}
                eventoDetalle={eventoDetalle}
                eventos={eventos}
                onReload={load}
                onMsg={setMsg}
              />
            )}

            {tab === "fi" && !pp.fi_bloqueada && (
              <>
                <PpTabFacturasInternas
                  pp={pp}
                  ppId={ppId}
                  facturas={facturas}
                  detallesPorFi={detallesPorFi}
                  onReload={load}
                  onMsg={setMsg}
                />
                {msg && tab === "fi" && (
                  <p className={`mt-2 text-xs ${msg.includes("recalculada") || msg.includes("LP") ? "text-emerald-800" : "text-red-700"}`}>
                    {msg}
                  </p>
                )}
              </>
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
