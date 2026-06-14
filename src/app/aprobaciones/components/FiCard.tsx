"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import type { AprobacionesCatalogos, FiDetalle, FiRecord } from "../lib/aprobaciones-types";
import {
  estadoBadge,
  fiDisplayId,
  fiEsEditable,
  fmtFechaConfirmacion,
  fmtGs,
  listaPrecioLabel,
  ppDisplay,
} from "../lib/aprobaciones-utils";
import {
  ClienteEditor,
  DescuentosEditor,
  PlazoEditor,
  VendedorEditor,
} from "./FiEncabezadoEditores";
import { ItemRow } from "./ItemRow";
import { ListaPrecioEditor } from "./ListaPrecioEditor";

type FiCardProps = {
  fi: FiRecord;
  catalogos: AprobacionesCatalogos;
  detalles?: FiDetalle[] | null;
  onConfirmar?: (fiId: number) => void;
  onAnular?: (fiId: number) => void;
  onLoadDetalle?: (fiId: number) => Promise<FiDetalle[]>;
  procesando?: boolean;
  accionesColapsadas?: boolean;
  onFeedback?: (tipo: "success" | "error", texto: string) => void;
  onEditorApplied?: () => void;
};

export function FiCard({
  fi,
  catalogos,
  detalles: detallesProp,
  onConfirmar,
  onAnular,
  onLoadDetalle,
  procesando = false,
  accionesColapsadas = false,
  onFeedback,
  onEditorApplied,
}: FiCardProps) {
  const [detalles, setDetalles] = useState<FiDetalle[] | null>(detallesProp ?? null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [productosAbiertos, setProductosAbiertos] = useState(false);
  const [listaLocal, setListaLocal] = useState(fi.lista_precio_id ?? 1);
  const [totalLocal, setTotalLocal] = useState(fi.total_monto);
  const [plazoLocal, setPlazoLocal] = useState(fi.plazo_id ?? 0);
  const [descLocal, setDescLocal] = useState([
    fi.descuento_1,
    fi.descuento_2,
    fi.descuento_3,
    fi.descuento_4,
  ] as [number, number, number, number]);

  useEffect(() => {
    if (detallesProp !== undefined) setDetalles(detallesProp);
  }, [detallesProp]);

  useEffect(() => {
    setListaLocal(fi.lista_precio_id ?? 1);
    setTotalLocal(fi.total_monto);
    setPlazoLocal(fi.plazo_id ?? 0);
    setDescLocal([fi.descuento_1, fi.descuento_2, fi.descuento_3, fi.descuento_4]);
  }, [fi]);

  useEffect(() => {
    if (detallesProp !== undefined || !onLoadDetalle) return;
    let cancelled = false;
    setCargandoDetalle(true);
    onLoadDetalle(fi.id)
      .then((loaded) => {
        if (!cancelled) setDetalles(loaded);
      })
      .finally(() => {
        if (!cancelled) setCargandoDetalle(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fi.id, onLoadDetalle, detallesProp]);

  const badge = estadoBadge(fi.estado);
  const displayId = fiDisplayId(fi);
  const legacy = fi.nro_factura || null;
  const estadoUpper = (fi.estado || "").toUpperCase();
  const puedeConfirmar = estadoUpper === "RESERVADA" && onConfirmar;
  const puedeAnular = estadoUpper === "RESERVADA" && onAnular;
  const editable = fiEsEditable(fi);
  const nProductos = detalles?.length ?? 0;
  const resumenProductos =
    nProductos > 0
      ? `${nProductos} ítem${nProductos === 1 ? "" : "s"} · ${fi.total_pares.toLocaleString("es-PY")} pares`
      : cargandoDetalle
        ? "Cargando…"
        : "Sin líneas";

  function applied() {
    onEditorApplied?.();
  }

  return (
    <article className="overflow-hidden rounded-xl border-2 border-neutral-300 bg-card-bg shadow-md">
      <div className="border-b-2 border-rimec-azul/15 bg-gradient-to-r from-rimec-azul/5 to-transparent px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <ClienteEditor
            fi={fi}
            editable={editable}
            onFeedback={onFeedback}
            onApplied={applied}
          />
          <div className="flex shrink-0 flex-wrap items-center justify-start gap-2 sm:justify-end">
            <div className="rounded-lg border-2 border-amber-500/50 bg-amber-50 px-3 py-1.5 text-left">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                Fecha confirmación
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-amber-950">
                {estadoUpper === "CONFIRMADA"
                  ? fmtFechaConfirmacion(fi.fecha_confirmacion)
                  : "—"}
              </p>
            </div>
            <span className="rounded-lg bg-rimec-azul px-3 py-1.5 text-sm font-bold tabular-nums text-white shadow-sm">
              {displayId}
            </span>
            <span className="rounded-lg border-2 border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-800">
              {ppDisplay(fi)}
            </span>
            {legacy && legacy !== displayId && (
              <span className="rounded-lg border border-dashed border-neutral-400 bg-neutral-50 px-2.5 py-1.5 text-xs font-medium text-neutral-600">
                FI {legacy}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="border-b border-neutral-200 bg-neutral-50/60 px-4 py-4 sm:px-5">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <ListaPrecioEditor
            fiId={fi.id}
            listaPrecioId={listaLocal}
            editable={editable}
            onFeedback={onFeedback}
            onApplied={applied}
          />
          <div className="rounded-lg border-2 border-rimec-azul/40 bg-rimec-azul/10 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-rimec-azul">Caso</p>
            <p className="mt-0.5 text-lg font-semibold text-rimec-azul-dark">{fi.caso || "—"}</p>
          </div>
          <PlazoEditor
            fi={fi}
            plazos={catalogos.plazos}
            editable={editable}
            descuentos={descLocal}
            onFeedback={onFeedback}
            onPlazoChange={setPlazoLocal}
            onApplied={applied}
          />
        </div>

        <DescuentosEditor
          fi={fi}
          editable={editable}
          plazoId={plazoLocal || fi.plazo_id || 0}
          onFeedback={onFeedback}
          onApplied={applied}
        />

        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
          <VendedorEditor
            fi={fi}
            vendedores={catalogos.vendedores}
            editable={editable}
            onFeedback={onFeedback}
            onApplied={applied}
          />
          <div className="rounded-lg border-2 border-rimec-azul/40 bg-rimec-azul/10 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-rimec-azul">
              Fecha de llegada
            </p>
            <p className="mt-0.5 text-sm font-semibold text-rimec-azul-dark">
              {fi.quincena_llegada || "—"}
            </p>
          </div>
          <div className="flex justify-end">
            <span
              className="rounded-full px-3 py-1.5 text-xs font-bold tracking-wide"
              style={{ backgroundColor: badge.bg, color: badge.fg }}
            >
              {badge.label === "CONFIRMADA" ? "✓ CONFIRMADA" : badge.label}
            </span>
          </div>
        </div>
        {editable && (
          <p className="mt-2 text-[10px] font-medium text-rimec-azul/90">
            Nivel Dios — cada cambio persiste en BD y sincroniza FI, PVR y PP (sin agregar ítems).
          </p>
        )}
      </div>

      <details
        className="group border-b border-neutral-200"
        onToggle={(e) => setProductosAbiertos((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-rimec-azul hover:bg-neutral-50 sm:px-5">
          <span className="group-open:hidden">▸ Productos · {resumenProductos}</span>
          <span className="hidden group-open:inline">▾ Productos · {resumenProductos}</span>
        </summary>
        <div className="border-t border-neutral-100 bg-white px-4 py-4 sm:px-5">
          {cargandoDetalle && <p className="text-sm text-neutral-600">Cargando productos…</p>}
          {!cargandoDetalle && detalles && detalles.length === 0 && (
            <p className="text-sm text-semantic-warning">Sin líneas de detalle en esta FI.</p>
          )}
          {productosAbiertos && !cargandoDetalle && detalles && detalles.length > 0 && (
            <div className="space-y-3">
              {detalles.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  lpnLista={listaPrecioLabel(listaLocal)}
                  editable={editable}
                  puedeEliminar={detalles.length > 1}
                  onFeedback={onFeedback}
                  onApplied={applied}
                />
              ))}
            </div>
          )}
        </div>
      </details>

      <details className="group border-t border-neutral-200">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-rimec-azul hover:bg-neutral-50 sm:px-5">
          <span className="group-open:hidden">▸ Más datos de la factura</span>
          <span className="hidden group-open:inline">▾ Más datos de la factura</span>
        </summary>
        <div className="space-y-3 border-t border-neutral-100 bg-neutral-50/50 px-4 py-4 text-sm sm:px-5">
          <p>
            <span className="font-semibold text-neutral-700">Marca:</span> {fi.marca}
            {" · "}
            <span className="font-semibold text-neutral-700">Pares:</span>{" "}
            {fi.total_pares.toLocaleString("es-PY")}
            {" · "}
            <span className="font-semibold text-neutral-700">Total:</span> {fmtGs(totalLocal)}
          </p>
          {fi.notas && (
            <p>
              <span className="font-semibold text-neutral-700">Notas:</span> {fi.notas}
            </p>
          )}

          {(puedeConfirmar || puedeAnular) && (
            <div className="flex gap-2 pt-1">
              {puedeConfirmar && (
                <Button
                  size="sm"
                  variant="primary"
                  disabled={procesando}
                  onClick={() => onConfirmar!(fi.id)}
                  className="bg-semantic-success hover:bg-semantic-success/90"
                >
                  Confirmar
                </Button>
              )}
              {puedeAnular && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={procesando}
                  onClick={() => onAnular!(fi.id)}
                  className="border-semantic-error text-semantic-error"
                >
                  Anular
                </Button>
              )}
            </div>
          )}

          {accionesColapsadas && estadoUpper === "CONFIRMADA" && !editable && (
            <p className="text-xs text-neutral-600">
              PP enviado a compra — solo lectura.
            </p>
          )}
        </div>
      </details>
    </article>
  );
}
