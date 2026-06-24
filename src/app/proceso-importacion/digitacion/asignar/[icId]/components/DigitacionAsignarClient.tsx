"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import { Skeleton } from "@/components/ui/LoadingState";
import type { IcCatalogos } from "@/lib/intencion-compra/catalogos-query";
import { FECHA_DE_EMBARQUE_LABEL } from "@/lib/intencion-compra/quincena-arribo";
import { DIGITACION, PEDIDO_PROVEEDOR, pedidoProveedorDetalle } from "@/lib/report/routes";

type IcData = {
  id: number;
  numero_registro: string;
  marca: string;
  categoria: string;
  proveedor: string;
  cliente: string;
  pares: number;
  fecha_embarque: string | null;
  precio_evento_id: number | null;
};

export function DigitacionAsignarClient() {
  const params = useParams();
  const router = useRouter();
  const icId = Number(params.icId);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ic, setIc] = useState<IcData | null>(null);
  const [catalogos, setCatalogos] = useState<IcCatalogos | null>(null);
  const [ppsAbiertos, setPpsAbiertos] = useState<{ id: number; label: string }[]>([]);

  const [eventoId, setEventoId] = useState<number | "">("");
  const [nroFabrica, setNroFabrica] = useState("");
  const [modoPp, setModoPp] = useState<"nuevo" | "existente">("nuevo");
  const [ppExistente, setPpExistente] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/proceso-importacion/digitacion/ic/${icId}`, { credentials: "same-origin" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "IC no encontrada");
      setIc(data.ic);
      setCatalogos(data.catalogos);
      setPpsAbiertos(data.pps_abiertos ?? []);
      if (data.ic.precio_evento_id) setEventoId(data.ic.precio_evento_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [icId]);

  useEffect(() => {
    if (Number.isFinite(icId)) load();
  }, [icId, load]);

  const eventosCerrados = (catalogos?.eventos ?? []).filter((e) => e.id != null);

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
      const res = await fetch(`/api/proceso-importacion/digitacion/asignar/${icId}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          precio_evento_id: eventoId,
          nro_pedido_fabrica: nroFabrica.trim(),
          pedido_proveedor_id: modoPp === "existente" ? ppExistente : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al asignar");
      router.push(pedidoProveedorDetalle(data.pp_id ?? data.pp_numero));
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusGlobalHeader active="proceso-importacion" />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <Link href={DIGITACION} className="text-sm font-semibold text-rimec-azul hover:underline">
          ← Bandeja digitación
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-rimec-azul/70">Asignación IC → PP</p>
        <h1 className="mt-2 font-serif text-3xl text-rimec-azul-dark">Asignar IC</h1>

        {loading ? (
          <div className="mt-8">
            <Skeleton className="h-48 w-full" />
          </div>
        ) : error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
        ) : ic ? (
          <>
            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="font-mono text-lg font-bold text-rimec-azul-dark">{ic.numero_registro}</p>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="text-xs uppercase text-slate-500">Marca</dt>
                  <dd>{ic.marca}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Categoría</dt>
                  <dd>{ic.categoria}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Proveedor</dt>
                  <dd>{ic.proveedor}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Cliente</dt>
                  <dd>{ic.cliente}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Pares</dt>
                  <dd>{ic.pares.toLocaleString("es-PY")}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">{FECHA_DE_EMBARQUE_LABEL}</dt>
                  <dd>{ic.fecha_embarque ?? "—"}</dd>
                </div>
              </dl>
            </div>

            <form onSubmit={submit} className="mt-6 space-y-5 rounded-xl border-2 border-rimec-azul/20 bg-white p-6 shadow-sm">
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
                    <option key={ev.id!} value={ev.id!}>
                      {ev.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-slate-600">Nro. pedido fábrica</label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-mono"
                  value={nroFabrica}
                  onChange={(e) => setNroFabrica(e.target.value)}
                  placeholder="Beira Rio / proveedor"
                  required
                />
              </div>

              <fieldset>
                <legend className="text-xs font-bold uppercase text-slate-600">Destino PP</legend>
                <div className="mt-2 flex gap-4">
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
                      disabled={ppsAbiertos.length === 0}
                    />
                    Agregar a PP abierto{ppsAbiertos.length === 0 ? " (ninguno)" : ""}
                  </label>
                </div>
                {modoPp === "existente" && (
                  <>
                    <select
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                      value={ppExistente}
                      onChange={(e) => setPpExistente(e.target.value ? Number(e.target.value) : "")}
                    >
                      <option value="">— Seleccionar PP —</option>
                      {ppsAbiertos.map((pp) => (
                        <option key={pp.id} value={pp.id}>
                          {pp.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-slate-500">
                      Solo PP con digitación abierta. Los cerrados están en Digitación → tab Cerrados.
                    </p>
                  </>
                )}
              </fieldset>

              {formErr && <p className="text-sm text-red-700">{formErr}</p>}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? "Asignando…" : "Confirmar asignación → PP"}
              </button>
            </form>
          </>
        ) : null}
      </main>
      <ReportFooter note="Digitación · asignación IC" />
    </div>
  );
}
