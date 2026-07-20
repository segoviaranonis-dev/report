"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import { Skeleton } from "@/components/ui/LoadingState";
import { CATEGORIA_PROGRAMADO_ID } from "@/lib/intencion-compra/categoria-ic";
import type { IcCatalogos } from "@/lib/intencion-compra/ic-catalogos-types";
import { FECHA_DE_EMBARQUE_LABEL } from "@/lib/intencion-compra/quincena-arribo";
import { DIGITACION, pedidoProveedorDetalle } from "@/lib/report/routes";

type IcData = {
  id: number;
  numero_registro: string;
  marca: string;
  categoria: string;
  categoria_id: number | null;
  proveedor: string;
  cliente: string;
  pares: number;
  fecha_embarque: string | null;
  precio_evento_id: number | null;
};

function parseIds(raw: string | null): number[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0),
    ),
  ];
}

export function DigitacionAsignarLoteClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ids = useMemo(() => parseIds(searchParams.get("ids")), [searchParams]);
  const ramoProgramado = searchParams.get("ramo") !== "compra_previa";
  const digitacionBack = `${DIGITACION}?ramo=${ramoProgramado ? "programado" : "compra_previa"}`;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ics, setIcs] = useState<IcData[]>([]);
  const [catalogos, setCatalogos] = useState<IcCatalogos | null>(null);
  const [ppsAbiertos, setPpsAbiertos] = useState<{ id: number; label: string }[]>([]);

  const [eventoId, setEventoId] = useState<number | "">("");
  const [nroFabrica, setNroFabrica] = useState("");
  const [modoPp, setModoPp] = useState<"nuevo" | "existente">("nuevo");
  const [ppExistente, setPpExistente] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ids.length) {
      setError("Sin IC en el lote.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const first = await fetch(`/api/proceso-importacion/digitacion/ic/${ids[0]}`, {
        credentials: "same-origin",
      });
      const firstData = await first.json();
      if (!first.ok) throw new Error(firstData.error || "No se pudo cargar catálogos");
      setCatalogos(firstData.catalogos);
      setPpsAbiertos(firstData.pps_abiertos ?? []);
      if (firstData.ic?.precio_evento_id) setEventoId(firstData.ic.precio_evento_id);

      const restIds = ids.slice(1);
      const rest = await Promise.all(
        restIds.map(async (id) => {
          const res = await fetch(`/api/proceso-importacion/digitacion/ic/${id}`, {
            credentials: "same-origin",
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || `IC ${id} no disponible`);
          return data.ic as IcData;
        }),
      );
      setIcs([firstData.ic as IcData, ...rest]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [ids]);

  useEffect(() => {
    void load();
  }, [load]);

  const eventosCerrados = (catalogos?.eventos ?? []).filter((e) => e.id != null);
  const totalPares = ics.reduce((s, ic) => s + (ic.pares || 0), 0);
  const nClientes = new Set(ics.map((ic) => ic.cliente)).size;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormErr(null);
    if (!eventoId) {
      setFormErr("Seleccioná un evento de precio cerrado.");
      return;
    }
    if (!nroFabrica.trim()) {
      setFormErr("Nro. pedido fábrica obligatorio.");
      return;
    }
    if (modoPp === "existente" && !ppExistente) {
      setFormErr("Seleccioná un PP abierto.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/proceso-importacion/digitacion/asignar-lote`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ic_ids: ids,
          precio_evento_id: eventoId,
          nro_pedido_fabrica: nroFabrica.trim(),
          pedido_proveedor_id: modoPp === "existente" ? ppExistente : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al asignar lote");
      const ppUrl = pedidoProveedorDetalle(data.pp_id ?? data.pp_numero);
      router.push(
        ramoProgramado ? `${ppUrl}${ppUrl.includes("?") ? "&" : "?"}from=programado` : ppUrl,
      );
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusGlobalHeader active="proceso-importacion" />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link href={digitacionBack} className="text-sm font-semibold text-rimec-azul hover:underline">
          ← Digitación programado
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-violet-700/80">
          Asignación lote IC → PP · PROGRAMADO
        </p>
        <h1 className="mt-2 font-serif text-3xl text-rimec-azul-dark">Asignar {ids.length || "…"} IC a un PP</h1>
        <p className="mt-2 text-sm text-violet-900">
          <strong>compra_previa = false</strong> · categoría {CATEGORIA_PROGRAMADO_ID} · un evento · un nro. fábrica · un
          PP.
        </p>

        {loading ? (
          <div className="mt-8">
            <Skeleton className="h-48 w-full" />
          </div>
        ) : error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
        ) : (
          <>
            <div className="mt-6 rounded-xl border border-violet-200 bg-violet-50/60 p-4">
              <div className="flex flex-wrap gap-2 text-xs font-extrabold">
                <span className="rounded-md bg-amber-200 px-2 py-1 text-amber-950">{ics.length} IC</span>
                <span className="rounded-md bg-sky-100 px-2 py-1 text-sky-950">{nClientes} clientes</span>
                <span className="rounded-md bg-white px-2 py-1 text-slate-800">
                  {totalPares.toLocaleString("es-PY")} pares
                </span>
              </div>
              <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-sm">
                {ics.map((ic) => (
                  <li key={ic.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-violet-100 py-1">
                    <span className="font-mono font-bold text-rimec-azul-dark">{ic.numero_registro}</span>
                    <span className="text-xs text-slate-600">
                      {ic.marca} · {ic.cliente} · {ic.pares.toLocaleString("es-PY")}p · {ic.fecha_embarque ?? "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <form onSubmit={submit} className="mt-6 space-y-5 rounded-xl border-2 border-violet-300 bg-white p-6 shadow-sm">
              <div>
                <label className="text-xs font-bold uppercase text-slate-600">Evento de precio (cerrado)</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  value={eventoId}
                  onChange={(e) => setEventoId(e.target.value ? Number(e.target.value) : "")}
                  required
                >
                  <option value="">— Seleccionar evento —</option>
                  {eventosCerrados.map((ev) => (
                    <option key={String(ev.id)} value={ev.id ?? ""}>
                      {ev.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-slate-600">Nro. pedido fábrica</label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  value={nroFabrica}
                  onChange={(e) => setNroFabrica(e.target.value)}
                  placeholder="Beira Rio / proveedor · aplica a todo el lote"
                  required
                />
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-slate-600">Destino PP</p>
                <div className="mt-2 space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="modoPp"
                      checked={modoPp === "nuevo"}
                      onChange={() => setModoPp("nuevo")}
                    />
                    Crear PP nuevo
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="modoPp"
                      checked={modoPp === "existente"}
                      onChange={() => setModoPp("existente")}
                    />
                    Agregar a PP abierto
                  </label>
                </div>
                {modoPp === "existente" && (
                  <select
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                    value={ppExistente}
                    onChange={(e) => setPpExistente(e.target.value ? Number(e.target.value) : "")}
                    required
                  >
                    <option value="">— PP abierto —</option>
                    {ppsAbiertos.map((pp) => (
                      <option key={pp.id} value={pp.id}>
                        {pp.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {formErr && <p className="text-sm font-semibold text-red-700">{formErr}</p>}
              <button
                type="submit"
                disabled={busy || !ics.length}
                className="w-full rounded-lg bg-violet-700 py-3 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-50"
              >
                {busy ? "Asignando…" : `Confirmar ${ics.length} IC → PP programado`}
              </button>
              <p className="text-center text-[11px] text-slate-500">
                {FECHA_DE_EMBARQUE_LABEL} se hereda de cada IC · verdad operativa = proforma al importar stock.
              </p>
            </form>
          </>
        )}
      </main>
      <ReportFooter note="Digitación · asignar lote · 2.3.1.7.4.3" />
    </div>
  );
}
