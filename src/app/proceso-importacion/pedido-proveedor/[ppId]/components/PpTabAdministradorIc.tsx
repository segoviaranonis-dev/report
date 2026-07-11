"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PpDetalleHeader } from "@/lib/pedido-proveedor/detail-query";
import type {
  IcAdminRow,
  PfArticuloRow,
  PreFacturaInterna,
} from "@/lib/pedido-proveedor/administrador-ic-query";
import {
  evaluateParejaMatch,
  icParPrefactura,
  marcaAlineacionPrefactura,
  montoFiConDescuentosIc,
  parejaTripleteIcPf,
  recalcPfConTier,
  type ParejaMatchNivel,
} from "@/lib/pedido-proveedor/administrador-ic-monto";
import {
  LISTADO_PRECIO_TIERS,
  type ListadoPrecioTierId,
} from "@/lib/intencion-compra/listado-precio-tiers";
import { fiListaTier } from "@/lib/pedido-proveedor/aritmetica-programado";

type DragPayload =
  | { kind: "ic"; ic_id: number; label: string }
  | { kind: "pf"; pf_key: string; label: string }
  | { kind: "articulo"; ppd_id: number; pf_key: string; label: string };

type ParejaFormada = {
  id: string;
  icLabel: string;
  pfLabel: string;
  modo: "cabecera" | "articulo";
  fi_nro?: string;
  match?: ParejaMatchNivel;
};

const MATCH_CLS: Record<ParejaMatchNivel, string> = {
  exacto: "ring-2 ring-emerald-500",
  cercano: "ring-2 ring-lime-400",
  referencia: "ring-2 ring-amber-400",
  lejos: "",
};

type Props = {
  pp: PpDetalleHeader;
  ppId: string;
  onMsg: (msg: string) => void;
};

const DND = "application/x-nexus-admin-ic";

/** Cliente · IC Nº/Caso · Marca · Cant · Monto · LP — columnas alineadas IC ↔ PF. */
const CABECERA_GRID =
  "grid-cols-[2.5rem_minmax(0,0.85fr)_minmax(0,1fr)_2rem_minmax(0,1fr)_2.5rem_0.9rem_1.1rem]";

function cmpAdminFilas(
  clienteA: number,
  marcaA: string,
  paresA: number,
  montoA: number,
  tieA: string,
  clienteB: number,
  marcaB: string,
  paresB: number,
  montoB: number,
  tieB: string,
) {
  return (
    clienteA - clienteB ||
    marcaA.localeCompare(marcaB, "es") ||
    paresA - paresB ||
    montoA - montoB ||
    tieA.localeCompare(tieB, "es")
  );
}

function fmtMonto(n: number) {
  return n.toLocaleString("es-PY", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
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
  matchNivel,
  selected,
  draggable,
  onDragStart,
  onClick,
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
  matchNivel?: ParejaMatchNivel | null;
  selected?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onClick?: () => void;
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
      ? selected
        ? "border-violet-500 bg-violet-100"
        : "border-slate-300 bg-slate-100"
      : selected
        ? "border-orange-500 bg-orange-100"
        : "border-orange-300 bg-orange-50";

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      className={`grid h-9 w-full min-w-0 cursor-grab ${CABECERA_GRID} items-center gap-1 border px-1 text-[10px] leading-tight active:cursor-grabbing sm:h-10 sm:text-[11px] ${bg} ${matchNivel ? MATCH_CLS[matchNivel] : ""}`}
      title="Arrastrá al panel central · montos sin descuento en esta fase"
    >
      <span className="truncate font-mono font-bold">{codCliente}</span>
      <span className="truncate text-[9px] font-semibold text-slate-700" title={colRef}>
        {colRef}
      </span>
      <span className="truncate font-semibold" title={marca}>
        {marca}
      </span>
      <span className="truncate text-right tabular-nums font-bold">{pares}</span>
      <span
        className="truncate text-right tabular-nums"
        title={
          montoSecundario != null && Math.abs(montoSecundario - monto) > 1
            ? `Sin desc.: ${fmtMonto(monto)} · con desc. IC: ${fmtMonto(montoSecundario)}`
            : fmtMonto(monto)
        }
      >
        <span className="font-bold">{fmtMonto(monto)}</span>
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
          title="Expandir artículos — arrastrar uno a uno"
        >
          {expanded ? "▾" : "▸"}
        </button>
      ) : (
        <span className="w-4" />
      )}
    </div>
  );
}

