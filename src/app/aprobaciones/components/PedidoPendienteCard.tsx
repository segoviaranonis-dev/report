"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { actualizarPlazoPedidoAction } from "../actions";
import type { AprobacionesCatalogos, FiRecord, PedidoPendiente } from "../lib/aprobaciones-types";
import {
  descuentosLabel,
  fmtGs,
  listaPrecioLabel,
  badgeProntaEntrega,
  badgeCompraPrevia,
} from "../lib/aprobaciones-utils";
import { FiCard } from "./FiCard";
import type { FiDetalle } from "../lib/aprobaciones-types";

type Props = {
  pedido: PedidoPendiente;
  catalogos: AprobacionesCatalogos;
  fis: FiRecord[] | null;
  detallesPorFi: Record<number, FiDetalle[]>;
  cargandoFis: boolean;
  procesandoFi: number | null;
  aprobandoGral: boolean;
  onExpandir: () => void;
  expandido: boolean;
  onConfirmarFi: (fiId: number) => void;
  onAnularFi: (fiId: number) => void;
  onAprobacionGral: (pedidoId: number) => void;
  onRechazarPedido: (pedidoId: number, motivo: string) => void;
  onLoadDetalle: (fiId: number) => Promise<FiDetalle[]>;
  rechazando: boolean;
  onFeedback?: (tipo: "success" | "error", texto: string) => void;
  onEditorApplied?: () => void;
  onRetryFis?: () => void;
};

