"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PpDetalleHeader } from "@/lib/pedido-proveedor/detail-query";
import type {
  IcAdminRow,
  PfArticuloRow,
  PreFacturaInterna,
} from "@/lib/pedido-proveedor/administrador-ic-query";
import {
  evalProtocoloChusa,
  marcaAlineacionPrefactura,
  montoFiConDescuentosIc,
  parejaTripleteIcPf,
  recalcPfConTier,
  canonDiffsPorIndice,
  cmpAdminFilasLote,
  tieneDesajusteCanon,
  type CanonDiffCelda,
} from "@/lib/pedido-proveedor/administrador-ic-monto";
import { fiListaTier } from "@/lib/pedido-proveedor/aritmetica-programado";
import {
  LISTADO_PRECIO_TIERS,
  type ListadoPrecioTierId,
} from "@/lib/intencion-compra/listado-precio-tiers";
import { pedidoProveedorDetalle } from "@/lib/report/routes";
import { ProcesoImportacionWaitOverlay } from "@/components/report/ProcesoImportacionWaitOverlay";
import { ChusaLoteCelebracionOverlay } from "@/components/report/ChusaLoteCelebracionOverlay";
import { ProductThumbFrame } from "@/components/product/ProductThumbFrame";

type Props = {
  pp: PpDetalleHeader;
  ppId: string;
  onMsg: (msg: string | null) => void;
  onReload?: () => void | Promise<void>;
};

function msgFromUnknown(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "Error";
}

const CABECERA_GRID =
  "grid-cols-[2.5rem_minmax(0,0.85fr)_minmax(0,1fr)_2rem_minmax(0,0.65fr)_minmax(0,1fr)_2.5rem_0.9rem_1.1rem]";

const CANON_ERR =
  "rounded bg-red-200 font-bold text-red-950 ring-2 ring-red-500 shadow-sm animate-pulse";

function clsCanon(ok: boolean | undefined) {
  return ok ? CANON_ERR : "";
}