function ArticuloFila({
  art,
  pfKey,
  onDragStart,
}: {
  art: PfArticuloRow;
  pfKey: string;
  onDragStart: (e: React.DragEvent) => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="ml-2 grid cursor-grab grid-cols-[4rem_minmax(0,1fr)] gap-2 border border-dashed border-orange-300 bg-white px-2 py-1 text-[10px] active:cursor-grabbing"
      title="Arrastrá artículo suelto al centro"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded border border-slate-200 bg-slate-50 text-[8px] font-bold uppercase text-slate-400">
        IMG
      </div>
      <div className="grid grid-cols-5 gap-1">
        <span className="truncate" title="Línea">
          <strong>L</strong> {art.linea}
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

export function PpTabAdministradorIc({ pp, ppId, onMsg }: Props) {
  const [loading, setLoading] = useState(true);
  const [ics, setIcs] = useState<IcAdminRow[]>([]);
  const [prefacturas, setPrefacturas] = useState<PreFacturaInterna[]>([]);
  const [expandedPf, setExpandedPf] = useState<Set<string>>(new Set());
  const [slotIc, setSlotIc] = useState<DragPayload | null>(null);
  const [slotPf, setSlotPf] = useState<DragPayload | null>(null);
  const [parejas, setParejas] = useState<ParejaFormada[]>([]);
  const [filtroCliente, setFiltroCliente] = useState<string>("");
  const [pfTierOverrides, setPfTierOverrides] = useState<Record<string, ListadoPrecioTierId>>({});
  const [generandoFi, setGenerandoFi] = useState(false);
  const [slotIcId, setSlotIcId] = useState<number | null>(null);
  const [slotPpdIds, setSlotPpdIds] = useState<number[]>([]);

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
      onMsg(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [ppId, onMsg]);

  useEffect(() => {
    void load();
  }, [load]);

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
      cmpAdminFilas(
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
      cmpAdminFilas(
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

  const matchPorPf = useMemo(() => {
    const out = new Map<string, ParejaMatchNivel>();
    for (const pf of pfConTier) {
      const icCand = ics.find((ic) => parejaTripleteIcPf(ic, pf));
      if (!icCand) continue;
      const hint = evaluateParejaMatch(icCand.monto_ic, pf.total_monto, icCand.pares, pf.total_pares);
      if (hint.nivel !== "lejos") out.set(pf.pf_key, hint.nivel);
    }
    return out;
  }, [ics, pfConTier]);

  const slotMatch = useMemo(() => {
    if (!slotIcId || !slotPpdIds.length) return null;
    const ic = ics.find((i) => i.ic_id === slotIcId);
    if (!ic) return null;
    const arts = pfConTier.flatMap((p) => p.articulos).filter((a) => slotPpdIds.includes(a.ppd_id));
    const montoPf = arts.reduce((s, a) => s + a.subtotal, 0);
    const paresPf = arts.reduce((s, a) => s + a.pares, 0);
    return evaluateParejaMatch(ic.monto_ic, montoPf, ic.pares, paresPf);
  }, [ics, pfConTier, slotIcId, slotPpdIds]);

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
      onMsg(e instanceof Error ? e.message : "Error listado IC");
    }
  }

  function writeDrag(e: React.DragEvent, payload: DragPayload) {
    e.dataTransfer.setData(DND, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  }

  function readDrag(e: React.DragEvent): DragPayload | null {
    try {
      const raw = e.dataTransfer.getData(DND);
      if (!raw) return null;
      return JSON.parse(raw) as DragPayload;
    } catch {
      return null;
    }
  }

  function onDropIc(e: React.DragEvent) {
    e.preventDefault();
    const p = readDrag(e);
    if (p?.kind === "ic") {
      setSlotIc(p);
      setSlotIcId(p.ic_id);
    }
  }

  function onDropPf(e: React.DragEvent) {
    e.preventDefault();
    const p = readDrag(e);
    if (p?.kind === "pf") {
      setSlotPf(p);
      const pf = pfConTier.find((x) => x.pf_key === p.pf_key);
      setSlotPpdIds(pf?.articulos.map((a) => a.ppd_id) ?? []);
    } else if (p?.kind === "articulo") {
      setSlotPf(p);
      setSlotPpdIds([p.ppd_id]);
    }
  }

  async function generarFi() {
    if (!slotIc || slotIc.kind !== "ic" || !slotPpdIds.length) {
      onMsg("Arrastrá IC + Pre-Factura (o artículo) al centro.");
      return;
    }
    const ic = ics.find((i) => i.ic_id === slotIc.ic_id);
    if (!ic) return;

    setGenerandoFi(true);
    try {
      const res = await fetch(
        `/api/proceso-importacion/pedido-proveedor/${ppId}/administrador-ic/generar-fi`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ic_id: ic.ic_id, ppd_ids: slotPpdIds }),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo generar FI");

      const arts = pfConTier.flatMap((p) => p.articulos).filter((a) => slotPpdIds.includes(a.ppd_id));
      const hint = evaluateParejaMatch(
        ic.monto_ic,
        arts.reduce((s, a) => s + a.subtotal, 0),
        ic.pares,
        arts.reduce((s, a) => s + a.pares, 0),
      );

      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const modo = slotPf?.kind === "articulo" ? "articulo" : "cabecera";
      setParejas((prev) => [
        {
          id,
          icLabel: slotIc.label,
          pfLabel: slotPf?.label ?? "—",
          modo,
          fi_nro: data.fi_nro,
          match: hint.nivel,
        },
        ...prev,
      ]);
      onMsg(
        `✓ FI ${data.fi_nro} · ${data.total_pares}p · Gs. ${Number(data.total_monto).toLocaleString("es-PY")} (con desc. IC) · cabecera ${ic.nro_ic}`,
      );
      setSlotIc(null);
      setSlotPf(null);
      setSlotIcId(null);
      setSlotPpdIds([]);
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Error generando FI");
    } finally {
      setGenerandoFi(false);
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
      <div className="rounded-xl border-2 border-yellow-400 bg-yellow-50 px-4 py-2">
        <h2 className="text-sm font-bold text-yellow-950">⚖ Administrador de IC · Vinculación</h2>
        <p className="mt-1 text-xs text-yellow-900">
          Pareja automática cuando coinciden <strong>cliente · marca · cantidad</strong>: la PF hereda{" "}
          <strong>LP de la IC</strong> y recalcula monto (IC manda). Al generar FI → cabecera completa IC
          (vendedor, plazo, descuentos, listado).
        </p>
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
        <span className="text-slate-500">
          {icsVisibles.length} IC · {pfVisibles.length} Pre-FI
        </span>
      </div>

      <div className="grid min-h-[560px] grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.42fr)_minmax(0,1fr)] lg:gap-3">
        {/* Panel IC */}
        <div className="flex min-w-0 flex-col overflow-hidden border border-slate-300 bg-slate-50">
          <div className="border-b border-slate-300 bg-slate-200 px-2 py-1 text-[10px] font-bold uppercase">
            IC · cabecera
          </div>
          <div className={`grid w-full ${CABECERA_GRID} gap-1 border-b border-slate-200 px-1 py-0.5 text-[9px] font-bold uppercase text-slate-500 sm:text-[10px]`}>
            <span>Cliente</span>
            <span>IC Nº</span>
            <span>Marca</span>
            <span className="text-right">Cant.</span>
            <span className="text-right">Monto</span>
            <span>LP</span>
            <span />
          </div>
          <div className="max-h-[520px] space-y-0.5 overflow-y-auto overflow-x-hidden p-1">
            {icsVisibles.map((ic) => {
              const pfSug = pfConTier.find((p) => parejaTripleteIcPf(ic, p));
              const matchNivel = pfSug ? matchPorPf.get(pfSug.pf_key) : null;
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
                  matchNivel={matchNivel}
                  draggable
                  onDragStart={(e) =>
                    writeDrag(e, {
                      kind: "ic",
                      ic_id: ic.ic_id,
                      label: `${ic.nro_ic} · ${ic.marca} · ${ic.pares}p · Gs.${fmtMonto(ic.monto_ic)}`,
                    })
                  }
                />
              );
            })}
          </div>
        </div>

        {/* Panel central — vinculación */}
        <div className="flex min-w-0 flex-col overflow-hidden border-2 border-slate-400 bg-white">
          <div className="border-b border-slate-300 bg-slate-100 px-2 py-1 text-center text-xs font-bold uppercase">
            Vinculación
          </div>
          <div className="flex flex-1 flex-col gap-4 p-4">
            <div className="grid grid-cols-2 gap-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDropIc}
                className={`min-h-[88px] rounded-lg border-2 border-dashed p-3 ${
                  slotIc ? "border-violet-500 bg-violet-50" : "border-violet-300 bg-violet-50/40"
                }`}
              >
                <p className="text-[10px] font-bold uppercase text-violet-800">IC</p>
                <p className="mt-2 text-xs text-violet-950">{slotIc?.label ?? "Soltá acá la IC"}</p>
              </div>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDropPf}
                className={`min-h-[88px] rounded-lg border-2 border-dashed p-3 ${
                  slotPf ? "border-orange-500 bg-orange-50" : "border-orange-300 bg-orange-50/40"
                }`}
              >
                <p className="text-[10px] font-bold uppercase text-orange-800">Pre-Factura</p>
                <p className="mt-2 text-xs text-orange-950">{slotPf?.label ?? "Soltá PF o artículo"}</p>
              </div>
            </div>
            {slotMatch && slotIcId ? (
              <div
                className={`rounded-lg px-3 py-2 text-center text-xs ${
                  slotMatch.nivel === "exacto"
                    ? "bg-emerald-100 text-emerald-900"
                    : slotMatch.nivel === "cercano"
                      ? "bg-lime-100 text-lime-900"
                      : slotMatch.nivel === "referencia"
                        ? "bg-amber-100 text-amber-950"
                        : "bg-slate-100 text-slate-700"
                }`}
              >
                Δ monto {slotMatch.delta_monto >= 0 ? "+" : ""}
                {fmtMonto(slotMatch.delta_monto)} · Δ pares {slotMatch.delta_pares >= 0 ? "+" : ""}
                {slotMatch.delta_pares} ·{" "}
                {slotMatch.nivel === "exacto"
                  ? "✓ cuadra al centavo"
                  : slotMatch.nivel === "cercano"
                    ? "~ cercano"
                    : slotMatch.nivel === "referencia"
                      ? "pares OK · monto referencia"
                      : "revisar pareja"}
                {(() => {
                  const ic = ics.find((i) => i.ic_id === slotIcId);
                  const arts = pfConTier
                    .flatMap((p) => p.articulos)
                    .filter((a) => slotPpdIds.includes(a.ppd_id));
                  if (!ic || !arts.length) return null;
                  const fiNeto = montoFiConDescuentosIc(
                    arts,
                    fiListaTier(ic.listado_precio_id),
                    ic.descuento_1,
                    ic.descuento_2,
                    ic.descuento_3,
                    ic.descuento_4,
                  );
                  return (
                    <span className="block text-[10px] opacity-90">
                      FI con desc. IC: Gs. {fmtMonto(fiNeto)}
                    </span>
                  );
                })()}
              </div>
            ) : null}
            <button
              type="button"
              disabled={generandoFi || !slotIc || !slotPpdIds.length}
              onClick={() => void generarFi()}
              className="mx-auto rounded-lg bg-emerald-500 px-6 py-2 text-sm font-bold text-white shadow hover:bg-emerald-600 disabled:opacity-50"
            >
              {generandoFi ? "Generando…" : "GENERAR F.I."}
            </button>
            {parejas.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-2 text-[11px]">
                <p className="mb-1 font-bold text-slate-700">Parejas / FI ({parejas.length})</p>
                <ul className="space-y-1">
                  {parejas.map((p) => (
                    <li key={p.id} className="rounded bg-white px-2 py-1 shadow-sm">
                      <span className="font-mono text-violet-800">{p.icLabel}</span>
                      <span className="mx-1 text-slate-400">↔</span>
                      <span className="font-mono text-orange-800">{p.pfLabel}</span>
                      {p.fi_nro ? (
                        <span className="ml-1 font-bold text-emerald-700">→ {p.fi_nro}</span>
                      ) : null}
                      <span className="ml-1 text-slate-500">
                        ({p.modo}
                        {p.match ? ` · ${p.match}` : ""})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Panel Pre-FI — derecha */}
        <div className="flex min-w-0 flex-col overflow-hidden border border-orange-300 bg-orange-50/50">
          <div className="border-b border-orange-300 bg-orange-200 px-2 py-1 text-[10px] font-bold uppercase">
            Pre-Factura interna · proforma
          </div>
          <div className={`grid w-full ${CABECERA_GRID} gap-1 border-b border-orange-200 px-1 py-0.5 text-[9px] font-bold uppercase text-orange-800 sm:text-[10px]`}>
            <span>Cliente</span>
            <span>Caso</span>
            <span>Marca</span>
            <span className="text-right">Cant.</span>
            <span className="text-right">Monto</span>
            <span>LP</span>
            <span />
          </div>
          <div className="max-h-[520px] space-y-0.5 overflow-y-auto overflow-x-hidden p-1">
            {pfVisibles.map((pf) => {
              const open = expandedPf.has(pf.pf_key);
              const icVinculada = pfTierAutoIc.icPorPf.get(pf.pf_key);
              const lpLocked = Boolean(icVinculada);
              const tier =
                pfTierAutoIc.tiers[pf.pf_key] ?? pfTierOverrides[pf.pf_key] ?? pf.listado_tier;
              const pfDisplay = tier === pf.listado_tier && !lpLocked && !pfTierOverrides[pf.pf_key]
                ? pf
                : recalcPfConTier(pf, tier);
              const marcaCol = marcaAlineacionPrefactura(pfDisplay, ics);
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
                    matchNivel={matchPorPf.get(pf.pf_key)}
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
                    draggable={!open}
                    onDragStart={(e) =>
                      writeDrag(e, {
                        kind: "pf",
                        pf_key: pf.pf_key,
                        label: `${pfDisplay.id_cliente} · ${marcaCol} · ${pfDisplay.total_pares}p · Gs.${fmtMonto(pfDisplay.total_monto)}`,
                      })
                    }
                  />
                  {open && (
                    <div className="space-y-1 border-l-2 border-orange-400 py-1 pl-1">
                      <p className="px-1 text-[9px] font-bold uppercase text-orange-800">
                        Expandir = algo no cierra · arrastrá artículos sueltos
                      </p>
                      {pfDisplay.articulos.map((art) => (
                        <ArticuloFila
                          key={art.ppd_id}
                          art={art}
                          pfKey={pf.pf_key}
                          onDragStart={(e) =>
                            writeDrag(e, {
                              kind: "articulo",
                              ppd_id: art.ppd_id,
                              pf_key: pf.pf_key,
                              label: `${art.linea}.${art.referencia} · ${art.pares}p · Gs.${fmtMonto(art.subtotal)}`,
                            })
                          }
                        />
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
