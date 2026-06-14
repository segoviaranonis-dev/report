"use client";

import { parseLineaSnapshotForDisplay } from "@/app/aprobaciones/lib/linea-snapshot-display";
import { RetailProductImage } from "@/app/retail/components/RetailProductImage";
import type { FiDetalleCanonico, FiRegistroRow } from "@/lib/bazzar-web/compra-web/types";
import {
  descuentosLabel,
  estadoBadge,
  fiDisplayId,
  fmtGs,
  listaPrecioLabel,
  ppDisplay,
} from "@/app/aprobaciones/lib/aprobaciones-utils";

type Props = {
  fi: FiRegistroRow;
  detalles: FiDetalleCanonico[];
};

export function CompraWebFiPanel({ fi, detalles }: Props) {
  const badge = estadoBadge(fi.estado);
  const displayId = fiDisplayId({ pv_global: fi.pv_global, nro_factura: fi.nro_factura });
  const legacy = fi.nro_factura;

  return (
    <section className="overflow-hidden rounded-xl border-2 border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cliente</p>
            <p className="text-lg font-semibold text-slate-900">{fi.cliente || "—"}</p>
            <p className="mt-1 text-sm text-slate-600">Vendedor: {fi.vendedor || "—"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-lg bg-[#1E3A5F] px-3 py-1.5 text-sm font-bold text-white tabular-nums">
              {displayId}
            </span>
            <span className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold">
              {ppDisplay({ nro_pp: fi.nro_pp, pp_id: fi.pp_id, proforma: null })}
            </span>
            {legacy && legacy !== displayId && (
              <span className="rounded-lg border border-dashed border-slate-400 px-2.5 py-1.5 text-xs text-slate-600">
                FI {legacy}
              </span>
            )}
            <span
              className="rounded-full px-3 py-1 text-xs font-bold"
              style={{ backgroundColor: badge.bg, color: badge.fg }}
            >
              {badge.label}
            </span>
          </div>
        </div>
      </header>

      <div className="grid gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:grid-cols-3 sm:px-5">
        <div className="rounded-lg border border-slate-200 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Lista</p>
          <p className="mt-0.5 font-semibold">{listaPrecioLabel(fi.lista_precio_id)}</p>
        </div>
        <div className="rounded-lg border border-[#1E3A5F]/30 bg-[#1E3A5F]/5 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#1E3A5F]">Caso</p>
          <p className="mt-0.5 text-lg font-semibold text-[#1E3A5F]">{fi.caso || "—"}</p>
        </div>
        <div className="rounded-lg border border-slate-200 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Marca</p>
          <p className="mt-0.5 font-semibold">{fi.marca || "—"}</p>
        </div>
      </div>

      <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
        <p className="text-sm text-slate-700">
          Descuentos: {descuentosLabel(fi)} · Total:{" "}
          <strong>{fmtGs(fi.total_monto)}</strong> · {fi.total_pares.toLocaleString("es-PY")} pares
        </p>
      </div>

      <div className="px-4 py-4 sm:px-5">
        <p className="mb-3 text-sm font-semibold text-slate-800">
          Productos ({detalles.length})
        </p>
        <ul className="space-y-3">
          {detalles.map((d) => {
            const snap = parseLineaSnapshotForDisplay(d.linea_snapshot);
            return (
              <li
                key={d.id}
                className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3"
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-slate-200">
                  <RetailProductImage
                    candidates={snap.imageCandidates}
                    alt={`${snap.linea_codigo}-${snap.ref_codigo}`}
                    aspect="square"
                    placeholderClass="h-16 w-16 bg-slate-100"
                    searchFileName={snap.imageSearchName}
                  />
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold text-slate-900">
                    L{snap.linea_codigo} · R{snap.ref_codigo}
                  </p>
                  <p className="text-slate-600">
                    {snap.material_nombre || "—"} · {snap.color_nombre || "—"}
                  </p>
                  <p className="text-slate-500">{snap.gradas_display || "—"}</p>
                  <p className="mt-1 tabular-nums text-slate-800">
                    {d.pares} pares · {fmtGs(d.precio_neto ?? d.subtotal)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
