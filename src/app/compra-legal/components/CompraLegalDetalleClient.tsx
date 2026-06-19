"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CompraWebFiPanel } from "@/app/bazzar-web/compra/components/CompraWebFiPanel";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import { CL_ESTADO_COLOR, CL_ESTADO_LABEL } from "@/lib/rimec-abastecimiento/constants";
import type {
  CompraLegalHeader,
  DepositoHijaRow,
  FiDeCompraRow,
  PpDeCompra,
} from "@/lib/compra-legal/types";
import type { FiDetalleCanonico } from "@/lib/bazzar-web/compra-web/types";
import { COMPRA_LEGAL } from "@/lib/report/routes";

type Props = { idCl: number };

type DetallePayload = {
  header: CompraLegalHeader;
  pps: PpDeCompra[];
  deposito: DepositoHijaRow[];
  facturas: FiDeCompraRow[];
  fiDetalles: Record<string, FiDetalleCanonico[]>;
};

export function CompraLegalDetalleClient({ idCl }: Props) {
  const [data, setData] = useState<DetallePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [accionando, setAccionando] = useState(false);
  const [tab, setTab] = useState<"pps" | "deposito" | "facturas">("pps");

  const load = useCallback(async () => {
    if (!Number.isFinite(idCl)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/compra-legal/${idCl}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al cargar");
      setData(json as DetallePayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }, [idCl]);

  useEffect(() => {
    load();
  }, [load]);

  async function finalizar() {
    if (!confirm("¿Finalizar y distribuir? Se crearán traspasos BORRADOR por cada FAC-INT.")) return;
    setAccionando(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/compra-legal/${idCl}/finalizar`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      setSuccess(json.message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setAccionando(false);
    }
  }

  async function rechazarPp(ppId: number) {
    if (!confirm("¿Rechazar este PP de la compra? Vuelve a estado ABIERTO.")) return;
    setAccionando(true);
    setError(null);
    try {
      const res = await fetch(`/api/compra-legal/${idCl}/rechazar-pp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pp_id: ppId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      setSuccess(json.message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setAccionando(false);
    }
  }

  const h = data?.header;
  const badge = h ? CL_ESTADO_COLOR[h.estado] ?? { bg: "#F1F5F9", fg: "#475569" } : null;
  const pctF9 = h && h.total_pares_f9 > 0 ? Math.round((h.pares_facturados / h.total_pares_f9) * 100) : 0;

  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusGlobalHeader active="compra-legal" />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Link href={COMPRA_LEGAL} className="text-sm font-semibold text-rimec-azul hover:underline">
          ← Bandeja Compra legal
        </Link>

        {loading && <p className="mt-8 text-neutral-600">Cargando detalle…</p>}

        {!loading && !h && (
          <p className="mt-8 text-red-700">Compra legal no encontrada (id={idCl}).</p>
        )}

        {h && badge && (
          <>
            <div className="mt-6 border-b-2 border-neutral-300 bg-card-bg py-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-rimec-azul/70">2.3.1.8 · Detalle CL</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="font-serif text-4xl font-light text-rimec-azul-dark">{h.numero_registro}</h1>
                <span
                  className="rounded-full px-3 py-1 text-sm font-bold"
                  style={{ backgroundColor: badge.bg, color: badge.fg }}
                >
                  {CL_ESTADO_LABEL[h.estado] ?? h.estado}
                </span>
              </div>
              <p className="mt-2 text-neutral-700">
                Proforma {h.proforma} · {h.fecha_factura ?? "—"} · PPs: {h.pps_vinculados}
              </p>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-4">
              {[
                { label: "Pares F9", value: h.total_pares_f9 },
                { label: "Facturados", value: h.pares_facturados },
                { label: "En depósito (KPI)", value: h.pares_deposito },
                { label: "% facturado", value: `${pctF9}%` },
              ].map((k) => (
                <div key={k.label} className="rounded-xl border-2 border-neutral-300 bg-white px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{k.label}</p>
                  <p className="mt-1 font-serif text-2xl tabular-nums text-rimec-azul-dark">
                    {typeof k.value === "number" ? k.value.toLocaleString("es-PY") : k.value}
                  </p>
                </div>
              ))}
            </div>

            {(h.estado === "PENDIENTE" || h.estado === "BORRADOR") && (
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={accionando}
                  onClick={finalizar}
                  className="rounded-lg bg-rimec-azul px-5 py-2.5 text-sm font-bold text-white hover:bg-rimec-azul-dark disabled:opacity-50"
                >
                  Finalizar y Distribuir
                </button>
              </div>
            )}

            {h.estado === "DISTRIBUIDA" && (
              <p className="mt-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                Compra distribuida — continúe en{" "}
                <Link href="/facturacion" className="font-semibold underline">
                  Facturación (2.3.1.9)
                </Link>{" "}
                para enviar FAC-INT a Web Bazar.
              </p>
            )}

            {error && (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
            )}
            {success && (
              <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                {success}
              </p>
            )}

            <div className="mt-8 flex gap-2 border-b border-neutral-300">
              {(
                [
                  ["pps", "PPs recibidos"],
                  ["deposito", "Depósito RIMEC"],
                  ["facturas", "Facturas internas"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`px-4 py-2 text-sm font-semibold ${
                    tab === key
                      ? "border-b-2 border-rimec-azul text-rimec-azul"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "pps" && (
              <div className="mt-4 overflow-x-auto rounded-xl border-2 border-neutral-300 bg-white">
                <table className="min-w-full text-sm">
                  <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-600">
                    <tr>
                      <th className="px-4 py-3">PP</th>
                      <th className="px-4 py-3">Marcas</th>
                      <th className="px-4 py-3 text-right">Pares</th>
                      <th className="px-4 py-3 text-right">Vendido</th>
                      <th className="px-4 py-3">Estado</th>
                      {h.estado === "PENDIENTE" && <th className="px-4 py-3" />}
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.pps ?? []).map((pp) => (
                      <tr key={pp.id} className="border-t border-neutral-200">
                        <td className="px-4 py-2 font-medium">{pp.numero_registro}</td>
                        <td className="px-4 py-2">{pp.marcas}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{pp.total_pares.toLocaleString("es-PY")}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{pp.total_vendido.toLocaleString("es-PY")}</td>
                        <td className="px-4 py-2">{pp.estado}</td>
                        {h.estado === "PENDIENTE" && (
                          <td className="px-4 py-2">
                            <button
                              type="button"
                              disabled={accionando}
                              onClick={() => rechazarPp(pp.id)}
                              className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-50"
                            >
                              Rechazar
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === "deposito" && (
              <div className="mt-4 overflow-x-auto rounded-xl border-2 border-neutral-300 bg-white">
                <table className="min-w-full text-sm">
                  <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-600">
                    <tr>
                      <th className="px-3 py-2">Marca</th>
                      <th className="px-3 py-2">L+R</th>
                      <th className="px-3 py-2">Material</th>
                      <th className="px-3 py-2">Color</th>
                      <th className="px-3 py-2 text-right">Inicial</th>
                      <th className="px-3 py-2 text-right">Vendido</th>
                      <th className="px-3 py-2 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.deposito ?? []).map((r, i) => (
                      <tr key={i} className="border-t border-neutral-200">
                        <td className="px-3 py-1.5">{r.marca}</td>
                        <td className="px-3 py-1.5 tabular-nums">
                          {r.linea}.{r.referencia}
                        </td>
                        <td className="px-3 py-1.5">{r.material}</td>
                        <td className="px-3 py-1.5">{r.color}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{r.cantidad_inicial}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{r.vendido}</td>
                        <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{r.saldo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === "facturas" && (
              <div className="mt-6 space-y-6">
                {(data?.facturas ?? []).map((fi) => (
                  <CompraWebFiPanel
                    key={fi.id}
                    fi={{
                      id: fi.id,
                      nro_factura: fi.nro_factura,
                      pv_global: fi.pv_global,
                      estado: fi.estado,
                      created_at: fi.created_at,
                      pp_id: fi.pp_id,
                      nro_pp: fi.nro_pp,
                      marca: fi.marca,
                      caso: fi.caso,
                      cliente: fi.cliente,
                      vendedor: fi.vendedor,
                      total_pares: fi.total_pares,
                      total_monto: fi.total_monto,
                      lista_precio_id: fi.lista_precio_id,
                      descuento_1: fi.descuento_1,
                      descuento_2: fi.descuento_2,
                      descuento_3: fi.descuento_3,
                      descuento_4: fi.descuento_4,
                    }}
                    detalles={data?.fiDetalles?.[String(fi.id)] ?? data?.fiDetalles?.[fi.id] ?? []}
                  />
                ))}
                {!data?.facturas?.length && (
                  <p className="text-neutral-600">Sin FAC-INT confirmadas/reservadas en esta compra.</p>
                )}
              </div>
            )}
          </>
        )}
      </main>
      <ReportFooter note={`Compra legal · CL #${idCl} · 2.3.1.8`} />
    </div>
  );
}
