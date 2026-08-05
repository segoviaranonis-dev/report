"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui";
import {
  COMPRA_WEB_TABS,
  ESTADO_COLOR,
  ESTADO_LABEL,
  type CompraWebTab,
} from "@/lib/bazzar-web/compra-web/constants";import type {
  FacturaLineaLegacy,
  FiDetalleCanonico,
  FiRegistroRow,
  TraspasoDetail,
  TraspasoDetalleLine,
  TraspasoIntegridadPayload,
  TraspasoListItem,
} from "@/lib/bazzar-web/compra-web/types";
import { CompraWebFiPanel } from "./CompraWebFiPanel";
import { Tabla5PilaresLegacy } from "./Tabla5PilaresLegacy";
import { buildControlCantidades } from "@/lib/bazzar-web/compra-web/control-cantidades";

const WEB_NAVY = "#1E3A5F";
const WEB_ORANGE = "#F97316";

type Metricas = { total: number; enviados: number; confirmados: number; borradores: number };
type DetallePayload = {
  detail: TraspasoDetail;
  lineas: TraspasoDetalleLine[];
  integridad: TraspasoIntegridadPayload;
  fi: FiRegistroRow | null;
  fiDetalles: FiDetalleCanonico[];
  legacyLineas: FacturaLineaLegacy[];
};

