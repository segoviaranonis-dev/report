"use client";

import { labelListadoPrecio, type ListadoPrecioTierId } from "@/lib/intencion-compra/listado-precio-tiers";

type Props = {
  compact?: boolean;
  shop?: number | null;
  lp?: ListadoPrecioTierId | null;
};

/** Norte CHUSAR — IC PROGRAMADO = cabecera FI → CSV veneno Carlos (2.3.1.7.5.3.4). */
export function IcProgramadoCabeceraGuide({ compact, shop, lp }: Props) {
  if (compact) {
    return (
      <p className="text-[11px] leading-relaxed text-violet-900">
        <strong>IC = cabecera FI.</strong> SHOP {shop ?? "—"} · LP {lp ? labelListadoPrecio(lp) : "—"} · destino CSV Carlos (
        <span className="font-mono">8604-26.csv</span>).
      </p>
    );
  }

  return (
    <section className="rounded-xl border-2 border-violet-300 bg-gradient-to-br from-violet-50 to-white p-4 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-widest text-violet-700">PROGRAMADO · Cabecera CHUSAR</p>
      <h2 className="mt-1 font-serif text-lg font-semibold text-rimec-azul-dark">
        Esta IC es la cabecera de una Factura Interna
      </h2>
      <p className="mt-2 text-sm text-slate-700">
        En programado la IC <strong>no</strong> es un pedido genérico: define cliente SHOP, vendedor, plazo, política LP y
        descuentos que heredará la FI al importar proforma. Al cierre del ciclo, el tab FI exporta el{" "}
        <strong>CSV veneno Carlos</strong> (inyección al sistema legal legacy).
      </p>
      <ol className="mt-3 grid gap-1 text-xs text-slate-600 sm:grid-cols-5">
        <li className="rounded border border-violet-200 bg-white px-2 py-1.5 font-semibold text-violet-900">1 · IC (acá)</li>
        <li className="rounded border border-slate-200 bg-white px-2 py-1.5">2 · PP + proforma</li>
        <li className="rounded border border-slate-200 bg-white px-2 py-1.5">3 · FI RESERVADA</li>
        <li className="rounded border border-slate-200 bg-white px-2 py-1.5">4 · Compra / fact.</li>
        <li className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 font-semibold text-amber-900">5 · CSV Carlos</li>
      </ol>
      {(shop != null || lp != null) && (
        <p className="mt-2 font-mono text-xs text-violet-800">
          SHOP={shop ?? "?"} · LP={lp ? labelListadoPrecio(lp) : "?"} · emparejamiento Excel col. J = id_cliente
        </p>
      )}
      <p className="mt-2 text-[10px] text-slate-500">
        Doc: PROTOCOLO_IMPORT_PROFORMA_PROGRAMADO · CHUSAR_CSV_VENENO_CARLOS_PROGRAMADO · 2.3.1.7.5.3.4
      </p>
    </section>
  );
}