function fmtMonto(n: number) {
  return n.toLocaleString("es-PY", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/** Compacto D1+D2+… para grilla Admin IC */
function fmtDescCompact(d1: number, d2: number, d3: number, d4: number) {
  const labels = ["D1", "D2", "D3", "D4"];
  const parts = [d1, d2, d3, d4]
    .map((d, i) => ({ v: Number(d) || 0, lab: labels[i] }))
    .filter((x) => x.v > 0)
    .map((x) => `${x.lab}:${x.v}`);
  return parts.length ? parts.join(" ") : "—";
}

function CabeceraFila({
  tone,
  codCliente,
  colRef,
  marca,
  lp,
  monto,
  montoSecundario,
  pares,
  descLabel,
  canonDiff,
  canonHint,
  expanded,
  onToggleExpand,
  expandable,
  lpEditable,
  lpLocked,
  lpValue,
  onLpChange,
}: {
  tone: "ic" | "pf";
  codCliente: number | string;
  colRef: string;
  marca: string;
  lp: string;
  monto: number;
  montoSecundario?: number | null;
  pares: number;
  /** Compacto D1+D2+… (IC / Pre-FI). */
  descLabel?: string;
  canonDiff?: CanonDiffCelda | null;
  /** Valor canon del otro panel (tooltip al corregir IC). */
  canonHint?: { cliente?: string | number; marca?: string; cantidad?: number };
  expanded?: boolean;
  onToggleExpand?: () => void;
  expandable?: boolean;
  lpEditable?: boolean;
  lpLocked?: boolean;
  lpValue?: ListadoPrecioTierId;
  onLpChange?: (tier: ListadoPrecioTierId) => void;
}) {
  const bg =
    tone === "ic"
      ? canonDiff && tieneDesajusteCanon(canonDiff)
        ? "border-red-400 bg-red-50/80"
        : "border-slate-300 bg-slate-100"
      : canonDiff && tieneDesajusteCanon(canonDiff)
        ? "border-red-400 bg-red-50/80"
        : "border-orange-300 bg-orange-50";

  const rowTitle =
    canonDiff && tieneDesajusteCanon(canonDiff)
      ? tone === "ic"
        ? `Canon ≠ proforma — corregí esta IC (cliente · marca · cant.)${canonHint ? ` · PF: ${canonHint.cliente ?? "?"} · ${canonHint.marca ?? "?"} · ${canonHint.cantidad ?? "?"}p` : ""}`
        : `Canon ≠ IC en esta fila — la proforma no se edita`
      : "Fila alineada · Protocolo Chusa";

  return (
    <div
      className={`grid h-9 w-full min-w-0 ${CABECERA_GRID} items-center gap-1 border px-1 text-[10px] leading-tight sm:h-10 sm:text-[11px] ${bg}`}
      title={rowTitle}
    >
      <span
        className={`truncate font-mono font-bold ${clsCanon(canonDiff?.sinPar || canonDiff?.cliente)}`}
        title={canonHint?.cliente != null ? `Proforma/IC esperado: ${canonHint.cliente}` : undefined}
      >
        {codCliente}
      </span>
      <span className="truncate text-[9px] font-semibold text-slate-700" title={colRef}>
        {colRef}
      </span>
      <span
        className={`truncate font-semibold ${clsCanon(canonDiff?.sinPar || canonDiff?.marca)}`}
        title={canonHint?.marca ? `Canon proforma: ${canonHint.marca}` : marca}
      >
        {marca}
      </span>
      <span
        className={`truncate text-right tabular-nums font-bold ${clsCanon(canonDiff?.sinPar || canonDiff?.cantidad)}`}
        title={canonHint?.cantidad != null ? `Canon proforma: ${canonHint.cantidad} pares` : undefined}
      >
        {pares}
      </span>
      <span
        className="truncate text-center text-[9px] font-bold tabular-nums text-amber-900"
        title={`Descuentos IC: ${descLabel ?? "—"}`}
      >
        {descLabel && descLabel !== "—" ? descLabel : "—"}
      </span>
      <span
        className="min-w-0 truncate text-right tabular-nums"
        title={
          [
            montoSecundario != null && Math.abs(montoSecundario - monto) > 1
              ? `Sin desc.: ${fmtMonto(monto)} · con desc. IC: ${fmtMonto(montoSecundario)}`
              : `Monto bruto ${fmtMonto(monto)}`,
          ]
            .filter(Boolean)
            .join(" · ")
        }
      >
        <span className="block font-bold leading-tight">{fmtMonto(monto)}</span>
      </span>
      {lpEditable && lpValue != null && onLpChange && !lpLocked ? (
        <select
          className="w-full truncate rounded border border-orange-400 bg-white px-0.5 py-0.5 text-[8px] font-bold"
          value={lpValue}
          title={lp}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onLpChange(Number(e.target.value) as ListadoPrecioTierId)}
        >
          {LISTADO_PRECIO_TIERS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      ) : (
        <span
          className={`truncate text-[9px] font-semibold ${lpLocked ? "text-emerald-800" : "text-slate-700"}`}
          title={lpLocked ? `LP heredado de IC · ${lp}` : lp}
        >
          {lpLocked ? "🔒 " : ""}
          {lp}
        </span>
      )}
      {expandable ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand?.();
          }}
          className="rounded px-1 text-xs font-bold text-orange-900 hover:bg-orange-200"
          title="Ver artículos de la proforma"
        >
          {expanded ? "▾" : "▸"}
        </button>
      ) : (
        <span className="w-4" />
      )}
    </div>
  );
}

function ArticuloFila({ art }: { art: PfArticuloRow }) {
  return (
    <div
      className="ml-2 grid grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-2 border border-dashed border-orange-300 bg-white px-2 py-1 text-[10px]"
      title="Detalle artículo proforma"
    >
      <ProductThumbFrame
        alt={`${art.linea}-${art.referencia}-${art.material_code}-${art.color_code}`}
        candidates={art.imageCandidates}
        size={40}
      />
      <div className="grid grid-cols-6 gap-1">
        <span className="truncate" title="Línea">
          <strong>L</strong> {art.linea}
        </span>
        <span className="truncate font-semibold text-orange-900" title="Caso motor precios">
          {art.caso && art.caso !== "—" ? art.caso : "—"}
        </span>
        <span className="truncate" title="Referencia">
          <strong>R</strong> {art.referencia}
        </span>
        <span className="truncate" title="Material">
          <strong>M</strong> {art.material_code || art.material}
        </span>
        <span className="truncate" title="Color">
          <strong>C</strong> {art.color_code || art.color}
        </span>
        <span className="truncate" title="Grada">
          <strong>G</strong> {art.grada ?? "—"} · {art.pares}p
        </span>
      </div>
    </div>
  );
}

