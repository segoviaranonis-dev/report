"use client";

import {
  descuentosLabel,
  fiDisplayId,
  fmtGs,
  listaPrecioLabel,
  ppDisplay,
} from "@/app/aprobaciones/lib/aprobaciones-utils";
import type { FacturaListItem } from "@/lib/facturacion/types";
import { TERMINO_FI } from "@/lib/facturacion/types";
import type { OrigenFacturacion } from "@/lib/facturacion/filters";

type Props = {
  f: FacturaListItem;
  origen: OrigenFacturacion;
  /** Nivel Dios — anular FI entera + reintegrar stock (2.3.1.9.C) */
  puedeAnularReintegrar?: boolean;
  anulando?: boolean;
  onAnularReintegrar?: () => void;
};

function fmtFecha(fecha: string | null | undefined): string {
  if (!fecha) return "—";
  const d = fecha.slice(0, 10);
  const [y, m, day] = d.split("-");
  if (y && m && day) return `${day}/${m}/${y}`;
  return d;
}

function cel(label: string, value: string, emphasis = false) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{label}</p>
      <p
        className={`mt-0.5 truncate font-semibold tabular-nums ${emphasis ? "text-lg text-rimec-azul-dark" : "text-sm text-neutral-900"}`}
      >
        {value}
      </p>
    </div>
  );
}

export function FacturaInternaCabecera({
  f,
  origen,
  puedeAnularReintegrar = false,
  anulando = false,
  onAnularReintegrar,
}: Props) {
  const esPe = origen === "pronta-entrega";
  const displayId = fiDisplayId({ pv_global: f.pv_global, nro_factura: f.factura_legacy });
  const legacy = f.factura_legacy;
  const ppLabel = ppDisplay({
    nro_pp: f.pedido,
    pp_id: f.pp_id,
    proforma: f.proforma,
    origen_pe: esPe,
    nro_factura: f.factura_legacy,
  });
  const fiBadge =
    f.fi_estado === "RESERVADA"
      ? { bg: "#CA8A04", fg: "#fff", label: "RESERVADA" }
      : f.fi_estado === "CONFIRMADA"
        ? { bg: "#15803D", fg: "#fff", label: "CONFIRMADA" }
        : null;
  const traspasoUpper = (f.traspaso_estado || "").toUpperCase();
  const traspasoBloquea =
    traspasoUpper === "ENVIADO" || traspasoUpper === "CONFIRMADO";
  const showAnularDios =
    puedeAnularReintegrar &&
    onAnularReintegrar &&
    f.fi_id != null &&
    (f.fi_estado === "RESERVADA" || f.fi_estado === "CONFIRMADA") &&
    !traspasoBloquea;

  const descuentos = descuentosLabel({
    descuento_1: f.descuento_1,
    descuento_2: f.descuento_2,
    descuento_3: f.descuento_3,
    descuento_4: f.descuento_4,
  });

  return (
    <header className="border-b-2 border-rimec-azul/15 bg-gradient-to-r from-rimec-azul/[0.07] to-transparent px-4 py-4 sm:px-5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-rimec-azul/70">
        {TERMINO_FI} · {displayId}
        {legacy && legacy !== displayId ? ` · ref ${legacy}` : ""}
      </p>
      <h2 className="mt-1 font-serif text-2xl font-bold leading-tight text-rimec-azul-dark sm:text-3xl">
        {f.cliente || "—"}
      </h2>
      {f.codigo_cliente && f.codigo_cliente !== f.cliente && (
        <p className="mt-0.5 text-xs font-medium text-neutral-500">Cód. {f.codigo_cliente}</p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
        {cel("Cantidad", `${f.pares.toLocaleString("es-PY")} pares`, true)}
        {cel("Marca", f.marca || "—")}
        {cel("Vendedor", f.vendedor || "—")}
        {cel("Listado", listaPrecioLabel(f.lista_precio_id))}
        {cel("Descuentos", descuentos)}
        {cel("Fecha", fmtFecha(f.fecha))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-rimec-azul/10 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg border-2 border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-800">
            {ppLabel}
          </span>
          {esPe && (
            <span className="rounded-md bg-orange-700 px-2 py-0.5 text-[10px] font-black tracking-wide text-white">
              PRONTA ENTREGA
            </span>
          )}
          {fiBadge && (
            <span
              className="rounded-md px-2 py-0.5 text-[10px] font-bold"
              style={{ backgroundColor: fiBadge.bg, color: fiBadge.fg }}
            >
              {fiBadge.label}
            </span>
          )}
          {f.total_monto != null && f.total_monto > 0 && (
            <span className="text-sm font-bold tabular-nums text-neutral-800">{fmtGs(f.total_monto)}</span>
          )}
          {!esPe && f.compra !== "—" && (
            <span className="text-xs text-neutral-600">CL {f.compra}</span>
          )}
        </div>
        {showAnularDios && (
          <button
            type="button"
            disabled={anulando}
            onClick={onAnularReintegrar}
            title="Nivel Dios · anula FI entera · reintegra stock · Anulaciones"
            className="rounded-lg bg-red-800 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-white shadow-sm hover:bg-red-900 disabled:opacity-50"
          >
            {anulando ? "Anulando…" : "Anular FI y reintegrar stock"}
          </button>
        )}
      </div>
    </header>
  );
}
