"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import {
  ESTADO_COLOR,
  ESTADO_FILTER_OPTIONS,
  ESTADO_LABEL,
  type EstadoFilter,
} from "@/lib/bazzar-web/compra-web/constants";
import type {
  FacturaLineaLegacy,
  FiDetalleCanonico,
  FiRegistroRow,
  TraspasoDetail,
  TraspasoDetalleLine,
  TraspasoListItem,
} from "@/lib/bazzar-web/compra-web/types";
import { CompraWebFiPanel } from "./CompraWebFiPanel";
import { Tabla5PilaresLegacy } from "./Tabla5PilaresLegacy";

const WEB_NAVY = "#1E3A5F";
const WEB_ORANGE = "#F97316";

type Metricas = { total: number; enviados: number; confirmados: number };

type DetallePayload = {
  detail: TraspasoDetail;
  lineas: TraspasoDetalleLine[];
  fi: FiRegistroRow | null;
  fiDetalles: FiDetalleCanonico[];
  legacyLineas: FacturaLineaLegacy[];
};

export function CompraWebClient() {
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>("TODOS");
  const [traspasos, setTraspasos] = useState<TraspasoListItem[]>([]);
  const [metricas, setMetricas] = useState<Metricas>({ total: 0, enviados: 0, confirmados: 0 });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<DetallePayload | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tecnicaAbierta, setTecnicaAbierta] = useState(false);
  const [configured, setConfigured] = useState(true);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const q = estadoFilter === "TODOS" ? "" : `?estado=${estadoFilter}`;
      const res = await fetch(`/api/bazzar-web/compra/traspasos${q}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar traspasos");
      if (data.configured === false) {
        setConfigured(false);
        setTraspasos([]);
        return;
      }
      setConfigured(true);
      setTraspasos(data.traspasos ?? []);
      setMetricas(data.metricas ?? { total: 0, enviados: 0, confirmados: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoadingList(false);
    }
  }, [estadoFilter]);

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

  async function confirmarRecepcion() {
    if (!selectedId || !detalle) return;
    setConfirmando(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/bazzar-web/compra/traspasos/${selectedId}/confirmar`, {
        method: "POST",
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "No se pudo confirmar");
      setSuccess(data.message);
      setSelectedId(null);
      setDetalle(null);
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al confirmar");
    } finally {
      setConfirmando(false);
    }
  }

  const puedeConfirmar =
    detalle?.detail.estado === "ENVIADO" || detalle?.detail.estado === "BORRADOR";

  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusGlobalHeader maxWidthClass="max-w-6xl" />

      <div className="mx-auto flex max-w-6xl gap-6 px-6 py-8">
        {/* Sidebar — gemelo sidebar.py */}
        <aside className="hidden w-44 shrink-0 lg:block">
          <p
            className="mb-3 text-xs font-bold uppercase tracking-widest"
            style={{ color: WEB_ORANGE }}
          >
            Compra Web
          </p>
          <label className="sr-only" htmlFor="cw-estado">
            Estado
          </label>
          <select
            id="cw-estado"
            value={estadoFilter}
            onChange={(e) => {
              setEstadoFilter(e.target.value as EstadoFilter);
              setSelectedId(null);
              setDetalle(null);
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {ESTADO_FILTER_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          {selectedId && (
            <>
              <hr className="my-4 border-slate-200" />
              <button
                type="button"
                onClick={() => {
                  setSelectedId(null);
                  setDetalle(null);
                  setSuccess(null);
                  setError(null);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
              >
                ← Volver
              </button>
            </>
          )}
        </aside>

        <main className="min-w-0 flex-1">
          <header className="mb-6">
            <Link href="/" className="text-sm text-slate-500 hover:text-slate-800">
              ← Inicio
            </Link>
            <h1 className="mt-2 font-serif text-2xl font-light" style={{ color: WEB_NAVY }}>
              Compra Web
            </h1>
            <p className="text-sm text-slate-600">
              Recepción de mercadería enviada desde Facturación RIMEC · solo cliente{" "}
              <strong>5000</strong> (canal e-commerce)
            </p>
          </header>

          {/* Filtro móvil */}
          <div className="mb-4 lg:hidden">
            <select
              value={estadoFilter}
              onChange={(e) => {
                setEstadoFilter(e.target.value as EstadoFilter);
                setSelectedId(null);
                setDetalle(null);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {ESTADO_FILTER_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

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

          {loadingDetail && (
            <p className="text-sm text-slate-500">Cargando detalle…</p>
          )}

          {detalle && !loadingDetail ? (
            <DetalleView
              payload={detalle}
              puedeConfirmar={puedeConfirmar}
              confirmando={confirmando}
              tecnicaAbierta={tecnicaAbierta}
              onToggleTecnica={() => setTecnicaAbierta((v) => !v)}
              onConfirmar={confirmarRecepcion}
            />
          ) : !selectedId ? (
            <ListaView
              traspasos={traspasos}
              metricas={metricas}
              loading={loadingList}
              onSelect={loadDetail}
            />
          ) : null}
        </main>
      </div>

      <ReportFooter />
    </div>
  );
}

function ListaView({
  traspasos,
  metricas,
  loading,
  onSelect,
}: {
  traspasos: TraspasoListItem[];
  metricas: Metricas;
  loading: boolean;
  onSelect: (id: number) => void;
}) {
  if (loading) return <p className="text-sm text-slate-500">Cargando traspasos…</p>;

  if (!traspasos.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-700">
        <p>No hay traspasos disponibles.</p>
        <p className="mt-2 text-slate-500">
          Los traspasos aparecen cuando Facturación envía a Web Bazar una FAC-INT del cliente{" "}
          <strong>5000</strong> únicamente.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 grid grid-cols-3 gap-4">
        <MetricBox label="Traspasos" value={metricas.total} />
        <MetricBox label="Listos p/ Recibir" value={metricas.enviados} />
        <MetricBox label="Confirmados" value={metricas.confirmados} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {traspasos.map((trp) => {
          const eCol = ESTADO_COLOR[trp.estado] ?? "#94A3B8";
          const eLab = ESTADO_LABEL[trp.estado] ?? trp.estado;
          return (
            <article
              key={trp.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] uppercase text-slate-500">Traspaso</p>
                  <p className="font-bold text-slate-900">{trp.numero_registro}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    FAC: {trp.factura} · Compra: {trp.compra}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded px-2 py-0.5 text-[11px] font-semibold"
                  style={{ backgroundColor: `${eCol}22`, color: eCol }}
                >
                  {eLab}
                </span>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                {trp.pares_detalle.toLocaleString("es-PY")} pares resueltos ·{" "}
                {trp.fecha_traspaso ?? "—"}
              </p>
              <button
                type="button"
                onClick={() => onSelect(trp.id)}
                className="mt-3 w-full rounded-lg px-3 py-2 text-sm font-semibold text-white"
                style={{
                  backgroundColor: trp.estado === "ENVIADO" ? WEB_NAVY : "#64748B",
                }}
              >
                Ver detalle
              </button>
            </article>
          );
        })}
      </div>
    </>
  );
}

function MetricBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-semibold tabular-nums" style={{ color: WEB_NAVY }}>
        {value}
      </p>
    </div>
  );
}

function DetalleView({
  payload,
  puedeConfirmar,
  confirmando,
  tecnicaAbierta,
  onToggleTecnica,
  onConfirmar,
}: {
  payload: DetallePayload;
  puedeConfirmar: boolean;
  confirmando: boolean;
  tecnicaAbierta: boolean;
  onToggleTecnica: () => void;
  onConfirmar: () => void;
}) {
  const { detail, lineas, fi, fiDetalles, legacyLineas } = payload;
  const eCol = ESTADO_COLOR[detail.estado] ?? "#94A3B8";
  const eLab = ESTADO_LABEL[detail.estado] ?? detail.estado;
  const docRef = detail.factura !== "—" ? detail.factura : "";

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

      {puedeConfirmar ? (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center">
          <button
            type="button"
            disabled={confirmando}
            onClick={onConfirmar}
            className="rounded-lg px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
            style={{ backgroundColor: WEB_ORANGE }}
          >
            {confirmando ? "Procesando…" : "Confirmar recepción"}
          </button>
          <p className="text-xs text-slate-600">
            Al confirmar, el sistema registra el ingreso en ALM_WEB_01 y el stock queda disponible
            en la galería de la tienda.
          </p>
        </div>
      ) : detail.estado === "CONFIRMADO" ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Recepción confirmada — stock ingresado al Depósito Web.
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

      <div className="rounded-xl border border-slate-200 bg-white">
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
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
