"use client";

import { useEffect, useState } from "react";
import type { FiDetalle } from "@/app/aprobaciones/lib/aprobaciones-types";
import {
  brutoDesdeNeto,
  fmtDescuentoPct,
  fmtFechaDoc,
  fmtGs,
  listaPrecioLabel,
} from "@/app/aprobaciones/lib/aprobaciones-utils";
import { SelectorPoliticaLp } from "@/app/proceso-importacion/intencion-compra/components/SelectorPoliticaLp";
import {
  esListadoPrecioValido,
  labelListadoPrecio,
  type ListadoPrecioTierId,
} from "@/lib/intencion-compra/listado-precio-tiers";
import type { PpFacturaInternaRow } from "@/lib/pedido-proveedor/detail-query";
import {
  fetchPdfBlob,
  getCachedPdf,
  prefetchSingleFiPdf,
  triggerBlobDownload,
} from "@/lib/pedido-proveedor/fi-download-cache";
import { ProductThumbFrame } from "@/components/product/ProductThumbFrame";

const ESTADO_STYLE: Record<string, string> = {
  RESERVADA: "bg-violet-100 text-violet-900",
  CONFIRMADA: "bg-emerald-100 text-emerald-900",
  ANULADA: "bg-slate-200 text-slate-700",
};

type Props = {
  fi: PpFacturaInternaRow;
  detalles: FiDetalle[];
  ppId: number;
  programado: boolean;
  editable: boolean;
  onUpdated: () => void;
  onMsg: (text: string) => void;
};

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-rimec-azul-dark">{value || "—"}</p>
    </div>
  );
}

