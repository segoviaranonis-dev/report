"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { PpAlaNorteRow, PpDetalleHeader } from "@/lib/pedido-proveedor/detail-query";
import type { EventoPrecioOption, EventoPpDetalle } from "@/lib/pedido-proveedor/stock-listado";
import { factorDescuentosFob } from "@/lib/pedido-proveedor/stock-listado";
import {
  FECHA_DE_EMBARQUE_LABEL,
  QUINCENA_ARRIBO_CATALOGO,
  quincenaSliderValue,
} from "@/lib/intencion-compra/quincena-arribo";
import { pedidoProveedorDetalle } from "@/lib/report/routes";

const QUINCENA_IDS = Object.keys(QUINCENA_ARRIBO_CATALOGO).map(Number).sort((a, b) => a - b);

const inputCls = "mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm";
const sectionCls = "rounded-lg border border-slate-200 bg-white p-4";

type StockDraft = {
  numero_proforma: string;
  nro_pedido_externo: string;
  quincena_arribo_id: number;
  descuento_1: number;
  descuento_2: number;
  descuento_3: number;
  descuento_4: number;
};

type Props = {
  pp: PpDetalleHeader;
  ppId: string;
  alaNorte: PpAlaNorteRow[];
  eventoDetalle: EventoPpDetalle | null;
  eventos: EventoPrecioOption[];
  onReload: () => Promise<void>;
  onMsg: (m: string | null) => void;
};

