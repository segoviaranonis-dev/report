"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CompraWebFiPanel } from "@/app/bazzar-web/compra/components/CompraWebFiPanel";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import { TRP_ESTADO_COLOR, TRP_ESTADO_LABEL } from "@/lib/rimec-abastecimiento/constants";
import { agruparFacturasPorFecha } from "@/lib/facturacion/utils";
import type { OrigenFacturacion } from "@/lib/facturacion/filters";
import type { FacturaKpis, FacturaListItem } from "@/lib/facturacion/types";
import { TERMINO_FI } from "@/lib/facturacion/types";
import type { FiDetalleCanonico, FiRegistroRow } from "@/lib/bazzar-web/compra-web/types";
import { FACTURACION } from "@/lib/report/routes";
import { fiDisplayId, ppDisplay } from "@/app/aprobaciones/lib/aprobaciones-utils";

type Props = {
  origen: OrigenFacturacion;
  titulo: string;
  subtitulo: string;
  badgeOrigen: string;
  groupByDate?: boolean;
  footerNote: string;
};

function fmtGs(n: number | null | undefined): string {
  return `Gs. ${Math.round(Number(n) || 0).toLocaleString("es-PY")}`;
}

export function FacturacionBandejaClient({
  origen,
  titulo,
  subtitulo,
  badgeOrigen,
  groupByDate = false,
  footerNote,
}: Props) {
  const [facturas, setFacturas] = useState<FacturaListItem[]>([]);
  const [kpis, setKpis] = useState<FacturaKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [fiDetail, setFiDetail] = useState<{
    fi: FiRegistroRow;
    detalles: FiDetalleCanonico[];
  } | null>(null);

  const apiUrl = `/api/facturacion?origen=${origen}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      if (data.configured === false) {
        setConfigured(false);
        return;
      }
      setConfigured(true);
      setFacturas(data.facturas ?? []);
      setKpis(data.kpis ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    load();
  }, [load]);

  const grupos = useMemo(
    () => (groupByDate ? agruparFacturasPorFecha(facturas) : [{ fecha: "", facturas }]),
    [facturas, groupByDate],
  );

  async function loadFiDetail(facturaLegacy: string) {
    setExpanded(facturaLegacy);
    setFiDetail(null);
    try {
      const res = await fetch(`/api/facturacion/${encodeURIComponent(facturaLegacy)}`);
      const data = await res.json();
      if (res.ok && data.fi) {
        setFiDetail({ fi: data.fi, detalles: data.detalles ?? [] });
      }
    } catch {
      /* opcional */
    }
  }

  async function enviarWeb(f: FacturaListItem) {
    const displayId = fiDisplayId({ pv_global: f.pv_global, nro_factura: f.factura_legacy });
    if (!confirm(`¿Enviar ${displayId} (${TERMINO_FI}) a Web Bazar (cliente 5000)?`)) return;
    setEnviando(f.factura_legacy);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/facturacion/${encodeURIComponent(f.factura_legacy)}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setSuccess(data.message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setEnviando(null);
    }
  }

  const puedeEnviar = (estado: string) => estado === "SIN_TRASPASO" || estado === "BORRADOR";

  function renderFacturaRow(f: FacturaListItem) {
    const badge = TRP_ESTADO_COLOR[f.traspaso_estado] ?? TRP_ESTADO_COLOR.SIN_TRASPASO;
    const isOpen = expanded === f.factura_legacy;
    const displayId = fiDisplayId({ pv_global: f.pv_global, nro_factura: f.factura_legacy });
    const legacy = f.factura_legacy;
    const esPe = origen === "pronta-entrega";
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

    return (
      <article key={`${f.factura}-${f.pedido}`} className="rounded-xl border-2 border-neutral-300 bg-card-bg overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-rimec-azul px-3 py-1.5 text-sm font-bold tabular-nums text-white shadow-sm">
                {displayId}
              </span>
              <span className="rounded-lg border-2 border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-800">
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
              {legacy && legacy !== displayId && (
                <span className="rounded-lg border border-dashed border-neutral-400 bg-neutral-50 px-2.5 py-1.5 text-xs font-medium text-neutral-600">
                  {TERMINO_FI} {legacy}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-neutral-600">
              {f.marca} · {f.cliente} · {f.pares.toLocaleString("es-PY")} pares
              {!esPe && f.compra !== "—" ? ` · CL ${f.compra}` : ""}
              {f.total_monto != null && f.total_monto > 0 ? ` · ${fmtGs(f.total_monto)}` : ""}
            </p>
            <p className="text-xs text-neutral-500">
              {esPe ? "Stock importado · PPD vía detalle" : `${TERMINO_FI} · PP ${f.pedido}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-3 py-1 text-xs font-bold"
              style={{ backgroundColor: badge.bg, color: badge.fg }}
            >
              {TRP_ESTADO_LABEL[f.traspaso_estado] ?? f.traspaso_estado}
            </span>
            <button
              type="button"
              onClick={() => (isOpen ? setExpanded(null) : loadFiDetail(f.factura_legacy))}
              className="rounded-lg border border-neutral-400 px-3 py-1.5 text-xs font-semibold hover:bg-neutral-50"
            >
              {isOpen ? "Cerrar FI" : `Ver ${TERMINO_FI}`}
            </button>
            {puedeEnviar(f.traspaso_estado) && (
              <button
                type="button"
                disabled={enviando === f.factura_legacy}
                onClick={() => enviarWeb(f)}
                className="rounded-lg bg-[#F97316] px-4 py-1.5 text-xs font-bold text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {enviando === f.factura_legacy ? "Enviando…" : "Enviar Web Bazar"}
              </button>
            )}
          </div>
        </div>
        {isOpen && fiDetail && fiDetail.fi.nro_factura === f.factura_legacy && (
          <div className="border-t border-neutral-300 p-4">
            <CompraWebFiPanel fi={fiDetail.fi} detalles={fiDetail.detalles} />
          </div>
        )}
      </article>
    );
  }

  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusGlobalHeader active="facturacion" />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Link href={FACTURACION} className="text-sm font-semibold text-rimec-azul hover:underline">
          ← Facturación (hub)
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-rimec-azul/70">
          2.3.1.9 · {badgeOrigen}
        </p>
        <h1 className="mt-2 font-serif text-3xl text-rimec-azul-dark">{titulo}</h1>
        <p className="mt-2 max-w-3xl text-neutral-700">{subtitulo}</p>

        {!configured && (
          <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            DATABASE_URL no configurada.
          </p>
        )}

        {kpis && (
          <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
            {[
              { l: `Total ${TERMINO_FI}`, v: kpis.total },
              { l: "Reservadas", v: kpis.reservadas ?? 0 },
              { l: "Confirmadas", v: kpis.confirmadas_fi ?? 0 },
              { l: "Sin traspaso", v: kpis.sin_traspaso },
              { l: "Borrador", v: kpis.borrador },
              { l: "Enviados", v: kpis.enviado },
              { l: "Trasp. OK", v: kpis.confirmado },
            ].map((k) => (
              <div key={k.l} className="rounded-lg border-2 border-neutral-300 bg-white px-3 py-2">
                <p className="text-[10px] font-bold uppercase text-neutral-500">{k.l}</p>
                <p className="text-xl font-semibold tabular-nums">{k.v}</p>
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        )}
        {success && (
          <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {success}
          </p>
        )}

        {loading ? (
          <p className="mt-8 text-neutral-600">Cargando bandeja…</p>
        ) : (
          <div className="mt-8 space-y-8">
            {grupos.map((g) => (
              <section key={g.fecha || "all"}>
                {groupByDate && g.fecha && (
                  <h2 className="mb-3 border-b border-neutral-300 pb-2 font-serif text-xl text-rimec-azul-dark">
                    {g.fecha}
                    <span className="ml-2 text-sm font-normal text-neutral-500">
                      ({g.facturas.length} {TERMINO_FI}
                      {g.facturas.length === 1 ? "" : "s"})
                    </span>
                  </h2>
                )}
                <div className="space-y-4">{g.facturas.map(renderFacturaRow)}</div>
              </section>
            ))}
            {!facturas.length && configured && (
              <p className="text-neutral-600">
                {origen === "pronta-entrega" ? (
                  <>
                    No hay {TERMINO_FI} de Pronta entrega. Confirmá ventas PE en{" "}
                    <Link href="/aprobaciones" className="font-semibold text-rimec-azul underline">
                      Aprobaciones
                    </Link>{" "}
                    y volvé a refrescar.
                  </>
                ) : (
                  <>
                    No hay {TERMINO_FI} en compras DISTRIBUIDA/CERRADA. Finalizá en{" "}
                    <Link href="/compra-legal" className="font-semibold text-rimec-azul underline">
                      Compra legal
                    </Link>
                    .
                  </>
                )}
              </p>
            )}
          </div>
        )}
      </main>
      <ReportFooter note={footerNote} />
    </div>
  );
}
