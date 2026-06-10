"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { aprobarPedidoAction, rechazarPedidoAction } from "./actions";
import { PedidoCard } from "./components/PedidoCard";
import { RechazoModal } from "./components/RechazoModal";
import type {
  DescuentosFactura,
  Factura,
  FiltroEstado,
  Item,
  MensajeFeedback,
  Pedido,
} from "./lib/aprobaciones-types";
import { PEDIDOS_POR_PAGINA } from "./lib/aprobaciones-types";
import { calcStats } from "./lib/aprobaciones-utils";

type Props = {
  pedidosIniciales: Pedido[];
};

export function AprobacionesClient({ pedidosIniciales }: Props) {
  const [pedidos, setPedidos] = useState<Pedido[]>(pedidosIniciales);
  const [procesando, setProcesando] = useState<number | null>(null);
  const [mensaje, setMensaje] = useState<MensajeFeedback | null>(null);
  const [filtro, setFiltro] = useState<FiltroEstado>("PENDIENTE");
  const [pedidoExpandido, setPedidoExpandido] = useState<number | null>(null);
  const [facturas, setFacturas] = useState<Record<number, Factura[]>>({});
  const [items, setItems] = useState<Record<number, Item[]>>({});
  const [loadingFacturas, setLoadingFacturas] = useState<number | null>(null);
  const [descuentosFactura, setDescuentosFactura] = useState<Record<number, DescuentosFactura>>({});
  const [listasFactura, setListasFactura] = useState<Record<number, number>>({});
  const [imagenesVisibles, setImagenesVisibles] = useState<Set<number>>(new Set());
  const [paginaActual, setPaginaActual] = useState(1);
  const [modalRechazo, setModalRechazo] = useState<{ pedidoId: number; motivo: string } | null>(null);

  async function cargarPedidos() {
    const t0 = performance.now();
    try {
      const res = await fetch("/api/aprobaciones");
      if (res.ok) {
        const data = await res.json();
        setPedidos(data);
        console.log(`✓ Pedidos recargados en ${(performance.now() - t0).toFixed(0)}ms`);
      }
    } catch (error) {
      console.error("Error cargando pedidos:", error);
    }
  }

  async function aprobarPedido(pedidoId: number) {
    setProcesando(pedidoId);
    setMensaje(null);
    try {
      const result = await aprobarPedidoAction(pedidoId);
      if (result?.success) {
        setMensaje({ tipo: "success", texto: `Pedido ${pedidoId} aprobado` });
        await cargarPedidos();
      } else {
        setMensaje({ tipo: "error", texto: result.error || "Error al aprobar" });
      }
    } catch (error) {
      console.error("Error aprobando:", error);
      setMensaje({ tipo: "error", texto: "Error de conexión" });
    } finally {
      setProcesando(null);
      setTimeout(() => setMensaje(null), 4000);
    }
  }

  async function rechazarPedido(pedidoId: number, motivo: string) {
    setProcesando(pedidoId);
    setMensaje(null);
    try {
      const result = await rechazarPedidoAction(pedidoId, motivo);
      if (result?.success) {
        setMensaje({ tipo: "success", texto: `Pedido ${pedidoId} rechazado` });
        setModalRechazo(null);
        await cargarPedidos();
      } else {
        setMensaje({ tipo: "error", texto: result.error || "Error al rechazar" });
      }
    } catch (error) {
      console.error("Error rechazando:", error);
      setMensaje({ tipo: "error", texto: "Error de conexión" });
    } finally {
      setProcesando(null);
      setTimeout(() => setMensaje(null), 4000);
    }
  }

  async function togglePedido(pedidoId: number) {
    if (pedidoExpandido === pedidoId) {
      setPedidoExpandido(null);
      return;
    }

    setPedidoExpandido(pedidoId);
    if (facturas[pedidoId]) return;

    setLoadingFacturas(pedidoId);
    const t0 = performance.now();
    try {
      const res = await fetch(`/api/aprobaciones/${pedidoId}/facturas`);
      if (res.ok) {
        const data: Factura[] = await res.json();
        setFacturas((prev) => ({ ...prev, [pedidoId]: data }));

        for (const factura of data) {
          const itemsRes = await fetch(`/api/aprobaciones/facturas/${factura.id}/items`);
          if (itemsRes.ok) {
            const itemsData = await itemsRes.json();
            setItems((prev) => ({ ...prev, [factura.id]: itemsData }));
          }
        }
        console.log(`✓ Facturas e items cargados en ${(performance.now() - t0).toFixed(0)}ms`);
      }
    } catch (error) {
      console.error("Error cargando facturas:", error);
    } finally {
      setLoadingFacturas(null);
    }
  }

  const pedidosFiltrados = filtro === "TODOS" ? pedidos : pedidos.filter((p) => p.estado === filtro);
  const stats = calcStats(pedidos);
  const pedidoRechazo = modalRechazo
    ? pedidos.find((p) => p.id === modalRechazo.pedidoId)
    : undefined;

  return (
    <>
      <section className="border-b border-neutral-300 bg-app-bg py-6">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-4">
            <StatCard label="Total Pedidos" value={stats.total} />
            <StatCard label="Pendientes" value={stats.pendientes} tone="warning" />
            <StatCard label="Aprobados" value={stats.aprobados} tone="success" />
            <StatCard label="Rechazados" value={stats.rechazados} tone="error" />
          </div>
        </div>
      </section>

      {mensaje && (
        <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
          <div
            className={`flex items-start gap-3 rounded-lg border-2 p-4 text-sm font-medium ${
              mensaje.tipo === "success"
                ? "border-semantic-success-light bg-semantic-success/10 text-semantic-success"
                : "border-semantic-error-light bg-semantic-error/10 text-semantic-error"
            }`}
          >
            <span className="flex-shrink-0 text-xl">{mensaje.tipo === "success" ? "✓" : "✗"}</span>
            <span>{mensaje.texto}</span>
          </div>
        </div>
      )}

      <section className="border-b border-neutral-300 bg-app-bg py-4">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-ink">Filtrar por estado:</h2>
            <div className="flex gap-2">
              {(["TODOS", "PENDIENTE", "APROBADO", "RECHAZADO"] as const).map((f) => (
                <Button
                  key={f}
                  variant={filtro === f ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setFiltro(f)}
                  className={filtro === f ? "bg-rimec-azul hover:bg-rimec-azul-light" : ""}
                >
                  {f}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <article className="mx-auto max-w-6xl bg-app-bg px-6 py-8">
        {pedidosFiltrados.length === 0 ? (
          <div className="rounded-lg border-2 border-neutral-300 bg-card-bg p-6 text-center shadow-sm">
            <p className="text-sm text-neutral-700">
              No hay pedidos con el filtro: <strong className="text-rimec-azul">{filtro}</strong>
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pedidosFiltrados
              .slice((paginaActual - 1) * PEDIDOS_POR_PAGINA, paginaActual * PEDIDOS_POR_PAGINA)
              .map((pedido) => (
                <PedidoCard
                  key={pedido.id}
                  pedido={pedido}
                  expandido={pedidoExpandido === pedido.id}
                  procesando={procesando === pedido.id}
                  cargandoFacturas={loadingFacturas === pedido.id}
                  facturas={facturas[pedido.id] || []}
                  items={items}
                  descuentosFactura={descuentosFactura}
                  listasFactura={listasFactura}
                  imagenesVisibles={imagenesVisibles}
                  onToggleDetalle={() => togglePedido(pedido.id)}
                  onAprobar={() => aprobarPedido(pedido.id)}
                  onRechazar={() => setModalRechazo({ pedidoId: pedido.id, motivo: "" })}
                  onListaChange={(facturaId, listaId) =>
                    setListasFactura((prev) => ({ ...prev, [facturaId]: listaId }))
                  }
                  onDescuentoChange={(facturaId, descuentos) =>
                    setDescuentosFactura((prev) => ({ ...prev, [facturaId]: descuentos }))
                  }
                  onImageVisible={(itemId) =>
                    setImagenesVisibles((prev) => new Set(prev).add(itemId))
                  }
                />
              ))}
          </div>
        )}

        {pedidosFiltrados.length > PEDIDOS_POR_PAGINA && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
              disabled={paginaActual === 1}
              className="rounded border border-report-rule bg-white px-4 py-2 text-sm font-semibold text-report-navy disabled:opacity-30"
            >
              ← Anterior
            </button>
            <span className="px-4 text-sm text-report-muted">
              Página {paginaActual} de {Math.ceil(pedidosFiltrados.length / PEDIDOS_POR_PAGINA)}
            </span>
            <button
              type="button"
              onClick={() =>
                setPaginaActual((p) =>
                  Math.min(Math.ceil(pedidosFiltrados.length / PEDIDOS_POR_PAGINA), p + 1)
                )
              }
              disabled={paginaActual >= Math.ceil(pedidosFiltrados.length / PEDIDOS_POR_PAGINA)}
              className="rounded border border-report-rule bg-white px-4 py-2 text-sm font-semibold text-report-navy disabled:opacity-30"
            >
              Siguiente →
            </button>
          </div>
        )}
      </article>

      <RechazoModal
        isOpen={modalRechazo !== null}
        motivo={modalRechazo?.motivo || ""}
        onClose={() => setModalRechazo(null)}
        onConfirm={() => {
          if (modalRechazo) rechazarPedido(modalRechazo.pedidoId, modalRechazo.motivo);
        }}
        onMotivoChange={(motivo) =>
          setModalRechazo((prev) => (prev ? { ...prev, motivo } : null))
        }
        loading={procesando === modalRechazo?.pedidoId}
        pedidoNro={pedidoRechazo?.nro_pedido}
      />
    </>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warning" | "success" | "error";
}) {
  const toneClass =
    tone === "warning"
      ? "border-semantic-warning/30 bg-semantic-warning/10 text-semantic-warning"
      : tone === "success"
        ? "border-semantic-success/30 bg-semantic-success/10 text-semantic-success"
        : tone === "error"
          ? "border-semantic-error/30 bg-semantic-error/10 text-semantic-error"
          : "border-neutral-300 bg-card-bg text-neutral-ink";

  return (
    <div className={`rounded-lg border-2 p-4 shadow-sm ${toneClass}`}>
      <div className="text-xs font-semibold uppercase tracking-wider text-neutral-ink-muted">{label}</div>
      <div className={`mt-2 font-serif text-3xl font-semibold tabular-nums ${tone ? "" : "text-neutral-ink"}`}>
        {value}
      </div>
    </div>
  );
}