export function PpTabStock({ pp, ppId, alaNorte, eventoDetalle, eventos, onReload, onMsg }: Props) {
  const [quincenaLookup, setQuincenaLookup] = useState<Record<number, string>>(QUINCENA_ARRIBO_CATALOGO);
  const [draft, setDraft] = useState<StockDraft>(() => ({
    numero_proforma: pp.numero_proforma ?? "",
    nro_pedido_externo: pp.nro_pedido_externo ?? "",
    quincena_arribo_id: quincenaSliderValue(pp.quincena_arribo_id),
    descuento_1: pp.descuento_1,
    descuento_2: pp.descuento_2,
    descuento_3: pp.descuento_3,
    descuento_4: pp.descuento_4,
  }));
  const [eventoSel, setEventoSel] = useState<number | "">(eventoDetalle?.evento_id ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/proceso-importacion/intencion-compra/pendientes", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        if (d.quincena_lookup && Object.keys(d.quincena_lookup).length) {
          setQuincenaLookup(d.quincena_lookup);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setDraft({
      numero_proforma: pp.numero_proforma ?? "",
      nro_pedido_externo: pp.nro_pedido_externo ?? "",
      quincena_arribo_id: quincenaSliderValue(pp.quincena_arribo_id),
      descuento_1: pp.descuento_1,
      descuento_2: pp.descuento_2,
      descuento_3: pp.descuento_3,
      descuento_4: pp.descuento_4,
    });
    setEventoSel(eventoDetalle?.evento_id ?? "");
  }, [pp, eventoDetalle?.evento_id]);

  const totalStockPares = useMemo(() => alaNorte.reduce((s, r) => s + r.cantidad_inicial, 0), [alaNorte]);
  const factorNeto = useMemo(
    () => factorDescuentosFob(draft.descuento_1, draft.descuento_2, draft.descuento_3, draft.descuento_4),
    [draft.descuento_1, draft.descuento_2, draft.descuento_3, draft.descuento_4],
  );
  const editable = pp.cabecera_editable;
  const sinStock = pp.total_articulos === 0;

  async function guardarComercial() {
    setBusy(true);
    onMsg(null);
    try {
      const res = await fetch(`/api/proceso-importacion/pedido-proveedor/${pp.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numero_proforma: draft.numero_proforma,
          nro_pedido_externo: draft.nro_pedido_externo,
          quincena_arribo_id: draft.quincena_arribo_id,
          descuento_1: draft.descuento_1,
          descuento_2: draft.descuento_2,
          descuento_3: draft.descuento_3,
          descuento_4: draft.descuento_4,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      onMsg("Cabecera comercial guardada.");
      await onReload();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function vincularListado() {
    if (eventoSel === "") return;
    if (!window.confirm("¿Vincular este evento de precio al PP? Actualiza ICs y congela LPN en PPD si hay stock.")) return;
    setBusy(true);
    onMsg(null);
    try {
      const res = await fetch(`/api/proceso-importacion/pedido-proveedor/${pp.id}/vincular-listado`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evento_id: eventoSel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al vincular");
      onMsg(`Listado vinculado${data.actualizados != null ? ` · ${data.actualizados} filas PPD` : ""}.`);
      await onReload();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      {sinStock ? (
        <>
          <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/60 p-5">
            <h2 className="text-sm font-bold text-amber-900">📤 Cargar Proforma — este PP aún no tiene artículos</h2>
            <p className="mt-1 text-xs text-amber-800">
              Cargá la Fatura Proforma del proveedor (.xls/.xlsx). Los precios FOB son referencia contable; el precio de
              venta lo define la lista de precios asignada.
            </p>
            <p className="mt-2 text-xs text-slate-600">
              ICs vinculadas:{" "}
              <Link href={pedidoProveedorDetalle(ppId, "ics")} className="font-semibold text-rimec-azul hover:underline">
                ver pestaña ICs Asignadas
              </Link>
              {" "}· límite {pp.pares_comprometidos.toLocaleString("es-PY")} pares
            </p>
          </div>

          <div className={sectionCls}>
            <h3 className="text-xs font-bold uppercase text-slate-500">1 · Cabecera comercial</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="text-xs">
                <span className="font-semibold text-slate-600">Nro Proforma *</span>
                <input
                  className={`${inputCls} font-mono`}
                  disabled={!editable}
                  value={draft.numero_proforma}
                  onChange={(e) => setDraft((d) => ({ ...d, numero_proforma: e.target.value }))}
                  placeholder="Ej: 6421"
                />
              </label>
              <label className="text-xs">
                <span className="font-semibold text-slate-600">Nro PP externo (sistema legado)</span>
                <input
                  className={`${inputCls} font-mono`}
                  disabled={!editable}
                  value={draft.nro_pedido_externo}
                  onChange={(e) => setDraft((d) => ({ ...d, nro_pedido_externo: e.target.value }))}
                  placeholder="Ej: PP-654-2026-001"
                />
              </label>
              <label className="text-xs">
                <span className="font-semibold text-slate-600">{FECHA_DE_EMBARQUE_LABEL} *</span>
                <select
                  className={inputCls}
                  disabled={!editable}
                  value={draft.quincena_arribo_id}
                  onChange={(e) => setDraft((d) => ({ ...d, quincena_arribo_id: Number(e.target.value) }))}
                >
                  <option value={0}>— Elegir quincena —</option>
                  {QUINCENA_IDS.map((id) => (
                    <option key={id} value={id}>
                      {quincenaLookup[id] ?? QUINCENA_ARRIBO_CATALOGO[id]}
                    </option>
                  ))}
                </select>
                <span className="mt-0.5 block text-[10px] text-slate-500">Dato duro · tabla quincena_arribo (1–24)</span>
              </label>
            </div>
          </div>

          <div className={sectionCls}>
            <h3 className="text-xs font-bold uppercase text-slate-500">2 · Descuentos comerciales escalados</h3>
            <p className="mt-1 text-xs text-slate-500">
              Cascada sobre FOB unitario. Solo almacenan/muestran aquí; no afectan precio de venta (listado RIMEC).
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {([1, 2, 3, 4] as const).map((n) => (
                <label key={n} className="text-xs">
                  <span className="font-semibold text-slate-600">Descuento {n} (%)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    disabled={!editable}
                    className={`${inputCls} tabular-nums`}
                    value={draft[`descuento_${n}`]}
                    onChange={(e) => {
                      const key = `descuento_${n}` as keyof Pick<StockDraft, "descuento_1" | "descuento_2" | "descuento_3" | "descuento_4">;
                      setDraft((d) => ({ ...d, [key]: Number(e.target.value) || 0 }));
                    }}
                  />
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-violet-800">
              Factor neto FOB: <span className="font-mono font-bold">{(factorNeto * 100).toFixed(2)}%</span> del FOB
              original
            </p>
          </div>

          <div className={`${sectionCls} border-violet-200 bg-violet-50/30`}>
            <h3 className="text-xs font-bold uppercase text-violet-800">3 · Fatura Proforma del proveedor</h3>
            <p className="mt-2 text-sm text-slate-600">
              Upload Excel — <strong>Fase 4 mudanza</strong> (parser `parse_proforma` + `populate_pp_from_proforma`).
            </p>
            <p className="mt-1 text-xs text-slate-500">Mientras tanto: cargá desde Streamlit o esperá próximo hito Report.</p>
          </div>

          {editable && (
            <button
              type="button"
              disabled={busy || !draft.numero_proforma.trim() || draft.quincena_arribo_id <= 0}
              onClick={guardarComercial}
              className="rounded-lg bg-rimec-azul px-4 py-2 text-sm font-bold text-white hover:bg-rimec-azul-dark disabled:opacity-50"
            >
              {busy ? "Guardando…" : "Guardar cabecera comercial + descuentos"}
            </button>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-rimec-azul-dark">Ala Norte · F9 / Proforma</h2>
            <p className="text-xs text-slate-600">
              {alaNorte.length} moléculas · {totalStockPares.toLocaleString("es-PY")} pares ·{" "}
              {pp.total_vendido.toLocaleString("es-PY")} vendidos · {pp.saldo.toLocaleString("es-PY")} disponibles
            </p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pl-3 pr-2">Línea</th>
                  <th className="py-2 pr-2">Ref.</th>
                  <th className="py-2 pr-2">Material</th>
                  <th className="py-2 pr-2">Color</th>
                  <th className="py-2 pr-2">Grada</th>
                  <th className="py-2 pr-2 text-right">Inicial</th>
                  <th className="py-2 pr-2 text-right">Vendido</th>
                  <th className="py-2 pr-3 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {alaNorte.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="py-2 pl-3 pr-2 font-mono">{r.linea}</td>
                    <td className="py-2 pr-2 font-mono">{r.referencia}</td>
                    <td className="py-2 pr-2">{r.material}</td>
                    <td className="py-2 pr-2">{r.color}</td>
                    <td className="py-2 pr-2 font-mono text-slate-600">{r.grada ?? "—"}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{r.cantidad_inicial.toLocaleString("es-PY")}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{r.vendido.toLocaleString("es-PY")}</td>
                    <td className="py-2 pr-3 text-right tabular-nums font-semibold">{r.saldo.toLocaleString("es-PY")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">Fase 2: acordeón por marca · columnas talla desde grades_json · precios stock.</p>
        </>
      )}

      <div className={`${sectionCls} border-sky-200`}>
        <h3 className="text-sm font-bold text-rimec-azul-dark">Listado de precios RIMEC</h3>
        <p className="mt-1 text-xs text-slate-600">
          Biblioteca + listado Excel = un evento. Acompaña el PP y alimenta FI hasta Compra Legal.
        </p>
        {eventoDetalle ? (
          <p className="mt-2 rounded bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
            Listado vigente: <strong>{eventoDetalle.nombre_evento}</strong> · {eventoDetalle.n_precios} precios · estado{" "}
            {eventoDetalle.estado} · evento #{eventoDetalle.evento_id}
            {eventoDetalle.biblioteca ? ` · biblioteca ${eventoDetalle.biblioteca}` : ""}
          </p>
        ) : (
          <p className="mt-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Sin listado vinculado — elegí un evento y pulsá Vincular al PP.
          </p>
        )}
        {!pp.listado_editable && (
          <p className="mt-2 text-xs font-bold text-red-700">PP ENVIADO — listado congelado.</p>
        )}
        {pp.listado_editable && (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="min-w-[280px] flex-1 text-xs">
              <span className="font-semibold text-slate-600">Explorar / cambiar evento de precio</span>
              <select
                className={inputCls}
                value={eventoSel}
                onChange={(e) => setEventoSel(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">— Elegir evento —</option>
                {eventos.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.vigente ? "★ " : ""}
                    {ev.nombre} · {ev.n_precios} refs · [{ev.estado.toUpperCase()}]
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={busy || eventoSel === ""}
              onClick={vincularListado}
              className="rounded-lg border-2 border-rimec-azul bg-rimec-azul px-4 py-2 text-xs font-bold text-white hover:bg-rimec-azul-dark disabled:opacity-50"
            >
              🔗 Vincular al PP
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
