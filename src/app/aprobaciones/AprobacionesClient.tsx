"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { anularFiAction, rechazarPedidoAction } from "./actions";
import { FiCard } from "./components/FiCard";
import { PedidoPendienteCard } from "./components/PedidoPendienteCard";
import { RechazoModal } from "./components/RechazoModal";
import type {
  AprobacionesCatalogos,
  AprobacionesData,
  FiDetalle,
  FiRecord,
  MensajeFeedback,
  TabAprobaciones,
} from "./lib/aprobaciones-types";

type Props = {
  dataInicial: AprobacionesData;
  catalogos: AprobacionesCatalogos;
};

const TABS: { id: TabAprobaciones; label: string; icon: string }[] = [
  { id: "pendientes", label: "Pendientes", icon: "📋" },
  { id: "aprobados", label: "Aprobados", icon: "✓" },
  { id: "anulados", label: "Anulados", icon: "✗" },
];

export function AprobacionesClient({ dataInicial, catalogos }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<TabAprobaciones>("pendientes");
  const [data, setData] = useState(dataInicial);
  const [detallesPorFi, setDetallesPorFi] = useState(dataInicial.detallesPorFi);
  const [listaLazy, setListaLazy] = useState<FiRecord[]>([]);
  const [cargandoLista, setCargandoLista] = useState(false);

  useEffect(() => {
    setData(dataInicial);
    setDetallesPorFi(dataInicial.detallesPorFi);
    setFisPorPedido(dataInicial.fisPorPedido ?? {});
    const first = dataInicial.pendientes[0]?.id ?? null;
    setPedidoExpandido(first);
  }, [dataInicial]);
  const [mensaje, setMensaje] = useState<MensajeFeedback | null>(null);
  const [procesandoFi, setProcesandoFi] = useState<number | null>(null);
  const [rechazandoPedido, setRechazandoPedido] = useState<number | null>(null);
  const [pedidoExpandido, setPedidoExpandido] = useState<number | null>(
    dataInicial.pendientes[0]?.id ?? null,
  );
  const [fisPorPedido, setFisPorPedido] = useState<Record<number, FiRecord[]>>(
    dataInicial.fisPorPedido ?? {},
  );
  const [cargandoFisPedido, setCargandoFisPedido] = useState<number | null>(null);
  const [modalAnular, setModalAnular] = useState<{ fiId: number; motivo: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const [descargandoCsv, setDescargandoCsv] = useState(false);

  async function descargarCsvGeneral() {
    setDescargandoCsv(true);
    try {
      const res = await fetch("/api/aprobaciones/csv-general");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        flash("error", (err as { error?: string }).error || "Error al generar CSV");
        return;
      }
      const blob = await res.blob();
      const dispo = res.headers.get("Content-Disposition") || "";
      const match = /filename="([^"]+)"/.exec(dispo);
      const filename = match?.[1] || "aprobaciones_csv_general.csv";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      flash("success", "CSV general descargado");
    } catch {
      flash("error", "No se pudo descargar el CSV");
    } finally {
      setDescargandoCsv(false);
    }
  }

  function flash(tipo: MensajeFeedback["tipo"], texto: string) {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje(null), 5000);
  }

  function refrescar() {
    startTransition(() => {
      router.refresh();
    });
  }

  async function cargarFisPedido(pedidoId: number, opts?: { force?: boolean }) {
    if (!opts?.force && fisPorPedido[pedidoId]) return;
    setCargandoFisPedido(pedidoId);
    try {
      const res = await fetch(`/api/aprobaciones/${pedidoId}/facturas`, {
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      if (!res.ok) {
        flash("error", `No se pudieron cargar las FIs (${res.status})`);
        setFisPorPedido((prev) => ({ ...prev, [pedidoId]: [] }));
        return;
      }
      const fis: FiRecord[] = await res.json();
      setFisPorPedido((prev) => ({ ...prev, [pedidoId]: Array.isArray(fis) ? fis : [] }));
    } catch (e) {
      console.error(e);
      flash("error", "Timeout o error al cargar facturas — reintentá expandir");
      setFisPorPedido((prev) => ({ ...prev, [pedidoId]: [] }));
    } finally {
      setCargandoFisPedido(null);
    }
  }

  async function loadDetalle(fiId: number): Promise<FiDetalle[]> {
    const res = await fetch(`/api/aprobaciones/facturas/${fiId}/items`);
    if (!res.ok) return [];
    return res.json();
  }

  useEffect(() => {
    if (tab !== "aprobados" && tab !== "anulados") return;
    let cancelled = false;
    setCargandoLista(true);
    setListaLazy([]);
    void fetch(`/api/aprobaciones/lista?tab=${tab}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const j = (await res.json()) as { fis?: FiRecord[] };
        if (!cancelled) setListaLazy(Array.isArray(j.fis) ? j.fis : []);
      })
      .catch(() => {
        if (!cancelled) flash("error", "No se pudo cargar la lista");
      })
      .finally(() => {
        if (!cancelled) setCargandoLista(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function evictFiDeVistasActivas(fiId: number) {
    setFisPorPedido((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(prev)) {
        const pedidoId = Number(k);
        const filtered = prev[pedidoId].filter((f) => f.id !== fiId);
        if (filtered.length === 0) delete next[pedidoId];
        else next[pedidoId] = filtered;
      }
      return next;
    });
    setListaLazy((prev) => prev.filter((f) => f.id !== fiId));
  }

  async function handleConfirmarFi(fiId: number) {
    setProcesandoFi(fiId);
    // Optimistic: sacar FI de la vista al instante (poder del botón)
    evictFiDeVistasActivas(fiId);
    try {
      const res = await fetch(`/api/aprobaciones/facturas/${fiId}/confirmar`, {
        method: "POST",
        signal: AbortSignal.timeout(25_000),
      });
      const result = (await res.json()) as {
        ok?: boolean;
        msg?: string;
        logistica?: { ok?: boolean; error?: string; pending?: boolean };
      };
      if (res.ok && result.ok) {
        flash("success", result.msg || "FI confirmada");
        window.setTimeout(() => {
          startTransition(() => router.refresh());
        }, 400);
      } else {
        flash("error", result.msg || "Error al confirmar — refrescá");
        startTransition(() => router.refresh());
      }
    } catch {
      flash("error", "No se pudo confirmar — refrescá la página");
      startTransition(() => router.refresh());
    } finally {
      setProcesandoFi(null);
    }
  }

  async function handleAnularConfirmado() {
    if (!modalAnular) return;
    setProcesandoFi(modalAnular.fiId);
    try {
      const result = await anularFiAction(modalAnular.fiId, modalAnular.motivo);
      if (result.success) {
        evictFiDeVistasActivas(modalAnular.fiId);
        setTab("anulados");
        flash("success", result.message || "FI anulada");
        setData((prev) => ({
          ...prev,
          countAnulados: prev.countAnulados + 1,
        }));
        setModalAnular(null);
        refrescar();
      } else {
        flash("error", result.error || "Error al anular");
      }
    } finally {
      setProcesandoFi(null);
    }
  }

  async function handleRechazarPedido(pedidoId: number, motivo: string) {
    setRechazandoPedido(pedidoId);
    try {
      const result = await rechazarPedidoAction(pedidoId, motivo);
      if (result.success) {
        flash("success", result.message || "Pedido rechazado");
        refrescar();
      } else {
        flash("error", result.error || "Error al rechazar");
      }
    } finally {
      setRechazandoPedido(null);
    }
  }

  const counts = {
    pendientes: data.pendientes.length,
    aprobados: data.countAprobados,
    anulados: data.countAnulados,
  };

  return (
    <>
      {/* Flujo + refresh — gemelo Streamlit header */}
      <section className="border-b border-neutral-300 bg-white py-4">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-neutral-700">
            Flujo: <strong>Pendiente</strong> → <strong>Aprobar</strong> célula →{" "}
            <strong>Aprobado</strong> · o <strong>Anulado</strong>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={descargarCsvGeneral}
              disabled={descargandoCsv || isPending}
            >
              {descargandoCsv ? "Generando CSV…" : "📄 CSV general"}
            </Button>
            <Button variant="secondary" size="sm" onClick={refrescar} disabled={isPending}>
              {isPending ? "Refrescando…" : "Refrescar"}
            </Button>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <section className="border-b-2 border-rimec-azul bg-app-bg py-3">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-2 px-6">
          {TABS.map((t) => (
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
              <span className="ml-1.5 tabular-nums opacity-80">({counts[t.id]})</span>
            </button>
          ))}
        </div>
      </section>

      {mensaje && (
        <div className="mx-auto max-w-6xl px-6 pt-4">
          <div
            className={`rounded-lg border-2 p-3 text-sm font-medium ${
              mensaje.tipo === "success"
                ? "border-semantic-success/30 bg-semantic-success/10 text-semantic-success"
                : "border-semantic-error/30 bg-semantic-error/10 text-semantic-error"
            }`}
          >
            {mensaje.texto}
          </div>
        </div>
      )}

      <article className="mx-auto max-w-6xl px-6 py-8">
        {tab === "pendientes" && (
          <>
            {data.pendientes.length === 0 ? (
              <EmptyState icon="📋" text="No hay pedidos pendientes de aprobación." />
            ) : (
              <>
                <p className="mb-4 text-sm text-neutral-600">
                  {data.pendientes.length} pedido(s) esperando autorización
                </p>
                <div className="space-y-4">
                  {data.pendientes.map((p) => (
                    <PedidoPendienteCard
                      key={p.id}
                      pedido={p}
                      catalogos={catalogos}
                      detallesPorFi={detallesPorFi}
                      expandido={pedidoExpandido === p.id}
                      fis={fisPorPedido[p.id] ?? null}
                      cargandoFis={
                        cargandoFisPedido === p.id && fisPorPedido[p.id] == null
                      }
                      procesandoFi={procesandoFi}
                      rechazando={rechazandoPedido === p.id}
                      onExpandir={() => {
                        const next = pedidoExpandido === p.id ? null : p.id;
                        setPedidoExpandido(next);
                        if (next && fisPorPedido[next] == null) void cargarFisPedido(next);
                      }}
                      onConfirmarFi={handleConfirmarFi}
                      onAnularFi={(fiId) => setModalAnular({ fiId, motivo: "" })}
                      onRechazarPedido={handleRechazarPedido}
                      onLoadDetalle={loadDetalle}
                      onFeedback={flash}
                      onEditorApplied={refrescar}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {tab === "aprobados" && (
          <>
            {cargandoLista ? (
              <p className="text-sm text-neutral-600">Cargando aprobados…</p>
            ) : listaLazy.length === 0 ? (
              <EmptyState icon="✓" text="No hay facturas aprobadas aún." />
            ) : (
              <>
                <p className="mb-4 text-sm text-neutral-600">
                  Últimas {listaLazy.length} aprobadas · total {data.countAprobados}
                </p>
                <div className="space-y-4">
                  {listaLazy.map((fi) => (
                    <FiCard
                      key={fi.id}
                      fi={fi}
                      catalogos={catalogos}
                      detalles={detallesPorFi[fi.id]}
                      accionesColapsadas
                      onLoadDetalle={loadDetalle}
                      onFeedback={flash}
                      onEditorApplied={refrescar}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {tab === "anulados" && (
          <>
            {cargandoLista ? (
              <p className="text-sm text-neutral-600">Cargando anulados…</p>
            ) : listaLazy.length === 0 ? (
              <EmptyState icon="✗" text="No hay facturas anuladas." />
            ) : (
              <>
                <p className="mb-4 text-sm text-neutral-600">
                  {listaLazy.length} factura(s) anuladas · total {data.countAnulados}
                </p>
                <div className="space-y-4">
                  {listaLazy.map((fi) => (
                    <FiCard
                      key={fi.id}
                      fi={fi}
                      catalogos={catalogos}
                      detalles={detallesPorFi[fi.id]}
                      onLoadDetalle={loadDetalle}
                      onFeedback={flash}
                      onEditorApplied={refrescar}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </article>

      <RechazoModal
        isOpen={modalAnular !== null}
        motivo={modalAnular?.motivo || ""}
        onClose={() => setModalAnular(null)}
        onConfirm={handleAnularConfirmado}
        onMotivoChange={(motivo) =>
          setModalAnular((prev) => (prev ? { ...prev, motivo } : null))
        }
        loading={procesandoFi === modalAnular?.fiId}
        titulo="Anular FI y reintegrar stock"
        confirmLabel="Sí, anular y reintegrar"
        placeholder="Motivo (obligatorio) — queda en Anulaciones…"
        minLength={1}
      />
    </>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="rounded-lg border-2 border-neutral-300 bg-card-bg p-8 text-center">
      <span className="text-3xl">{icon}</span>
      <p className="mt-2 text-sm text-neutral-700">{text}</p>
    </div>
  );
}