export function PpTabAdministradorIc({ pp, ppId, onMsg, onReload }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [ics, setIcs] = useState<IcAdminRow[]>([]);
  const [prefacturas, setPrefacturas] = useState<PreFacturaInterna[]>([]);
  const [expandedPf, setExpandedPf] = useState<Set<string>>(new Set());
  const [filtroCliente, setFiltroCliente] = useState<string>("");
  const [pfTierOverrides, setPfTierOverrides] = useState<Record<string, ListadoPrecioTierId>>({});
  const [generandoFiKey, setGenerandoFiKey] = useState<string | null>(null);
  const [celebracion, setCelebracion] = useState<{ total: number } | null>(null);
  const [nFiServidor, setNFiServidor] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/proceso-importacion/pedido-proveedor/${ppId}/administrador-ic`, {
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error cargando datos");
      setIcs(data.ics ?? []);
      setPrefacturas(data.prefacturas ?? []);
    } catch (e) {
      onMsg(msgFromUnknown(e));
    } finally {
      setLoading(false);
    }
  }, [ppId, onMsg]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    fetch(`/api/proceso-importacion/pedido-proveedor/${ppId}/completar-fi`, {
      credentials: "same-origin",
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setNFiServidor(Number(d.n_fi ?? 0));
      })
      .catch(() => setNFiServidor(null));
  }, [ppId, pp.n_facturas_internas, generandoFiKey]);

  const clientes = useMemo(() => {
    const set = new Set<number>();
    for (const ic of ics) set.add(ic.id_cliente);
    for (const pf of prefacturas) set.add(pf.id_cliente);
    return [...set].sort((a, b) => a - b);
  }, [ics, prefacturas]);

  const icsVisibles = useMemo(() => {
    const list = filtroCliente
      ? ics.filter((i) => i.id_cliente === Number(filtroCliente))
      : [...ics];
    return list.sort((a, b) =>
      cmpAdminFilasLote(
        a.id_cliente,
        a.marca,
        a.pares,
        a.monto_ic,
        a.nro_ic,
        b.id_cliente,
        b.marca,
        b.pares,
        b.monto_ic,
        b.nro_ic,
      ),
    );
  }, [ics, filtroCliente]);

  const pfTierAutoIc = useMemo(() => {
    const out: Record<string, ListadoPrecioTierId> = {};
    const icPorPf = new Map<string, IcAdminRow>();
    for (const pf of prefacturas) {
      const ic = ics.find((i) => parejaTripleteIcPf(i, pf));
      if (ic) {
        out[pf.pf_key] = ic.listado_tier;
        icPorPf.set(pf.pf_key, ic);
      }
    }
    return { tiers: out, icPorPf };
  }, [ics, prefacturas]);

  const pfConTier = useMemo(() => {
    return prefacturas.map((pf) => {
      const autoTier = pfTierAutoIc.tiers[pf.pf_key];
      const tier = autoTier ?? pfTierOverrides[pf.pf_key] ?? pf.listado_tier;
      if (tier === pf.listado_tier && !autoTier && !pfTierOverrides[pf.pf_key]) return pf;
      return recalcPfConTier(pf, tier);
    });
  }, [prefacturas, pfTierOverrides, pfTierAutoIc.tiers]);

  const pfVisibles = useMemo(() => {
    const list = filtroCliente
      ? pfConTier.filter((p) => p.id_cliente === Number(filtroCliente))
      : [...pfConTier];
    return list.sort((a, b) =>
      cmpAdminFilasLote(
        a.id_cliente,
        marcaAlineacionPrefactura(a, ics),
        a.total_pares,
        a.total_monto,
        a.caso,
        b.id_cliente,
        marcaAlineacionPrefactura(b, ics),
        b.total_pares,
        b.total_monto,
        b.caso,
      ),
    );
  }, [pfConTier, filtroCliente, ics]);

  const generandoFi = generandoFiKey != null;

  const protocoloChusa = useMemo(
    () => evalProtocoloChusa(icsVisibles, pfVisibles, ics),
    [icsVisibles, pfVisibles, ics],
  );

  const nFiEfectivo = Math.max(pp.n_facturas_internas, nFiServidor ?? 0);
  const fiEsperadas = protocoloChusa.contadorIc;

  const loteExacto = useMemo(
    () => protocoloChusa.nivel1 && fiEsperadas > 0 && nFiEfectivo === fiEsperadas,
    [protocoloChusa.nivel1, fiEsperadas, nFiEfectivo],
  );

  const fiExceso = useMemo(
    () => fiEsperadas > 0 && nFiEfectivo > fiEsperadas,
    [fiEsperadas, nFiEfectivo],
  );

  const fiPendientes = useMemo(
    () => fiEsperadas > 0 && nFiEfectivo < fiEsperadas,
    [fiEsperadas, nFiEfectivo],
  );

  /** IC=PF alineados (Chusa N1+N2) — botón maestro verde manda sobre FI obsoletas. */
  const chusaListo = protocoloChusa.puedeLote;
  const fiDesincronizado = fiExceso || fiPendientes;
  const botonMaestroVerde = chusaListo && (fiDesincronizado || loteExacto);

  const canonDiffs = useMemo(
    () => canonDiffsPorIndice(icsVisibles, pfVisibles, ics),
    [icsVisibles, pfVisibles, ics],
  );

  async function irAFi() {
    setCelebracion(null);
    await onReload?.();
    router.push(pedidoProveedorDetalle(ppId, "fi"));
  }

  function mostrarCelebracionCompleta() {
    if (!loteExacto) return;
    setCelebracion({ total: nFiEfectivo });
  }

  async function patchIcListado(icId: number, tier: ListadoPrecioTierId) {
    try {
      const res = await fetch(`/api/proceso-importacion/intencion-compra/${icId}/campo`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campo: "listado_precio_id", valor: tier }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo actualizar listado IC");
      await load();
      onMsg(`Listado IC → ${LISTADO_PRECIO_TIERS.find((t) => t.id === tier)?.label ?? tier}`);
    } catch (e) {
      onMsg(msgFromUnknown(e));
    }
  }

  async function generarFiLote(opts?: { regenerar?: boolean }) {
    const regenerar = opts?.regenerar === true || nFiEfectivo > 0;
    if (loteExacto && !regenerar) {
      mostrarCelebracionCompleta();
      return;
    }
    if (!protocoloChusa.puedeLote) {
      onMsg("Protocolo Chusa: contadores o canon no cuadran.");
      return;
    }
    setGenerandoFiKey("lote");
    try {
      const res = await fetch(
        `/api/proceso-importacion/pedido-proveedor/${ppId}/administrador-ic/generar-fi-lote`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ regenerar }),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (data.fi_exceso) {
          throw new Error(data.error || `FI de más (${data.n_fi} vs ${data.n_esperadas} IC)`);
        }
        const icHint = data.fallo_ic_nro
          ? ` · ${data.fallo_ic_nro}`
          : data.fallo_ic_id != null
            ? ` · IC id ${data.fallo_ic_id}`
            : "";
        const parcial =
          Array.isArray(data.generadas) && data.generadas.length
            ? ` · ${data.generadas.length} FI parciales antes del fallo`
            : "";
        throw new Error((data.error || "Error en lote FI") + icHint + parcial);
      }

      const total = Number(data.total ?? data.generadas?.length ?? protocoloChusa.contadorIc);
      if (data.already_done && total === fiEsperadas && !regenerar) {
        onMsg(`✓ Lote completo: ${total} FI = ${fiEsperadas} IC`);
      } else if (data.regenerado) {
        onMsg(`✓ Regeneradas ${data.generadas_en_lote ?? total} FI desde prefactura actual`);
      }
      await load();
      await onReload?.();
      setNFiServidor(total);
      if (total === fiEsperadas) {
        setCelebracion({ total });
      } else if (total > fiEsperadas) {
        onMsg(`Atención: ${total} FI vs ${fiEsperadas} IC — revisá duplicados en tab FI.`);
      }
    } catch (e) {
      onMsg(msgFromUnknown(e));
    } finally {
      setGenerandoFiKey(null);
    }
  }

  if (loading) {
    return (
      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Cargando Administrador de IC…
      </section>
    );
  }

  if (pp.total_articulos === 0) {
    return (
      <section className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">
        Importá la proforma en <strong>Importación / Stock</strong> antes de vincular IC con Pre-Facturas.
      </section>
    );
  }

  return (
    <section className="mt-4 space-y-3 overflow-x-hidden">
      <ProcesoImportacionWaitOverlay
        open={generandoFiKey === "lote"}
        title={`Generando ${protocoloChusa.contadorIc} facturas internas`}
        detail={`${pp.numero_registro} · Protocolo Chusa · IC = Proforma`}
        hint="~2 minutos · no cierres la pestaña"
      />
      <ChusaLoteCelebracionOverlay
        open={celebracion != null}
        total={celebracion?.total ?? 0}
        ppLabel={pp.numero_registro}
        onVerFi={irAFi}
      />

      <div className="rounded-xl border-2 border-yellow-400 bg-yellow-50 px-4 py-2">
        <h2 className="text-sm font-bold text-yellow-950">⚖ Administrador de IC · Protocolo Chusa</h2>
        <p className="mt-1 text-xs text-yellow-900">
          <strong>Cabecera:</strong> IC = PF = FI (115 filas · cliente · marca · pares por fila).{" "}
          <strong>Molécula:</strong> Saldo = pares F9 sin asignar a FI ({pp.pares_comprometidos.toLocaleString("es-PY")} pares IC · {pp.total_articulos} artículos).{" "}
          <strong className="text-red-800">Rojo pulsante = corregí la IC</strong> en ICs Asignadas.
        </p>
        {canonDiffs.desajustes > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border-2 border-red-500 bg-red-100 px-3 py-2 text-xs text-red-950">
            <span className="font-bold">
              {canonDiffs.desajustes} fila{canonDiffs.desajustes === 1 ? "" : "s"} con canon ≠ — error
              vendedor · subsaná editando la IC
            </span>
            <Link
              href={`/proceso-importacion/pedido-proveedor/${ppId}?tab=ics`}
              className="rounded bg-white px-2 py-1 font-bold text-rimec-azul underline hover:bg-red-50"
            >
              Ir a ICs Asignadas →
            </Link>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label className="font-semibold text-slate-600">Filtrar cliente:</label>
        <select
          className="rounded border border-slate-300 px-2 py-1"
          value={filtroCliente}
          onChange={(e) => setFiltroCliente(e.target.value)}
        >
          <option value="">Todos ({clientes.length})</option>
          {clientes.map((c) => (
            <option key={c} value={String(c)}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Acción única — lote Chusa */}
      <div className="flex justify-center">
        <div
          className={`w-full max-w-xl rounded-xl border-4 px-6 py-5 text-center shadow-lg ${
            botonMaestroVerde || (chusaListo && nFiEfectivo === 0)
              ? "border-emerald-500 bg-gradient-to-b from-emerald-50 to-white"
              : fiExceso
                ? "border-amber-500 bg-amber-50"
                : loteExacto
                  ? "border-emerald-500 bg-emerald-50"
                  : chusaListo
                    ? "border-emerald-500 bg-gradient-to-b from-emerald-50 to-white"
                    : "border-slate-300 bg-slate-50"
          }`}
        >
          <div className="flex flex-wrap items-center justify-center gap-3">
            <span className="rounded-lg border-2 border-red-500 bg-white px-4 py-2 text-lg font-bold tabular-nums text-red-900">
              IC {protocoloChusa.contadorIc}
            </span>
            <span className="text-2xl text-emerald-700">=</span>
            <span className="rounded-lg border-2 border-red-500 bg-white px-4 py-2 text-lg font-bold tabular-nums text-red-900">
              PF {protocoloChusa.contadorPf}
            </span>
            {fiEsperadas > 0 && (
              <>
                <span className="text-xl text-slate-400">→</span>
                <span
                  className={`rounded-lg border-2 px-4 py-2 text-lg font-bold tabular-nums ${
                    fiExceso
                      ? "border-amber-600 bg-amber-100 text-amber-950"
                      : loteExacto
                        ? "border-emerald-600 bg-emerald-100 text-emerald-950"
                        : fiPendientes
                          ? "border-amber-400 bg-white text-amber-900"
                          : "border-slate-300 bg-white text-slate-700"
                  }`}
                >
                  FI {nFiEfectivo}
                  {fiExceso ? ` (+${nFiEfectivo - fiEsperadas})` : fiPendientes ? ` / ${fiEsperadas}` : ""}
                </span>
              </>
            )}
          </div>

          {botonMaestroVerde ? (
            <>
              {fiExceso ? (
                <p className="mt-4 text-sm font-bold text-emerald-900">
                  IC=PF={fiEsperadas} · hay {nFiEfectivo} FI ({nFiEfectivo - fiEsperadas} de más) — un clic
                  borra RESERVADA y rehace el lote
                </p>
              ) : fiPendientes ? (
                <p className="mt-4 text-sm font-bold text-emerald-900">
                  Faltan {fiEsperadas - nFiEfectivo} FI · IC=PF alineados — regenerá el lote completo
                </p>
              ) : (
                <p className="mt-4 text-sm font-bold text-emerald-900">
                  ✓ {nFiEfectivo} FI = {fiEsperadas} IC · revisá montos vs prefactura
                </p>
              )}
              {pp.saldo > 0 && loteExacto ? (
                <p className="mt-2 rounded-lg border-2 border-amber-500 bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-950">
                  Saldo {pp.saldo.toLocaleString("es-PY")} pares sin reservar — tras el lote debería quedar 0.
                </p>
              ) : null}
              <button
                type="button"
                disabled={generandoFi}
                onClick={() =>
                  void generarFiLote({ regenerar: fiExceso || fiPendientes || nFiEfectivo > 0 })
                }
                className="mt-4 w-full rounded-xl bg-emerald-600 px-6 py-4 text-sm font-bold uppercase tracking-wide text-white shadow-lg hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {generandoFiKey === "lote"
                  ? "Regenerando… (~2 min)"
                  : fiExceso
                    ? `Regenerar ${fiEsperadas} facturas · borrar ${nFiEfectivo - fiEsperadas} de más`
                    : fiPendientes
                      ? `Regenerar ${fiEsperadas} facturas · un clic`
                      : `Recalcular ${nFiEfectivo} facturas desde proforma`}
              </button>
              {loteExacto ? (
                <button
                  type="button"
                  onClick={mostrarCelebracionCompleta}
                  className="mt-2 w-full rounded-lg border border-emerald-600 bg-white px-4 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
                >
                  Ver tab Facturas Internas →
                </button>
              ) : null}
            </>
          ) : fiExceso ? (
            <>
              <p className="mt-4 text-sm font-bold text-amber-950">
                ⚠ {nFiEfectivo - fiEsperadas} factura{nFiEfectivo - fiEsperadas === 1 ? "" : "s"} de más
              </p>
              <p className="mt-1 text-xs text-amber-900">
                IC={protocoloChusa.contadorIc} · PF={protocoloChusa.contadorPf} · FI={nFiEfectivo} — corregí IC/PF
                en paneles antes de regenerar.
              </p>
              <button
                type="button"
                onClick={() => void irAFi()}
                className="mt-4 w-full rounded-xl bg-amber-600 px-6 py-3 text-sm font-bold uppercase tracking-wide text-white shadow hover:bg-amber-700"
              >
                Ir a Facturas Internas →
              </button>
            </>
          ) : loteExacto ? (
            <>
              <p className="mt-4 text-sm font-bold text-emerald-900">
                ✓ {nFiEfectivo} FI = {fiEsperadas} IC · revisá montos vs prefactura
              </p>
              {pp.saldo > 0 ? (
                <p className="mt-2 rounded-lg border-2 border-amber-500 bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-950">
                  Saldo {pp.saldo.toLocaleString("es-PY")} pares sin reservar — tras el lote debería quedar 0. Líneas sin LPN van en FI con borde ámbar.
                </p>
              ) : (
                <p className="mt-1 text-xs text-emerald-800">Saldo 0 · todos los pares F9 en FI</p>
              )}
              <button
                type="button"
                disabled={!protocoloChusa.puedeLote || generandoFi}
                onClick={() => void generarFiLote({ regenerar: true })}
                className="mt-4 w-full rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold uppercase tracking-wide text-white shadow hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {generandoFiKey === "lote"
                  ? "Recalculando… (~2 min)"
                  : `Recalcular ${nFiEfectivo} facturas desde proforma`}
              </button>
              <button
                type="button"
                onClick={mostrarCelebracionCompleta}
                className="mt-2 w-full rounded-lg border border-emerald-600 bg-white px-4 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
              >
                Ver tab Facturas Internas →
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={!protocoloChusa.puedeLote || generandoFi}
                onClick={() => void generarFiLote({ regenerar: nFiEfectivo > 0 })}
                className="mt-5 w-full rounded-xl bg-emerald-600 px-6 py-4 text-sm font-bold uppercase tracking-wide text-white shadow-lg transition hover:bg-emerald-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-40"
              >
                {generandoFiKey === "lote"
                  ? "Generando… (~2 min)"
                  : protocoloChusa.puedeLote
                    ? fiPendientes && nFiEfectivo > 0
                      ? `Completar lote · faltan ${fiEsperadas - nFiEfectivo} FI`
                      : `Generar ${protocoloChusa.contadorIc} facturas · un clic`
                    : "Generar factura interna por lote"}
              </button>
              {!protocoloChusa.nivel1 ? (
                <p className="mt-3 text-xs text-slate-600">Nivel 1: contadores IC ≠ PF</p>
              ) : !protocoloChusa.nivel2 ? (
                <p className="mt-3 text-xs text-amber-800">Nivel 2: canon no cuadra — corregí ICs</p>
              ) : (
                <p className="mt-3 text-xs font-semibold text-emerald-800">
                  Nivel 3 · listo — un clic y terminás
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid min-h-[560px] grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Panel IC */}
        <div className="flex min-w-0 flex-col overflow-hidden border border-slate-300 bg-slate-50">
          <div className="flex items-center justify-between border-b border-slate-300 bg-slate-200 px-2 py-1">
            <span className="text-[10px] font-bold uppercase">IC · cabecera</span>
            <span className="rounded border-2 border-red-500 bg-white px-2 py-0.5 text-[10px] font-bold tabular-nums text-red-900">
              {protocoloChusa.contadorIc}
            </span>
          </div>
          <div className={`grid w-full ${CABECERA_GRID} gap-1 border-b border-slate-200 px-1 py-0.5 text-[9px] font-bold uppercase text-slate-500 sm:text-[10px]`}>
            <span>Cliente</span>
            <span>IC Nº</span>
            <span>Marca</span>
            <span className="text-right">Cant.</span>
            <span className="text-center">Desc</span>
            <span className="text-right">Monto</span>
            <span>LP</span>
            <span />
          </div>
          <div className="max-h-[520px] space-y-0.5 overflow-y-auto overflow-x-hidden p-1">
            {icsVisibles.map((ic, idx) => {
              const pfPar = pfVisibles[idx];
              const marcaPf = pfPar ? marcaAlineacionPrefactura(pfPar, ics) : undefined;
              const canonDiff = canonDiffs.ic[idx] ?? null;
              return (
                <CabeceraFila
                  key={ic.ic_id}
                  tone="ic"
                  codCliente={ic.id_cliente}
                  colRef={ic.nro_ic}
                  marca={ic.marca}
                  lp={ic.listado_label}
                  lpEditable
                  lpValue={ic.listado_tier}
                  onLpChange={(tier) => void patchIcListado(ic.ic_id, tier)}
                  monto={ic.monto_ic}
                  montoSecundario={ic.monto_proforma}
                  pares={ic.pares}
                  descLabel={fmtDescCompact(
                    ic.descuento_1,
                    ic.descuento_2,
                    ic.descuento_3,
                    ic.descuento_4,
                  )}
                  canonDiff={canonDiff}
                  canonHint={
                    pfPar
                      ? {
                          cliente: pfPar.id_cliente,
                          marca: marcaPf,
                          cantidad: pfPar.total_pares,
                        }
                      : undefined
                  }
                />
              );
            })}
          </div>
        </div>

        {/* Panel Pre-FI — derecha */}
        <div className="flex min-w-0 flex-col overflow-hidden border border-orange-300 bg-orange-50/50">
          <div className="flex items-center justify-between border-b border-orange-300 bg-orange-200 px-2 py-1">
            <span className="text-[10px] font-bold uppercase">Pre-Factura interna · proforma</span>
            <span className="rounded border-2 border-red-500 bg-white px-2 py-0.5 text-[10px] font-bold tabular-nums text-red-900">
              {protocoloChusa.contadorPf}
            </span>
          </div>
          <div className={`grid w-full ${CABECERA_GRID} gap-1 border-b border-orange-200 px-1 py-0.5 text-[9px] font-bold uppercase text-orange-800 sm:text-[10px]`}>
            <span>Cliente</span>
            <span>Caso</span>
            <span>Marca</span>
            <span className="text-right">Cant.</span>
            <span className="text-center">Desc</span>
            <span className="text-right">Monto</span>
            <span>LP</span>
            <span />
          </div>
          <div className="max-h-[520px] space-y-0.5 overflow-y-auto overflow-x-hidden p-1">
            {pfVisibles.map((pf, idx) => {
              const open = expandedPf.has(pf.pf_key);
              const icVinculada = pfTierAutoIc.icPorPf.get(pf.pf_key);
              const icPar = icsVisibles[idx];
              const lpLocked = Boolean(icVinculada);
              const tier =
                pfTierAutoIc.tiers[pf.pf_key] ?? pfTierOverrides[pf.pf_key] ?? pf.listado_tier;
              const pfDisplay = tier === pf.listado_tier && !lpLocked && !pfTierOverrides[pf.pf_key]
                ? pf
                : recalcPfConTier(pf, tier);
              const marcaCol = marcaAlineacionPrefactura(pfDisplay, ics);
              const canonDiff = canonDiffs.pf[idx] ?? null;
              const montoConDescIc =
                icVinculada != null
                  ? montoFiConDescuentosIc(
                      pfDisplay.articulos,
                      icVinculada.listado_tier,
                      icVinculada.descuento_1,
                      icVinculada.descuento_2,
                      icVinculada.descuento_3,
                      icVinculada.descuento_4,
                    )
                  : null;
              return (
                <div key={pf.pf_key}>
                  <CabeceraFila
                    tone="pf"
                    codCliente={pfDisplay.id_cliente}
                    colRef={pfDisplay.caso}
                    marca={marcaCol}
                    lp={pfDisplay.listado_label}
                    lpEditable={!lpLocked}
                    lpLocked={lpLocked}
                    lpValue={tier}
                    onLpChange={(t) =>
                      setPfTierOverrides((prev) => ({ ...prev, [pf.pf_key]: t }))
                    }
                    monto={pfDisplay.total_monto}
                    montoSecundario={montoConDescIc}
                    pares={pfDisplay.total_pares}
                    descLabel={
                      icVinculada
                        ? fmtDescCompact(
                            icVinculada.descuento_1,
                            icVinculada.descuento_2,
                            icVinculada.descuento_3,
                            icVinculada.descuento_4,
                          )
                        : undefined
                    }
                    canonDiff={canonDiff}
                    canonHint={
                      icPar
                        ? {
                            cliente: icPar.id_cliente,
                            marca: icPar.marca,
                            cantidad: icPar.pares,
                          }
                        : undefined
                    }
                    expandable
                    expanded={open}
                    onToggleExpand={() =>
                      setExpandedPf((prev) => {
                        const next = new Set(prev);
                        if (next.has(pf.pf_key)) next.delete(pf.pf_key);
                        else next.add(pf.pf_key);
                        return next;
                      })
                    }
                  />
                  {open && (
                    <div className="space-y-1 border-l-2 border-orange-400 py-1 pl-1">
                      <p className="px-1 text-[9px] font-bold uppercase text-orange-800">
                        Detalle artículos proforma
                      </p>
                      {pfDisplay.articulos.map((art) => (
                        <ArticuloFila key={art.ppd_id} art={art} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
