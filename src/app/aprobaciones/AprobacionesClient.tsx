"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { anularFiAction, confirmarFiAction, rechazarPedidoAction } from "./actions";
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
  { id: "reservadas", label: "Reservadas", icon: "⏳" },
  { id: "confirmadas", label: "Confirmadas", icon: "✓" },
  { id: "anuladas", label: "Anuladas", icon: "✗" },
];

export function AprobacionesClient({ dataInicial, catalogos }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<TabAprobaciones>("confirmadas");
  const [data, setData] = useState(dataInicial);
  const [detallesPorFi, setDetallesPorFi] = useState(dataInicial.detallesPorFi);

  useEffect(() => {
    setData(dataInicial);
    setDetallesPorFi(dataInicial.detallesPorFi);
  }, [dataInicial]);
  const [mensaje, setMensaje] = useState<MensajeFeedback | null>(null);
  const [procesandoFi, setProcesandoFi] = useState<number | null>(null);
  const [rechazandoPedido, setRechazandoPedido] = useState<number | null>(null);
  const [pedidoExpandido, setPedidoExpandido] = useState<number | null>(null);
  const [fisPorPedido, setFisPorPedido] = useState<Record<number, FiRecord[]>>({});
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

  async function cargarFisPedido(pedidoId: number) {
    if (fisPorPedido[pedidoId]) return;
    setCargandoFisPedido(pedidoId);
    try {
      const res = await fetch(`/api/aprobaciones/${pedidoId}/facturas`);
      if (res.ok) {
        const fis: FiRecord[] = await res.json();
        setFisPorPedido((prev) => ({ ...prev, [pedidoId]: fis }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCargandoFisPedido(null);
    }
  }

  async function loadDetalle(fiId: number): Promise<FiDetalle[]> {
    const res = await fetch(`/api/aprobaciones/facturas/${fiId}/items`);
    if (!res.ok) return [];
    return res.json();
  }

  async function handleConfirmarFi(fiId: number) {
    setProcesandoFi(fiId);
    try {
      const result = await confirmarFiAction(fiId);
      if (result.success) {
        flash("success", result.message || "FI confirmada");
        refrescar();
      } else {
        flash("error", result.error || "Error al confirmar");
      }
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
        flash("success", result.message || "FI anulada");
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
    reservadas: data.reservadas.length,
    confirmadas: data.confirmadas.length,
    anuladas: data.anuladas.length,
  };

  return (
    <>
      {/* Flujo + refresh — gemelo Streamlit header */}
      <section className="border-b border-neutral-300 bg-white py-4">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-neutral-700">
            Flujo: Aprobar célula → FI RESERVADA → Confirmar individualmente → FI CONFIRMADA
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
                      cargandoFis={cargandoFisPedido === p.id}
                      procesandoFi={procesandoFi}
                      rechazando={rechazandoPedido === p.id}
                      onExpandir={() => {
                        const next = pedidoExpandido === p.id ? null : p.id;
                        setPedidoExpandido(next);
                        if (next) cargarFisPedido(next);
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

        {tab === "reservadas" && (
          <>
            {data.reservadas.length === 0 ? (
              <EmptyState icon="⏳" text="No hay facturas reservadas esperando confirmación." />
            ) : (
              <>
                <p className="mb-4 text-sm text-neutral-600">
                  {data.reservadas.length} factura(s) esperando confirmación individual
                </p>
                <div className="space-y-4">
                  {data.reservadas.map((fi) => (
                    <FiCard
                      key={fi.id}
                      fi={fi}
                      catalogos={catalogos}
                      detalles={detallesPorFi[fi.id]}
                      procesando={procesandoFi === fi.id}
                      onConfirmar={handleConfirmarFi}
                      onAnular={(fiId) => setModalAnular({ fiId, motivo: "" })}
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

        {tab === "confirmadas" && (
          <>
            {data.confirmadas.length === 0 ? (
              <EmptyState icon="✓" text="No hay facturas confirmadas aún." />
            ) : (
              <>
                <p className="mb-4 text-sm text-neutral-600">
                  Últimas {data.confirmadas.length} confirmadas · más recientes arriba (fecha confirmación)
                </p>
                <div className="space-y-4">
                  {data.confirmadas.map((fi) => (
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

        {tab === "anuladas" && (
          <>
            {data.anuladas.length === 0 ? (
              <EmptyState icon="✗" text="No hay facturas anuladas." />
            ) : (
              <>
                <p className="mb-4 text-sm text-neutral-600">
                  {data.anuladas.length} factura(s) anuladas
                </p>
                <div className="space-y-4">
                  {data.anuladas.map((fi) => (
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