export function PedidoPendienteCard({
  pedido,
  catalogos,
  fis,
  detallesPorFi,
  cargandoFis,
  procesandoFi,
  aprobandoGral,
  onExpandir,
  expandido,
  onConfirmarFi,
  onAnularFi,
  onAprobacionGral,
  onRechazarPedido,
  onLoadDetalle,
  rechazando,
  onFeedback,
  onEditorApplied,
  onRetryFis,
}: Props) {
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [plazoLocal, setPlazoLocal] = useState(pedido.plazo_id ?? 0);
  const [guardandoPlazo, setGuardandoPlazo] = useState(false);
  const [confirmGral, setConfirmGral] = useState(false);

  useEffect(() => {
    setPlazoLocal(pedido.plazo_id ?? 0);
  }, [pedido.plazo_id]);

  useEffect(() => {
    if (!aprobandoGral) setConfirmGral(false);
  }, [aprobandoGral]);

  const peBadge = pedido.origen_pe ? badgeProntaEntrega() : null;
  const cpBadge = pedido.tiene_compra_previa ? badgeCompraPrevia() : null;

  const borderClass =
    pedido.origen_pe && pedido.tiene_compra_previa
      ? "border-violet-500/50"
      : pedido.origen_pe
        ? "border-orange-500/60"
        : pedido.tiene_compra_previa
          ? "border-sky-500/60"
          : "border-semantic-warning/40";

  const ocupado = aprobandoGral || procesandoFi != null || rechazando;

  return (
    <article className={`rounded-lg border-2 bg-white shadow-sm ${borderClass}`}>
      <div className="flex w-full items-stretch gap-2 px-4 py-4">
        <button
          type="button"
          onClick={onExpandir}
          className="min-w-0 flex-1 text-left hover:opacity-90"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-rimec-azul">
            Cliente · Cod. {pedido.cliente_id}
          </p>
          <p className="font-serif text-lg font-semibold text-rimec-azul-dark">
            {pedido.cliente_nombre}
          </p>
          <p className="mt-1 text-sm tabular-nums text-neutral-600">
            {pedido.total_pares.toLocaleString("es-PY")} pares · {fmtGs(pedido.total_monto)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {cpBadge && (
              <span
                className="inline-block rounded-md px-2.5 py-1 text-[11px] font-black tracking-wide shadow-sm ring-2 ring-sky-300/80"
                style={{ backgroundColor: cpBadge.bg, color: cpBadge.fg }}
              >
                {cpBadge.label}
              </span>
            )}
            {peBadge && (
              <span
                className="inline-block rounded-md px-2.5 py-1 text-[11px] font-black tracking-wide"
                style={{ backgroundColor: peBadge.bg, color: peBadge.fg }}
              >
                {peBadge.label}
              </span>
            )}
          </div>
        </button>

        {/* Aprobación Gral · solo esta molécula (familia FI del pedido) */}
        <div className="flex shrink-0 flex-col items-end justify-between gap-2 self-stretch">
          <span className="rounded-md bg-neutral-800 px-2.5 py-1 text-xs font-bold text-white">
            {pedido.nro_pedido}
          </span>

          {!confirmGral ? (
            <Button
              type="button"
              size="lg"
              variant="primary"
              disabled={ocupado}
              onClick={(e) => {
                e.stopPropagation();
                setConfirmGral(true);
              }}
              className="min-h-11 min-w-[10.5rem] border-2 border-emerald-800 bg-emerald-600 px-4 text-sm font-black uppercase tracking-wide text-white shadow-md hover:bg-emerald-500 disabled:opacity-70"
              title="Aprueba todas las FI RESERVADA de ESTE pedido — no toca otros pendientes"
            >
              {aprobandoGral ? "Aprobando…" : "✓ Aprobación Gral"}
            </Button>
          ) : (
            <div
              className="max-w-[14rem] rounded-lg border-2 border-emerald-800 bg-emerald-50 p-2 shadow"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="mb-2 text-[10px] font-semibold leading-snug text-emerald-950">
                ¿Aprobar solo {pedido.nro_pedido}?{" "}
                {pedido.total_pares.toLocaleString("es-PY")} pares · {fmtGs(pedido.total_monto)}.
                No afecta otros pedidos.
              </p>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  disabled={ocupado}
                  onClick={() => onAprobacionGral(pedido.id)}
                  className="bg-emerald-700 font-black uppercase text-white hover:bg-emerald-600"
                >
                  Confirmar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={aprobandoGral}
                  onClick={() => setConfirmGral(false)}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={onExpandir}
            className="text-neutral-500 hover:text-rimec-azul"
            aria-label={expandido ? "Plegar" : "Expandir"}
          >
            {expandido ? "▾" : "▸"}
          </button>
        </div>
      </div>

      {expandido && (
        <div className="border-t border-neutral-200 px-4 py-4">
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <Metric label="Cliente" value={pedido.cliente_nombre} />
            <Metric label="Vendedor" value={pedido.vendedor_nombre || "—"} />
            <div className="rounded-lg border-2 border-rimec-azul/40 bg-rimec-azul/10 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rimec-azul">
                Plazo · pedido + FI pendientes
              </p>
              <select
                value={plazoLocal || ""}
                disabled={guardandoPlazo}
                onChange={async (e) => {
                  const v = Number(e.target.value);
                  if (!v || v === plazoLocal || guardandoPlazo) return;
                  setGuardandoPlazo(true);
                  const res = await actualizarPlazoPedidoAction(pedido.id, v);
                  if (res.success) {
                    setPlazoLocal(v);
                    onFeedback?.("success", res.message ?? "Plazo actualizado.");
                    onEditorApplied?.();
                  } else {
                    onFeedback?.("error", res.error ?? "No se pudo cambiar el plazo.");
                  }
                  setGuardandoPlazo(false);
                }}
                className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm font-bold text-rimec-azul-dark"
              >
                <option value="">—</option>
                {catalogos.plazos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
              {guardandoPlazo ? (
                <p className="mt-1 text-[10px] text-rimec-azul">Guardando…</p>
              ) : null}
            </div>
            <Metric label="Lista" value={listaPrecioLabel(pedido.lista_precio_id)} />
          </div>
          <p className="mb-4 text-xs text-neutral-600">Descuentos: {descuentosLabel(pedido)}</p>

          {(pedido.observacion?.trim() || pedido.fecha_entrega_cliente) && (
            <div className="mb-4 rounded-2xl border-2 border-emerald-600 bg-emerald-50 px-4 py-3">
              <p className="text-[13px] font-black text-emerald-900">Obs. carrito Web (pedido)</p>
              {pedido.fecha_entrega_cliente ? (
                <p className="mt-1 text-sm text-emerald-800">
                  <span className="font-semibold">Entrega cliente:</span>{" "}
                  {pedido.fecha_entrega_cliente.slice(0, 10)}
                </p>
              ) : null}
              {pedido.observacion?.trim() ? (
                <p className="mt-1 whitespace-pre-wrap text-sm text-emerald-900">
                  {pedido.observacion.trim()}
                </p>
              ) : null}
            </div>
          )}

          <h3 className="mb-1 text-sm font-bold text-rimec-azul">Células de Aprobación</h3>
          <p className="mb-4 text-xs text-neutral-600">
            Cada célula = una factura (marca × caso). Pulsá <strong>Aprobar</strong> una a una, o{" "}
            <strong>Aprobación Gral</strong> arriba = todas las FI de <em>este</em> pedido.
          </p>

          {cargandoFis && (
            <p className="text-sm font-medium text-rimec-azul">
              Cargando facturas…{" "}
              <span className="font-normal text-neutral-500">(máx. 45 s)</span>
            </p>
          )}
          {!cargandoFis && fis == null && (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-semantic-warning">
                No se cargaron las facturas. Reintentá.
              </p>
              {onRetryFis ? (
                <Button size="sm" variant="secondary" onClick={onRetryFis}>
                  Reintentar carga
                </Button>
              ) : null}
            </div>
          )}
          {!cargandoFis && fis && fis.length === 0 && (
            <p className="text-sm text-semantic-warning">
              Sin facturas pendientes en este pedido (puede haber FIs ya en Aprobados). Refrescá o
              revisá la pestaña Aprobados.
            </p>
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
      <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-medium text-neutral-ink">{value}</div>
    </div>
  );
}