export function PpFiCard({ fi, detalles, ppId, programado, editable, onUpdated, onMsg }: Props) {
  const [open, setOpen] = useState(false);
  const [lp, setLp] = useState<ListadoPrecioTierId | null>(
    esListadoPrecioValido(fi.lista_precio_id) ? fi.lista_precio_id : null,
  );
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    setLp(esListadoPrecioValido(fi.lista_precio_id) ? fi.lista_precio_id : null);
  }, [fi.id, fi.lista_precio_id]);

  useEffect(() => {
    if (open) prefetchSingleFiPdf(ppId, fi.id);
  }, [open, ppId, fi.id]);

  const fiEditable = editable && (fi.estado === "RESERVADA" || fi.estado === "CONFIRMADA");

  const descuentos: [number, number, number, number] = [
    fi.descuento_1,
    fi.descuento_2,
    fi.descuento_3,
    fi.descuento_4,
  ];
  const montoNeto = fi.total_monto;
  const montoBruto = brutoDesdeNeto(montoNeto, ...descuentos);
  const icLp = labelListadoPrecio(fi.ic_listado_precio_id);
  const fiLp = labelListadoPrecio(fi.lista_precio_id);
  const lpDesalineado =
    fi.ic_listado_precio_id != null
    && fi.lista_precio_id != null
    && fi.ic_listado_precio_id !== fi.lista_precio_id;
  const lineasSinLpn = detalles.filter((d) => d.sin_lpn).length;

  async function descargarPdf(e: React.MouseEvent) {
    e.stopPropagation();
    setPdfBusy(true);
    try {
      const blob =
        getCachedPdf(ppId, fi.id) ?? (await fetchPdfBlob(ppId, fi.id));
      if (!blob) throw new Error("No se pudo generar el PDF");
      triggerBlobDownload(blob, `${fi.nro_factura.replace(/[^\w.-]+/g, "_")}.pdf`);
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Error al descargar PDF");
    } finally {
      setPdfBusy(false);
    }
  }

  async function guardarLp() {
    if (!esListadoPrecioValido(lp)) {
      onMsg("Elegí LPN, LPC02, LPC03 o LPC04.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/proceso-importacion/pedido-proveedor/${ppId}/fi/${fi.id}/lista-precio`,
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lista_precio_id: lp }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cambiar LP");
      onMsg(`FI ${fi.nro_factura} · LP ${labelListadoPrecio(lp)} · recalculada.`);
      onUpdated();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-xl border-2 border-neutral-300 bg-card-bg shadow-md">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-rimec-azul/15 bg-gradient-to-r from-rimec-azul/5 to-transparent px-4 py-4 sm:px-5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="min-w-0 flex-1 text-left hover:opacity-90"
          aria-expanded={open}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-500">{open ? "▾" : "▸"}</span>
            <span className="rounded-lg bg-rimec-azul px-3 py-1 font-mono text-sm font-bold tabular-nums text-white shadow-sm">
              {fi.nro_factura}
            </span>
            {programado && (
              <span className="rounded bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-900">
                Programado
              </span>
            )}
            <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${ESTADO_STYLE[fi.estado] ?? "bg-slate-100 text-slate-800"}`}>
              {fi.estado}
            </span>
            {lpDesalineado && (
              <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                IC {icLp} ≠ FI {fiLp}
              </span>
            )}
            {lineasSinLpn > 0 && (
              <span className="rounded border-2 border-amber-500 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-950">
                {lineasSinLpn} sin LPN
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-900">{fi.cliente}</p>
          <p className="text-xs text-slate-600">
            {fi.vendedor} · {fiLp} · {fi.plazo_nombre?.trim() || "Sin plazo"}
            {fi.marca !== "—" ? ` · ${fi.marca}` : ""}
          </p>
          <p className="text-[10px] text-slate-500">
            Cod. {fi.cliente_id ?? "—"} · {fmtFechaDoc(fi.created_at)} · {fi.item_count} SKUs
          </p>
        </button>
        <div className="flex flex-col items-end gap-2 text-right text-sm tabular-nums">
          <button
            type="button"
            disabled={pdfBusy}
            onClick={descargarPdf}
            className="rounded-lg border border-rimec-azul/40 bg-rimec-azul/10 px-3 py-1.5 text-xs font-bold text-rimec-azul hover:bg-rimec-azul/15 disabled:opacity-50"
          >
            {pdfBusy ? "Generando…" : "Descargar PDF"}
          </button>
          <div>
            <p className="font-bold text-rimec-azul-dark">
              {fi.total_cajas.toLocaleString("es-PY")} cj · {fi.total_pares.toLocaleString("es-PY")} pares
            </p>
            <p className="text-[10px] text-slate-500 line-through">{fmtGs(montoBruto)} sin desc.</p>
            <p className="text-base font-bold text-slate-900">{fmtGs(montoNeto)} con desc.</p>
          </div>
        </div>
      </header>

      {open && (
        <>
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetaCell label="Vendedor" value={fi.vendedor} />
              <MetaCell label="Listado precios" value={fiLp} />
              <MetaCell label="Plazo" value={fi.plazo_nombre?.trim() || "—"} />
              <MetaCell label="Marca" value={fi.marca !== "—" ? fi.marca : "—"} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Desc. {i + 1}</p>
                  <p className="mt-0.5 text-sm font-semibold text-rimec-azul-dark">{fmtDescuentoPct(descuentos[i])}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 p-4">
            <SelectorPoliticaLp
              required={fiEditable}
              disabled={!fiEditable || busy}
              value={lp}
              onChange={setLp}
              hint={
                fiEditable
                  ? `Origen IC: ${icLp} · FI actual: ${fiLp} (${listaPrecioLabel(fi.lista_precio_id)}) · al guardar recalcula líneas + sincroniza IC.`
                  : `LP IC ${icLp} · FI ${fiLp} · solo lectura.`
              }
            />

            {fiEditable && esListadoPrecioValido(lp) && lp !== fi.lista_precio_id && (
              <button
                type="button"
                disabled={busy}
                onClick={guardarLp}
                className="rounded-lg bg-rimec-azul px-4 py-2 text-xs font-bold text-white hover:bg-rimec-azul-dark disabled:opacity-50"
              >
                {busy ? "Recalculando…" : `Aplicar ${labelListadoPrecio(lp)} y recalcular FI`}
              </button>
            )}

            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {detalles.length === 0 ? (
                <li className="px-3 py-4 text-sm text-slate-500">Sin detalle — importá proforma en Stock.</li>
              ) : (
                detalles.map((d) => {
                  const puBruto =
                    d.precio_unit > d.precio_neto
                      ? d.precio_unit
                      : brutoDesdeNeto(d.precio_neto, ...descuentos);
                  return (
                    <li
                      key={d.id}
                      className={`flex gap-3 px-3 py-2.5 ${
                        d.sin_lpn
                          ? "border-l-4 border-amber-500 bg-amber-50/80 ring-1 ring-inset ring-amber-300"
                          : ""
                      }`}
                    >
                      <ProductThumbFrame
                        candidates={d.imageCandidates}
                        alt={`${d.linea_codigo}-${d.ref_codigo}`}
                        size={64}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-xs font-bold text-rimec-azul-dark">
                          {d.linea_codigo} · {d.ref_codigo}
                          {d.sin_lpn ? (
                            <span className="ml-2 rounded border border-amber-600 bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-950">
                              Sin LPN
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-slate-600">
                          {d.material_nombre || "—"} · {d.color_nombre || "—"}
                        </p>
                        {d.gradas_display ? (
                          <p className="mt-0.5 font-mono text-[10px] text-violet-800">{d.gradas_display}</p>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-right text-xs tabular-nums">
                        <p className="font-bold">{d.pares.toLocaleString("es-PY")} p · {d.cajas} cj</p>
                        <p className="text-[10px] text-slate-400 line-through">{fmtGs(puBruto)} s/d</p>
                        <p className="text-slate-600">{fmtGs(d.precio_neto)} c/d</p>
                        <p className="font-semibold text-rimec-azul">{fmtGs(d.subtotal)}</p>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </>
      )}
    </article>
  );
}
