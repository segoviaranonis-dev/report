"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import type { AprobacionesCatalogos, FiRecord, PedidoPendiente } from "../lib/aprobaciones-types";
import { descuentosLabel, fmtGs, listaPrecioLabel } from "../lib/aprobaciones-utils";
import { FiCard } from "./FiCard";
import type { FiDetalle } from "../lib/aprobaciones-types";

type Props = {
  pedido: PedidoPendiente;
  catalogos: AprobacionesCatalogos;
  fis: FiRecord[] | null;
  detallesPorFi: Record<number, FiDetalle[]>;
  cargandoFis: boolean;
  procesandoFi: number | null;
  onExpandir: () => void;
  expandido: boolean;
  onConfirmarFi: (fiId: number) => void;
  onAnularFi: (fiId: number) => void;
  onRechazarPedido: (pedidoId: number, motivo: string) => void;
  onLoadDetalle: (fiId: number) => Promise<FiDetalle[]>;
  rechazando: boolean;
  onFeedback?: (tipo: "success" | "error", texto: string) => void;
  onEditorApplied?: () => void;
};

export function PedidoPendienteCard({
  pedido,
  catalogos,
  fis,
  detallesPorFi,
  cargandoFis,
  procesandoFi,
  onExpandir,
  expandido,
  onConfirmarFi,
  onAnularFi,
  onRechazarPedido,
  onLoadDetalle,
  rechazando,
  onFeedback,
  onEditorApplied,
}: Props) {
  const [motivoRechazo, setMotivoRechazo] = useState("");

  return (
    <article className="rounded-lg border-2 border-semantic-warning/40 bg-white shadow-sm">
      <button
        type="button"
        onClick={onExpandir}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left hover:bg-neutral-50"
      >
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-rimec-azul">
            Cliente · Cod. {pedido.cliente_id}
          </p>
          <p className="font-serif text-lg font-semibold text-rimec-azul-dark">
            {pedido.cliente_nombre}
          </p>
          <p className="mt-1 text-sm tabular-nums text-neutral-600">
            {pedido.total_pares.toLocaleString("es-PY")} pares · {fmtGs(pedido.total_monto)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <span className="rounded-md bg-neutral-800 px-2.5 py-1 text-xs font-bold text-white">
            {pedido.nro_pedido}
          </span>
          <p className="mt-1 text-neutral-500">{expandido ? "▾" : "▸"}</p>
        </div>
      </button>

      {expandido && (
        <div className="border-t border-neutral-200 px-4 py-4">
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <Metric label="Cliente" value={pedido.cliente_nombre} />
            <Metric label="Vendedor" value={pedido.vendedor_nombre || "—"} />
            <Metric label="Plazo" value={pedido.plazo_nombre || "—"} />
            <Metric label="Lista" value={listaPrecioLabel(pedido.lista_precio_id)} />
          </div>
          <p className="mb-4 text-xs text-neutral-600">Descuentos: {descuentosLabel(pedido)}</p>

          <h3 className="mb-1 text-sm font-bold text-rimec-azul">Células de Aprobación</h3>
          <p className="mb-4 text-xs text-neutral-600">
            Cada célula = una factura interna (PP × Marca × Caso). Confirmá individualmente cada FI
            RESERVADA.
          </p>

          {cargandoFis && <p className="text-sm text-neutral-600">Cargando facturas…</p>}
          {!cargandoFis && fis && fis.length === 0 && (
            <p className="text-sm text-semantic-warning">Sin FIs asociadas — revisar manualmente.</p>
          )}
          {!cargandoFis && fis && fis.length > 0 && (
            <div className="space-y-4">
              {fis.map((fi) => (
                <FiCard
                  key={fi.id}
                  fi={fi}
                  catalogos={catalogos}
                  detalles={detallesPorFi[fi.id]}
                  procesando={procesandoFi === fi.id}
                  onConfirmar={onConfirmarFi}
                  onAnular={onAnularFi}
                  onLoadDetalle={onLoadDetalle}
                  onFeedback={onFeedback}
                  onEditorApplied={onEditorApplied}
                />
              ))}
            </div>
          )}

          <div className="mt-6 border-t border-neutral-200 pt-4">
            <label className="mb-2 block text-xs font-semibold text-neutral-700">
              Motivo rechazo TOTAL del pedido
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                placeholder="Rechazar el pedido completo…"
                className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm"
              />
              <Button
                variant="secondary"
                disabled={rechazando || !motivoRechazo.trim()}
                onClick={() => onRechazarPedido(pedido.id, motivoRechazo)}
                className="border-semantic-error text-semantic-error shrink-0"
              >
                Rechazar pedido
              </Button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-neutral-200 bg-neutral-50 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-0.5 truncate text-sm font-medium text-neutral-ink">{value}</div>
    </div>
  );
}
