"use client";

import { useCallback, useState } from "react";
import type { IcCatalogos } from "@/lib/intencion-compra/ic-catalogos-types";
import type { IcPendienteRow } from "@/lib/intencion-compra/pendientes-query";
import {
  FECHA_DE_EMBARQUE_CAMPO,
  FECHA_DE_EMBARQUE_LABEL,
} from "@/lib/intencion-compra/quincena-arribo";
import { FechaEmbarqueSlider } from "./FechaEmbarqueSlider";
import { SelectorPoliticaLp } from "./SelectorPoliticaLp";
import { IcProgramadoCabeceraGuide } from "./IcProgramadoCabeceraGuide";
import { useMarcasPorTipo } from "./useMarcasPorTipo";
import { resolveMarcasIcOptions } from "@/lib/intencion-compra/marcas-ic-options";
import {
  ID_CATEGORIA_PROGRAMADO,
  labelListadoPrecio,
  type ListadoPrecioTierId,
} from "@/lib/intencion-compra/listado-precio-tiers";
import { fetchIcApiWithRetry, icApiErrorMessage } from "@/lib/intencion-compra/ic-api-fetch";

type Props = {
  ic: IcPendienteRow;
  catalogos: IcCatalogos;
  quincenaLookup: Record<number, string>;
  onRemoved: (icId: number) => void;
};