export function CompraWebClient() {
  const [tab, setTab] = useState<CompraWebTab>("pendientes");
  const [traspasosAll, setTraspasosAll] = useState<TraspasoListItem[]>([]);  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<DetallePayload | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [confirmandoId, setConfirmandoId] = useState<number | null>(null);
  const [resyncingId, setResyncingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tecnicaAbierta, setTecnicaAbierta] = useState(false);
  const [configured, setConfigured] = useState(true);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const res = await fetch("/api/bazzar-web/compra/traspasos");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar traspasos");
      if (data.configured === false) {
        setConfigured(false);
        setTraspasosAll([]);
        return;
      }
      setConfigured(true);
      const list: TraspasoListItem[] = data.traspasos ?? [];
      setTraspasosAll(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoadingList(false);
    }
  }, []);

  const metricas = useMemo<Metricas>(() => {
    return {
      total: traspasosAll.length,
      enviados: traspasosAll.filter((t) => t.estado === "ENVIADO").length,
      confirmados: traspasosAll.filter((t) => t.estado === "CONFIRMADO").length,
      borradores: traspasosAll.filter((t) => t.estado === "BORRADOR").length,
    };
  }, [traspasosAll]);

  const tabCounts: Record<CompraWebTab, number> = useMemo(
    () => ({
      pendientes: metricas.enviados,
      transito: metricas.borradores,
      confirmados: metricas.confirmados,
    }),
    [metricas],
  );

  const estadoTab = COMPRA_WEB_TABS.find((t) => t.id === tab)?.estado ?? "ENVIADO";
  const traspasos = useMemo(
    () => traspasosAll.filter((t) => t.estado === estadoTab),
    [traspasosAll, estadoTab],
  );
  const loadDetail = useCallback(async (id: number) => {
    setLoadingDetail(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/bazzar-web/compra/traspasos/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar detalle");
      setDetalle({
        detail: data.detail,
        lineas: data.lineas ?? [],
        integridad: data.integridad ?? { fi_pares: 0, td_pares: 0, delta: 0, ok: true },
        fi: data.fi,
        fiDetalles: data.fiDetalles ?? [],
        legacyLineas: data.legacyLineas ?? [],
      });
      setSelectedId(id);
      setTecnicaAbierta(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  async function resyncGradas(id: number) {
    setResyncingId(id);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/bazzar-web/compra/traspasos/${id}/resync`, {
        method: "POST",
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Resync falló");
      setSuccess(
        `Gradas resincronizadas (${id}): ${data.paresAntes} → ${data.paresDespues} p (FI ${data.fiPares}).`,
      );
      if (selectedId === id) await loadDetail(id);
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al resincronizar");
    } finally {
      setResyncingId(null);
    }
  }

  async function confirmarRecepcion(id: number) {
    const trp = traspasosAll.find((t) => t.id === id);
    const pares = trp?.fi_pares || trp?.pares_detalle || 0;
    const ok = window.confirm(
      `¿Confirmar recepción de ${trp?.numero_registro ?? id}?\n` +
        `${pares.toLocaleString("es-PY")} pares → ingreso ALM_WEB + Stock Sano + tienda.`,
    );
    if (!ok) return;

    setConfirmandoId(id);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/bazzar-web/compra/traspasos/${id}/confirmar`, {
        method: "POST",
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "No se pudo confirmar");
      setSuccess(data.message);
      if (selectedId === id) {
        setSelectedId(null);
        setDetalle(null);
      }
      setTab("confirmados");
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al confirmar");
    } finally {
      setConfirmandoId(null);
    }
  }

  const puedeConfirmar =
    detalle?.detail.estado === "ENVIADO" || detalle?.detail.estado === "BORRADOR";

  function volverLista() {
    setSelectedId(null);
    setDetalle(null);
    setSuccess(null);
    setError(null);
  }

  return (
    <>
      {/* Flujo operativo — paridad Aprobaciones */}
      <section className="border-b border-neutral-300 bg-white py-4">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-2 text-sm text-neutral-700">
            <p>
              <strong className="text-rimec-azul-dark">Flujo:</strong> Facturación RIMEC envía traspaso{" "}
              <code className="rounded bg-neutral-100 px-1 text-xs">ENVIADO</code> →{" "}
              <strong>Pendientes</strong> (confirmar recepción) → ingreso ALM_WEB_01 +{" "}
              <strong>Stock Sano</strong> automático → tienda <strong>bazzar-web</strong> vendible.
            </p>
            <p className="text-xs text-neutral-600">
              Publicar precios WEB (opcional):{" "}
              <Link href="/bazzar-web/motor-precio" className="font-semibold text-rimec-azul hover:underline">
                Motor de precio
              </Link>
              {" · "}
              Ver stock:{" "}
              <Link href="/bazzar-web/deposito-web" className="font-semibold text-rimec-azul hover:underline">
                Depósito Web
              </Link>
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {selectedId && (
              <Button variant="secondary" size="sm" onClick={volverLista}>
                ← Bandeja
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => void loadList()} disabled={loadingList}>
              {loadingList ? "Refrescando…" : "Refrescar"}
            </Button>
          </div>
        </div>
      </section>

      {!selectedId && (
        <section className="border-b-2 border-rimec-azul bg-app-bg py-3">
          <div className="mx-auto flex max-w-6xl flex-wrap gap-2 px-6">
            {COMPRA_WEB_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  tab === t.id
                    ? "bg-rimec-azul text-white shadow"
                    : "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {t.icon} {t.label}
                <span className="ml-1.5 tabular-nums opacity-80">({tabCounts[t.id]})</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="mx-auto max-w-6xl px-6 py-6">
        {!configured && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            DATABASE_URL no configurada en el servidor.
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {success}
          </div>
        )}

        {loadingDetail && <p className="text-sm text-slate-500">Cargando detalle…</p>}

        {detalle && !loadingDetail ? (
          <DetalleView
            payload={detalle}
            puedeConfirmar={puedeConfirmar}
            confirmando={confirmandoId === selectedId}
            resyncing={resyncingId === selectedId}
            tecnicaAbierta={tecnicaAbierta}
            onToggleTecnica={() => setTecnicaAbierta((v) => !v)}
            onConfirmar={() => selectedId && void confirmarRecepcion(selectedId)}
            onResync={() => selectedId && void resyncGradas(selectedId)}
          />
        ) : !selectedId ? (
          <ListaView
            tab={tab}
            traspasos={traspasos}
            metricas={metricas}
            loading={loadingList}
            confirmandoId={confirmandoId}
            resyncingId={resyncingId}
            onSelect={loadDetail}
            onConfirmar={(id) => void confirmarRecepcion(id)}
            onResync={(id) => void resyncGradas(id)}
          />
        ) : null}
      </div>
    </>
  );
}
function ListaView({
  tab,
  traspasos,
  metricas,
  loading,
  confirmandoId,
  resyncingId,
  onSelect,
  onConfirmar,
  onResync,
}: {
  tab: CompraWebTab;
  traspasos: TraspasoListItem[];
  metricas: Metricas;
  loading: boolean;
  confirmandoId: number | null;
  resyncingId: number | null;
  onSelect: (id: number) => void;
  onConfirmar: (id: number) => void;
  onResync: (id: number) => void;
}) {
  if (loading) return <p className="text-sm text-slate-500">Cargando traspasos…</p>;

  const tabMeta = COMPRA_WEB_TABS.find((t) => t.id === tab)!;

  if (!traspasos.length) {
    return (
      <div className="rounded-lg border-2 border-dashed border-neutral-300 bg-white px-6 py-10 text-center">
        <p className="font-serif text-lg text-rimec-azul-dark">
          Sin traspasos en <strong>{tabMeta.label}</strong>
        </p>
        <p className="mt-2 text-sm text-neutral-600">
          {tab === "pendientes"
            ? "Cuando Facturación envíe a Web Bazar (cliente 5000), aparecen aquí para confirmar recepción."
            : tab === "confirmados"
              ? "Los confirmados ya ingresaron stock al Depósito Web y aplicaron Stock Sano."
              : "Traspasos en borrador antes del envío desde Facturación."}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricBox label="Total bandeja" value={metricas.total} />
        <MetricBox label="Pendientes" value={metricas.enviados} accent={WEB_ORANGE} />
        <MetricBox label="En tránsito" value={metricas.borradores} />
        <MetricBox label="Confirmados" value={metricas.confirmados} accent="#22C55E" />
      </div>

      <div className="space-y-3">
        {traspasos.map((trp) => {
          const eCol = ESTADO_COLOR[trp.estado] ?? "#94A3B8";
          const eLab = ESTADO_LABEL[trp.estado] ?? trp.estado;
          const borderClass =
            trp.estado === "ENVIADO"
              ? "border-amber-500/60"
              : trp.estado === "CONFIRMADO"
                ? "border-emerald-500/50"
                : "border-neutral-300";

          const puedeConfirmarCard =
            trp.estado === "ENVIADO" || trp.estado === "BORRADOR";
          const busy = confirmandoId === trp.id || resyncingId === trp.id;
          const paresFi = trp.fi_pares;
          const paresTd = trp.pares_detalle;
          const delta = paresFi > 0 ? paresFi - paresTd : 0;

          return (
            <article
              key={trp.id}
              className={`rounded-lg border-2 bg-white shadow-sm ${borderClass}`}
            >
              <div className="px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-rimec-azul">
                      Traspaso · {eLab}
                    </p>
                    <p className="font-serif text-lg font-semibold text-rimec-azul-dark">
                      {trp.numero_registro}
                    </p>
                    <p className="mt-1 text-sm text-neutral-600">
                      FAC: <strong>{trp.factura}</strong> · Compra: {trp.compra}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">{trp.fecha_traspaso ?? "—"}</p>
                  </div>
                  <span
                    className="self-start rounded-md px-2.5 py-1 text-[11px] font-black uppercase tracking-wide"
                    style={{ backgroundColor: `${eCol}22`, color: eCol }}
                  >
                    {eLab}
                  </span>
                </div>

                {paresFi > 0 && (
                  <div
                    className={`mt-3 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      trp.integridad_ok
                        ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                        : "border-red-300 bg-red-50 text-red-950"
                    }`}
                  >
                    <span className="font-bold uppercase text-[10px] tracking-wide">
                      Integridad calzado
                    </span>
                    <span className="tabular-nums">
                      FI <strong>{paresFi.toLocaleString("es-PY")}</strong> p
                      {" · "}
                      Detalle <strong>{paresTd.toLocaleString("es-PY")}</strong> p
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-black ${
                        trp.integridad_ok ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                      }`}
                    >
                      {trp.integridad_ok ? "✓ CUADRA" : `✗ Δ ${delta > 0 ? "+" : ""}${delta}`}
                    </span>
                  </div>
                )}

                {puedeConfirmarCard ? (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onConfirmar(trp.id)}
                      className="flex-1 rounded-lg px-5 py-3.5 text-sm font-black uppercase tracking-wide text-white shadow-md transition hover:brightness-110 disabled:opacity-50"
                      style={{ backgroundColor: WEB_ORANGE }}
                    >
                      {confirmandoId === trp.id
                        ? "Procesando ingreso…"
                        : `Confirmar recepción · ${(paresFi || paresTd).toLocaleString("es-PY")} p`}
                    </button>
                    {!trp.integridad_ok && paresFi > 0 && (
                      <Button
                        variant="secondary"
                        size="md"
                        disabled={busy}
                        onClick={() => onResync(trp.id)}
                      >
                        {resyncingId === trp.id ? "Resync…" : "Resync gradas"}
                      </Button>
                    )}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => onSelect(trp.id)}
                  className="mt-3 text-xs font-semibold text-rimec-azul hover:underline"
                >
                  Ver detalle FI / tallas (opcional) →
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function MetricBox({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">{label}</p>
      <p
        className="text-xl font-semibold tabular-nums"
        style={{ color: accent ?? WEB_NAVY }}
      >
        {value}
      </p>
    </div>
  );
}
function DetalleView({
  payload,
  puedeConfirmar,
  confirmando,
  resyncing,
  tecnicaAbierta,
  onToggleTecnica,
  onConfirmar,
  onResync,
}: {
  payload: DetallePayload;
  puedeConfirmar: boolean;
  confirmando: boolean;
  resyncing: boolean;
  tecnicaAbierta: boolean;
  onToggleTecnica: () => void;
  onConfirmar: () => void;
  onResync: () => void;
}) {
  const { detail, lineas, integridad, fi, fiDetalles, legacyLineas } = payload;
  const eCol = ESTADO_COLOR[detail.estado] ?? "#94A3B8";
  const eLab = ESTADO_LABEL[detail.estado] ?? detail.estado;
  const docRef = detail.factura !== "—" ? detail.factura : "";
  const control = buildControlCantidades({ fi, fiDetalles, lineas, legacyLineas });
  const sumLineas = control.distribuidas;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-xl font-semibold" style={{ color: WEB_NAVY }}>
          {detail.numero_registro}
        </h2>
        <p className="text-sm text-slate-600">
          FAC: <strong>{detail.factura}</strong> · Compra: <strong>{detail.compra}</strong> ·{" "}
          <strong style={{ color: eCol }}>{eLab}</strong>
        </p>
      </div>

      {!integridad.ok && integridad.fi_pares > 0 && (
        <div className="rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p className="font-semibold">Integridad pares — revisar antes de confirmar</p>
          <p className="mt-1">
            Factura FI: <strong>{integridad.fi_pares}</strong> p · Vista técnica:{" "}
            <strong>{integridad.td_pares || sumLineas}</strong> p · Delta:{" "}
            <strong>{integridad.delta}</strong>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={resyncing || confirmando}
              onClick={onResync}
              className="rounded-lg border border-red-400 bg-white px-4 py-2 text-xs font-semibold text-red-800 disabled:opacity-60"
            >
              {resyncing ? "Resincronizando…" : "Resincronizar gradas desde FI"}
            </button>
          </div>
          <p className="mt-2 text-xs text-red-800">
            La confirmación también intenta resync automático. Si persiste el delta, se bloquea (no se
            pierden activos).
          </p>
        </div>
      )}

      {integridad.ok && integridad.fi_pares > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">
          Integridad OK — {integridad.fi_pares} pares coinciden con la factura.
        </div>
      )}

      {puedeConfirmar ? (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center">
          <button
            type="button"
            disabled={confirmando || !control.ok}
            onClick={onConfirmar}
            className="rounded-lg px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
            style={{ backgroundColor: WEB_ORANGE }}
          >
            {confirmando ? "Procesando…" : "Confirmar recepción"}
          </button>
          <p className="text-xs text-slate-600">
            {!control.ok
              ? "Confirmación bloqueada hasta que recibidas = distribuidas. Usá resync si hace falta."
              : "Al confirmar, el sistema registra el ingreso en ALM_WEB_01 y el stock queda disponible en la galería de la tienda."}
          </p>
        </div>
      ) : detail.estado === "CONFIRMADO" ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <p className="font-semibold">Recepción confirmada — stock en Depósito Web</p>
          <p className="mt-1 text-xs text-green-900">
            Stock Sano + precios WEB se aplicaron al confirmar. La tienda{" "}
            <strong>bazzar-web</strong> muestra artículos con estado SANO en{" "}
            <code className="text-[10px]">v_stock_web</code>. Opcional: republicar en{" "}
            <Link href="/bazzar-web/motor-precio" className="font-semibold underline">
              Motor de precio
            </Link>
            .
          </p>
        </div>
      ) : null}
      {docRef ? (
        fi ? (
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">
              Factura Interna
            </h3>
            <CompraWebFiPanel fi={fi} detalles={fiDetalles} />
          </div>
        ) : (
          <div>
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Factura Interna <strong>{docRef}</strong> no encontrada en BD (legacy).
            </div>
            {legacyLineas.length > 0 && (
              <>
                <h3 className="mb-2 text-sm font-semibold">Vista Legacy (5 Pilares)</h3>
                <Tabla5PilaresLegacy lineas={legacyLineas} />
              </>
            )}
          </div>
        )
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Sin documento_ref vinculado (traspaso sin FAC-INT).
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div
          className={`flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 ${
            control.ok ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
          }`}
        >
          <p className="text-xs font-bold uppercase tracking-wide text-slate-700">
            Control cantidades
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm tabular-nums">
            <span>
              Recibidas (FI):{" "}
              <strong className="text-base" style={{ color: WEB_NAVY }}>
                {control.recibidas.toLocaleString("es-PY")}
              </strong>
            </span>
            <span>
              Distribuidas (tallas):{" "}
              <strong className="text-base" style={{ color: WEB_NAVY }}>
                {control.distribuidas.toLocaleString("es-PY")}
              </strong>
            </span>
            <span
              className={`rounded-full px-3 py-0.5 text-xs font-bold ${
                control.ok ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
              }`}
            >
              {control.ok
                ? "✓ CUADRA"
                : `✗ DELTA ${control.delta > 0 ? "+" : ""}${control.delta}`}
            </span>
          </div>
        </div>

        {!control.ok && control.skus.some((s) => !s.ok) && (
          <div className="border-b border-red-100 bg-red-50/60 px-4 py-3">
            <p className="mb-2 text-xs font-semibold text-red-900">Detalle por artículo</p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="text-left uppercase text-red-800/80">
                  <tr>
                    <th className="py-1 pr-2">Línea</th>
                    <th className="py-1 pr-2">Ref.</th>
                    <th className="py-1 pr-2 text-right">Rec.</th>
                    <th className="py-1 pr-2 text-right">Dist.</th>
                    <th className="py-1 pr-2 text-right">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {control.skus
                    .filter((s) => !s.ok)
                    .map((s) => (
                      <tr key={`${s.linea}-${s.referencia}-${s.material}`} className="text-red-900">
                        <td className="py-0.5 pr-2">{s.linea}</td>
                        <td className="py-0.5 pr-2">{s.referencia}</td>
                        <td className="py-0.5 pr-2 text-right tabular-nums">{s.recibidas}</td>
                        <td className="py-0.5 pr-2 text-right tabular-nums">{s.distribuidas}</td>
                        <td className="py-0.5 pr-2 text-right font-bold tabular-nums">
                          {s.delta > 0 ? "+" : ""}
                          {s.delta}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onToggleTecnica}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-800"
        >
          Vista técnica: Stock por talla ({lineas.length} línea(s))
          <span>{tecnicaAbierta ? "▲" : "▼"}</span>
        </button>
        {tecnicaAbierta && (
          <div className="border-t border-slate-200 px-4 py-3">
            {!lineas.length ? (
              <>
                <p className="text-sm text-slate-500">
                  Líneas aún no resueltas (combinacion_id pendiente).
                </p>
                {Object.keys(detail.snapshot).length > 0 && (
                  <pre className="mt-2 overflow-x-auto rounded bg-slate-50 p-3 text-xs">
                    {JSON.stringify(detail.snapshot, null, 2)}
                  </pre>
                )}
              </>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-1 pr-3">Línea</th>
                      <th className="py-1 pr-3">Ref.</th>
                      <th className="py-1 pr-3">Material</th>
                      <th className="py-1 pr-3">Color</th>
                      <th className="py-1 pr-3">Talla</th>
                      <th className="py-1 pr-3 text-right">Pares</th>
                      <th className="py-1 pr-3">Caso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineas.map((ln, i) => (
                      <tr key={`${ln.id ?? i}-${ln.talla}`} className="border-t border-slate-100">
                        <td className="py-1 pr-3">{ln.linea}</td>
                        <td className="py-1 pr-3">{ln.referencia}</td>
                        <td className="py-1 pr-3">{ln.material}</td>
                        <td className="py-1 pr-3">{ln.color}</td>
                        <td className="py-1 pr-3">{ln.talla}</td>
                        <td className="py-1 pr-3 text-right tabular-nums">{ln.cantidad}</td>
                        <td className="py-1 pr-3">{ln.caso_nombre}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                      <td colSpan={5} className="py-2 pr-3 text-right text-xs uppercase text-slate-600">
                        Total distribuidas
                      </td>
                      <td
                        className={`py-2 pr-3 text-right tabular-nums ${
                          control.ok ? "text-emerald-800" : "text-red-700"
                        }`}
                      >
                        {control.distribuidas.toLocaleString("es-PY")}
                      </td>
                      <td className="py-2 pr-3 text-xs text-slate-500">
                        FI {control.recibidas.toLocaleString("es-PY")} p
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