async function patchCampo(icId: number, campo: string, valor: unknown) {
  const res = await fetchIcApiWithRetry(`/api/proceso-importacion/intencion-compra/${icId}/campo`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ campo, valor }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(icApiErrorMessage(data, "Error al guardar"));
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number | null;
  options: { id: number; label: string }[];
  onChange: (id: number) => void;
}) {
  return (
    <div className="min-w-[120px] flex-1">
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function IcPendienteCard({ ic, catalogos, quincenaLookup, onRemoved }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { marcas: marcasFiltradas } = useMarcasPorTipo(ic.tipo_id);
  const marcasOpciones = resolveMarcasIcOptions(catalogos, ic.tipo_id, marcasFiltradas);

  const save = useCallback(
    async (campo: string, valor: unknown) => {
      setBusy(true);
      setErr(null);
      try {
        await patchCampo(ic.id, campo, valor);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Error");
      } finally {
        setBusy(false);
      }
    },
    [ic.id],
  );

  const quincenaOk = (ic.quincena_arribo_id ?? 0) > 0;
  const esProgramado = ic.categoria_id === ID_CATEGORIA_PROGRAMADO;
  const lpOk = !esProgramado || (ic.listado_precio_id != null && ic.listado_precio_id >= 1 && ic.listado_precio_id <= 4);
  const canAuth = ic.tipo_id != null && ic.categoria_id != null && ic.pares > 0 && quincenaOk && lpOk;

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-rimec-azul-dark px-4 py-2 text-sm">
        <span className="font-bold text-amber-300">{ic.numero_registro}</span>
        <span className="text-slate-500">|</span>
        <span className="text-[10px] uppercase tracking-wide text-slate-400">
          {esProgramado ? "SHOP" : "Cliente"}
        </span>
        <span className="font-mono font-semibold text-white">
          {esProgramado ? ic.id_cliente : ic.cliente}
        </span>
        {esProgramado && (
          <>
            <span className="hidden text-slate-400 sm:inline">·</span>
            <span className="hidden max-w-[140px] truncate text-slate-300 sm:inline">{ic.cliente}</span>
            <span className="rounded bg-violet-600/80 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
              {labelListadoPrecio(ic.listado_precio_id)}
            </span>
          </>
        )}
        <span className="text-slate-500">|</span>
        <span className="text-[10px] uppercase tracking-wide text-slate-400">Vendedor</span>
        <span className="font-semibold text-white">{ic.vendedor}</span>
        <span className="text-slate-500">|</span>
        <span className="text-[10px] uppercase tracking-wide text-slate-400">Proveedor</span>
        <span className="text-slate-300">{ic.proveedor}</span>
      </header>

      <div className="space-y-4 p-4">
        {esProgramado && (
          <IcProgramadoCabeceraGuide compact shop={ic.id_cliente} lp={ic.listado_precio_id as ListadoPrecioTierId | null} />
        )}
        <div className="flex flex-wrap items-end gap-3">
          <SelectField
            label="Tipo"
            value={ic.tipo_id}
            options={catalogos.tipos}
            onChange={(id) => save("tipo_id", id)}
          />
          <SelectField
            label="Categoría"
            value={ic.categoria_id}
            options={catalogos.categorias}
            onChange={(id) => save("categoria_id", id)}
          />
          <SelectField
            label="Marca"
            value={ic.id_marca}
            options={marcasOpciones}
            onChange={(id) => save("id_marca", id)}
          />
          <FechaEmbarqueSlider
            value={ic.quincena_arribo_id}
            lookup={quincenaLookup}
            disabled={busy}
            onChange={(v) => save(FECHA_DE_EMBARQUE_CAMPO, v)}
          />
          <div className="min-w-[80px]">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Pares</label>
            <input
              type="number"
              min={0}
              step={1}
              defaultValue={ic.pares}
              key={`par-${ic.id}-${ic.pares}`}
              onBlur={(e) => save("cantidad_total_pares", Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm font-mono"
            />
          </div>
          <div className="min-w-[120px] flex-1">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Monto Neto (Gs.)
            </label>
            <input
              type="number"
              min={0}
              step={100000}
              defaultValue={ic.monto_neto}
              key={`neto-${ic.id}-${ic.monto_neto}`}
              onBlur={(e) => save("monto_neto", Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm font-mono"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-[2]">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Evento de Precio
            </label>
            <select
              value={ic.precio_evento_id ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                save("precio_evento_id", v === "" ? null : Number(v));
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
            >
              {catalogos.eventos.map((o) => (
                <option key={String(o.id)} value={o.id ?? ""}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {esProgramado ? (
            <div className="min-w-full basis-full">
              <SelectorPoliticaLp
                required
                disabled={busy}
                value={(ic.listado_precio_id as ListadoPrecioTierId | null) ?? null}
                onChange={(id) => save("listado_precio_id", id)}
                hint={`Actual: ${labelListadoPrecio(ic.listado_precio_id)} · FI usará este tier al vincular proforma.`}
              />
            </div>
          ) : null}
          <div className="min-w-[200px] flex-[2]">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Notas</label>
            <input
              type="text"
              defaultValue={ic.nota_pedido ?? ""}
              key={`nota-${ic.id}-${ic.nota_pedido}`}
              onBlur={(e) => save("nota_pedido", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2 pb-0.5">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (!confirm(`¿Eliminar ${ic.numero_registro}?`)) return;
                setBusy(true);
                setErr(null);
                try {
                  const res = await fetchIcApiWithRetry(
                    `/api/proceso-importacion/intencion-compra/${ic.id}`,
                    { method: "DELETE" },
                  );
                  const data = await res.json();
                  if (!res.ok) throw new Error(icApiErrorMessage(data, "Error al eliminar"));
                  onRemoved(ic.id);
                } catch (e) {
                  setErr(e instanceof Error ? e.message : "Error");
                } finally {
                  setBusy(false);
                }
              }}
              className="rounded-lg border border-slate-400 bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-900 disabled:opacity-50"
            >
              ✗ Eliminar
            </button>
            <button
              type="button"
              disabled={busy || !canAuth}
              onClick={async () => {
                setBusy(true);
                setErr(null);
                try {
                  const res = await fetchIcApiWithRetry(
                    `/api/proceso-importacion/intencion-compra/${ic.id}/autorizar`,
                    { method: "POST" },
                  );
                  const data = await res.json();
                  if (!res.ok) throw new Error(icApiErrorMessage(data, "Error al autorizar"));
                  onRemoved(ic.id);
                } catch (e) {
                  setErr(e instanceof Error ? e.message : "Error");
                } finally {
                  setBusy(false);
                }
              }}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
            >
              ✓ AUTORIZAR
            </button>
          </div>
        </div>

        {!canAuth && (
          <p className="text-xs text-amber-800">
            Tipo, Categoría, Pares y {FECHA_DE_EMBARQUE_LABEL} son obligatorios para autorizar.
            {esProgramado && !lpOk ? " PROGRAMADO exige política LP (LPN/LPC02/LPC03/LPC04)." : ""}
          </p>
        )}
        {err && <p className="text-xs text-red-700">{err}</p>}
      </div>
    </article>
  );
}
