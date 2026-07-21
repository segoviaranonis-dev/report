"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PpDetalleHeader } from "@/lib/pedido-proveedor/detail-query";
import type {
  IcAdminRow,
  PfArticuloRow,
  PreFacturaInterna,
} from "@/lib/pedido-proveedor/administrador-ic-query";
import {
  evalProtocoloChusa,
  icParPrefactura,
  marcaAlineacionPrefactura,
  marcaDisplayPrefactura,
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
import {
  readAdminIcCache,
  writeAdminIcCache,
} from "@/lib/pedido-proveedor/pp-detalle-ui-cache";
import { ProcesoImportacionWaitOverlay } from "@/components/report/ProcesoImportacionWaitOverlay";
import { ChusaLoteCelebracionOverlay } from "@/components/report/ChusaLoteCelebracionOverlay";
import { ProductThumbFrame } from "@/components/product/ProductThumbFrame";
import { PpAdminIcCabeceraFila, ADMIN_IC_GRID, ADMIN_IC_ROW_MIN_W } from "./PpAdminIcCabeceraFila";
import type { PfSplitRecord } from "@/lib/pedido-proveedor/admin-ic-pf-splits";

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

const CANON_ERR =
  "rounded bg-red-200 font-bold text-red-950 ring-2 ring-red-500 shadow-sm";

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

function ArticuloFila({
  art,
  onAddToSplit,
}: {
  art: PfArticuloRow;
  onAddToSplit?: () => void;
}) {
  return (
    <div
      className="ml-2 grid grid-cols-[2.75rem_minmax(0,1fr)_1.75rem] items-center gap-2 border border-dashed border-orange-300 bg-white px-2 py-1 text-[10px]"
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
      {onAddToSplit ? (
        <button
          type="button"
          title="Separar este artículo a nueva prefactura (+ IC cabecera)"
          className="rounded bg-violet-700 px-1 py-0.5 text-xs font-bold text-white hover:bg-violet-800"
          onClick={(e) => {
            e.stopPropagation();
            onAddToSplit();
          }}
        >
          +
        </button>
      ) : (
        <span className="w-5" />
      )}
    </div>
  );
}

export function PpTabAdministradorIc({ pp, ppId, onMsg, onReload }: Props) {
  const router = useRouter();
  const cachedAdmin = readAdminIcCache(ppId);
  const [loading, setLoading] = useState(!cachedAdmin);
  const [ics, setIcs] = useState<IcAdminRow[]>(cachedAdmin?.ics ?? []);
  const [prefacturas, setPrefacturas] = useState<PreFacturaInterna[]>(cachedAdmin?.prefacturas ?? []);
  const [expandedPf, setExpandedPf] = useState<Set<string>>(new Set());
  const [filtroCliente, setFiltroCliente] = useState<string>("");
  const [pfTierOverrides, setPfTierOverrides] = useState<Record<string, ListadoPrecioTierId>>({});
  const [generandoFiKey, setGenerandoFiKey] = useState<string | null>(null);
  const [celebracion, setCelebracion] = useState<{ total: number } | null>(null);
  const [nFiServidor, setNFiServidor] = useState<number | null>(null);
  const [icBusy, setIcBusy] = useState<number | null>(null);
  const [pfSplits, setPfSplits] = useState<PfSplitRecord[]>([]);
  const [splitPfTarget, setSplitPfTarget] = useState<PreFacturaInterna | null>(null);
  const [splitSelections, setSplitSelections] = useState<Map<number, number>>(new Map());
  const [splitCliente, setSplitCliente] = useState("");
  const [splitBusy, setSplitBusy] = useState(false);
  const loadedOnceRef = useRef(Boolean(cachedAdmin));

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const hasCache = loadedOnceRef.current || readAdminIcCache(ppId) != null;
    const silent = opts?.silent === true || hasCache;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/proceso-importacion/pedido-proveedor/${ppId}/administrador-ic`, {
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error cargando datos");
      const snap = {
        ics: (data.ics ?? []) as IcAdminRow[],
        prefacturas: (data.prefacturas ?? []) as PreFacturaInterna[],
      };
      writeAdminIcCache(ppId, snap);
      setIcs(snap.ics);
      setPrefacturas(snap.prefacturas);
      setPfSplits((data.pf_splits ?? []) as PfSplitRecord[]);
      loadedOnceRef.current = true;
    } catch (e) {
      onMsg(msgFromUnknown(e));
    } finally {
      setLoading(false);
    }
  }, [ppId, onMsg]);

  useEffect(() => {
    const c = readAdminIcCache(ppId);
    loadedOnceRef.current = Boolean(c);
    if (c) {
      setIcs(c.ics);
      setPrefacturas(c.prefacturas);
      setLoading(false);
    }
    void load({ silent: Boolean(c) });
  }, [ppId, load]);

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
        marcaAlineacionPrefactura(a),
        a.total_pares,
        a.total_monto,
        a.caso,
        b.id_cliente,
        marcaAlineacionPrefactura(b),
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

  async function patchIcFields(
    icId: number,
    fields: Record<string, number>,
  ) {
    setIcBusy(icId);
    try {
      const res = await fetch(`/api/proceso-importacion/pedido-proveedor/${ppId}/ic/${icId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo guardar IC");
      await load({ silent: true });
      await onReload?.();
      onMsg("IC actualizada");
    } catch (e) {
      onMsg(msgFromUnknown(e));
    } finally {
      setIcBusy(null);
    }
  }

  async function deleteIcRow(ic: IcAdminRow) {
    if (
      !window.confirm(
        `¿Devolver ${ic.nro_ic} a Digitación?\nSe desvincula del PP · ${ic.pares} pares.`,
      )
    ) {
      return;
    }
    setIcBusy(ic.ic_id);
    try {
      const res = await fetch(
        `/api/proceso-importacion/pedido-proveedor/${ppId}/ic/${ic.ic_id}`,
        { method: "DELETE", credentials: "same-origin" },
      );
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo eliminar IC");
      await load({ silent: true });
      await onReload?.();
      onMsg(`IC ${ic.nro_ic} devuelta a Digitación`);
    } catch (e) {
      onMsg(msgFromUnknown(e));
    } finally {
      setIcBusy(null);
    }
  }

  function openSplitPf(pf: PreFacturaInterna, preselectPpdIds?: number[]) {
    setSplitPfTarget(pf);
    setSplitCliente(String(pf.id_cliente));
    const next = new Map<number, number>();
    if (preselectPpdIds?.length) {
      for (const ppdId of preselectPpdIds) {
        const art = pf.articulos.find((a) => a.ppd_id === ppdId);
        if (art) next.set(ppdId, art.pares);
      }
    }
    setSplitSelections(next);
    setExpandedPf((prev) => new Set(prev).add(pf.pf_key));
  }

  const splitParesTotal = useMemo(() => {
    let n = 0;
    for (const p of splitSelections.values()) n += p;
    return n;
  }, [splitSelections]);

  const splitIcOrigen = useMemo(() => {
    if (!splitPfTarget) return null;
    return (
      ics.find(
        (ic) =>
          icParPrefactura(ic, splitPfTarget) &&
          parejaTripleteIcPf(ic, {
            ...splitPfTarget,
            total_pares: splitPfTarget.total_pares,
          }),
      ) ?? null
    );
  }, [splitPfTarget, ics]);

  function toggleSplitArt(ppdId: number, maxPares: number, checked: boolean) {
    setSplitSelections((prev) => {
      const next = new Map(prev);
      if (checked) next.set(ppdId, maxPares);
      else next.delete(ppdId);
      return next;
    });
  }

  function setSplitArtPares(ppdId: number, maxPares: number, raw: string) {
    const p = Math.min(maxPares, Math.max(1, Math.round(Number(raw) || 0)));
    setSplitSelections((prev) => {
      if (!prev.has(ppdId)) return prev;
      const next = new Map(prev);
      next.set(ppdId, p);
      return next;
    });
  }

  async function confirmSplitPf() {
    if (!splitPfTarget) return;
    const idCliente = Math.round(Number(splitCliente));
    if (!Number.isFinite(idCliente) || idCliente <= 0) {
      onMsg("Cliente destino inválido");
      return;
    }
    const articulos = [...splitSelections.entries()].map(([ppd_id, pares]) => ({ ppd_id, pares }));
    if (!articulos.length) {
      onMsg("Seleccioná al menos un artículo");
      return;
    }
    const pares = articulos.reduce((s, a) => s + a.pares, 0);
    if (pares <= 0 || pares >= splitPfTarget.total_pares) {
      onMsg(`Total ${pares}p — debe quedar al menos 1 par en origen (${splitPfTarget.total_pares}p)`);
      return;
    }
    setSplitBusy(true);
    try {
      const res = await fetch(
        `/api/proceso-importacion/pedido-proveedor/${ppId}/administrador-ic/pf-split`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parent_pf_key: splitPfTarget.pf_key,
            id_cliente: idCliente,
            articulos,
            sync_ic: true,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Error al dividir prefactura");
      setIcs(data.ics ?? []);
      setPrefacturas(data.prefacturas ?? []);
      setPfSplits(data.pf_splits ?? []);
      writeAdminIcCache(ppId, { ics: data.ics ?? [], prefacturas: data.prefacturas ?? [] });
      await onReload?.();
      await load({ silent: true });
      const icNote = data.ic_sync?.nro_ic_nueva
        ? ` · IC cabecera ${data.ic_sync.nro_ic_nueva}`
        : splitIcOrigen
          ? " · IC pareada no sincronizada (revisá pares)"
          : "";
      onMsg(`Nueva prefactura: ${articulos.length} artículo(s) · ${pares}p → cliente ${idCliente}${icNote}`);
      setSplitPfTarget(null);
      setSplitSelections(new Map());
    } catch (e) {
      onMsg(msgFromUnknown(e));
    } finally {
      setSplitBusy(false);
    }
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

  if (loading && ics.length === 0 && prefacturas.length === 0) {
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

      <div className="rounded-xl border-2 border-violet-700 bg-gradient-to-r from-violet-100 to-violet-50 px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="rounded-lg bg-violet-800 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
            Pedido proveedor · PROGRAMADO
          </span>
          <span className="font-mono text-base font-bold text-violet-950">{pp.numero_registro}</span>
          <span className={`rounded px-2 py-0.5 text-xs font-bold ${pp.estado === "ENVIADO" ? "bg-emerald-100 text-emerald-900" : pp.estado === "CERRADO" ? "bg-sky-100 text-sky-900" : "bg-amber-100 text-amber-900"}`}>
            {pp.estado}
          </span>
          {pp.numero_proforma ? (
            <span className="text-xs text-violet-900">
              Proforma <strong className="font-mono">{pp.numero_proforma}</strong>
            </span>
          ) : null}
          <span className="text-xs text-violet-800">
            {pp.proveedor} · {pp.marcas}
          </span>
          <span className="text-xs tabular-nums text-violet-800">
            IC {protocoloChusa.contadorIc} · PF {protocoloChusa.contadorPf} · FI {nFiEfectivo}
            {fiEsperadas > 0 && nFiEfectivo !== fiEsperadas ? ` / ${fiEsperadas}` : ""}
          </span>
        </div>
      </div>

      <div className="rounded-xl border-2 border-yellow-400 bg-yellow-50 px-4 py-2">
        <h2 className="text-sm font-bold text-yellow-950">⚖ Administrador de IC · Protocolo Chusa</h2>
        <p className="mt-1 text-xs text-yellow-900">
          <strong>Cabecera:</strong> IC = PF = FI (115 filas · cliente · marca · pares por fila).{" "}
          <strong>Molécula:</strong> Saldo = pares F9 sin asignar a FI ({pp.pares_comprometidos.toLocaleString("es-PY")} pares IC · {pp.total_articulos} artículos).{" "}
          <strong className="text-red-800">Rojo = corregí la IC</strong> en ICs Asignadas.{" "}
          <strong className="text-violet-900">IC:</strong> editá cantidad · D1–D4 · ✕ eliminar.{" "}
          <strong className="text-violet-900">PF:</strong> botón <strong>÷</strong> divide pares a otra prefactura/FI (sync IC automático).
        </p>
        {pfSplits.length > 0 && (
          <p className="mt-1 text-[10px] font-semibold text-violet-900">
            {pfSplits.length} división{pfSplits.length === 1 ? "" : "es"} PF activa{pfSplits.length === 1 ? "" : "s"} · filas verdes = prefactura hija
          </p>
        )}
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

      <div className="grid min-h-[560px] grid-cols-1 gap-4 2xl:grid-cols-2">
        {/* Panel IC */}
        <div className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-slate-300 bg-slate-50 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-300 bg-slate-200 px-3 py-2">
            <span className="text-[11px] font-bold uppercase tracking-wide">IC · cabecera</span>
            <span className="rounded border-2 border-red-500 bg-white px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-red-900">
              {protocoloChusa.contadorIc}
            </span>
          </div>
          <div className="overflow-x-auto">
            <div
              className={`grid w-full ${ADMIN_IC_ROW_MIN_W} ${ADMIN_IC_GRID} gap-x-1.5 border-b border-slate-200 px-2 py-2 text-[9px] font-bold uppercase tracking-wide text-slate-500 sm:text-[10px]`}
            >
              <span>Cliente</span>
              <span>IC Nº</span>
              <span>Marca</span>
              <span className="text-center">Cant.</span>
              <span className="text-center">D1–D4</span>
              <span className="text-right">Monto</span>
              <span className="text-center">LP</span>
              <span />
              <span className="text-right">Acc.</span>
            </div>
          </div>
          <div className="max-h-[520px] space-y-1 overflow-x-auto overflow-y-auto p-2">
            {icsVisibles.map((ic, idx) => {
              const pfPar = pfVisibles[idx];
              const marcaPf = pfPar ? marcaAlineacionPrefactura(pfPar) : undefined;
              const canonDiff = canonDiffs.ic[idx] ?? null;
              return (
                <PpAdminIcCabeceraFila
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
                  icEdit={{
                    icId: ic.ic_id,
                    pares: ic.pares,
                    monto: ic.monto_ic,
                    d1: Number(ic.descuento_1) || 0,
                    d2: Number(ic.descuento_2) || 0,
                    d3: Number(ic.descuento_3) || 0,
                    d4: Number(ic.descuento_4) || 0,
                    busy: icBusy === ic.ic_id,
                    onParesBlur: (p) => void patchIcFields(ic.ic_id, { cantidad_total_pares: p }),
                    onMontoBlur: (m) => void patchIcFields(ic.ic_id, { monto_bruto: m }),
                    onDescBlur: (d1, d2, d3, d4) =>
                      void patchIcFields(ic.ic_id, {
                        descuento_1: d1,
                        descuento_2: d2,
                        descuento_3: d3,
                        descuento_4: d4,
                      }),
                    onDelete: () => void deleteIcRow(ic),
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Panel Pre-FI — derecha */}
        <div className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-orange-300 bg-orange-50/50 shadow-sm">
          <div className="flex items-center justify-between border-b border-orange-300 bg-orange-200 px-3 py-2">
            <span className="text-[11px] font-bold uppercase tracking-wide">Pre-Factura interna · proforma</span>
            <span className="rounded border-2 border-red-500 bg-white px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-red-900">
              {protocoloChusa.contadorPf}
            </span>
          </div>
          <div className="overflow-x-auto">
            <div
              className={`grid w-full ${ADMIN_IC_ROW_MIN_W} ${ADMIN_IC_GRID} gap-x-1.5 border-b border-orange-200 px-2 py-2 text-[9px] font-bold uppercase tracking-wide text-orange-800 sm:text-[10px]`}
            >
              <span>Cliente</span>
              <span>Caso</span>
              <span>Marca</span>
              <span className="text-center">Cant.</span>
              <span className="text-center">Desc</span>
              <span className="text-right">Monto</span>
              <span className="text-center">LP</span>
              <span />
              <span className="text-right">÷</span>
            </div>
          </div>
          <div className="max-h-[520px] space-y-1 overflow-x-auto overflow-y-auto p-2">
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
              const marcaCol = marcaDisplayPrefactura(pfDisplay, ics);
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
              const pfEsHija = pf.pf_key.includes("|sp-");
              return (
                <div key={pf.pf_key}>
                  <PpAdminIcCabeceraFila
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
                    pfEsHija={pfEsHija}
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
                    onSplitPf={
                      pfDisplay.total_pares > 1 ? () => openSplitPf(pfDisplay) : undefined
                    }
                  />
                  {open && (
                    <div className="space-y-1 border-l-2 border-orange-400 py-1 pl-1">
                      <p className="px-1 text-[9px] font-bold uppercase text-orange-800">
                        Detalle artículos proforma
                      </p>
                      {pfDisplay.articulos.map((art) => (
                        <ArticuloFila
                          key={art.ppd_id}
                          art={art}
                          onAddToSplit={
                            pfDisplay.total_pares > 1 && !pfEsHija
                              ? () => openSplitPf(pfDisplay, [art.ppd_id])
                              : undefined
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

      {splitPfTarget && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 px-4 py-6">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border-2 border-violet-600 bg-white shadow-xl">
            <div className="border-b border-violet-200 p-5">
              <h3 className="text-sm font-bold text-violet-950">Nueva prefactura · selección de artículos</h3>
              <p className="mt-2 text-xs text-slate-700">
                Origen cliente <strong>{splitPfTarget.id_cliente}</strong> ·{" "}
                <strong>{splitPfTarget.total_pares}</strong> pares · caso{" "}
                <strong>{splitPfTarget.caso}</strong>
              </p>
              {splitIcOrigen ? (
                <p className="mt-1 text-[10px] font-semibold text-emerald-800">
                  IC pareada: {splitIcOrigen.nro_ic} ({splitIcOrigen.pares}p) — al confirmar se crea IC
                  cabecera hija con los pares seleccionados.
                </p>
              ) : (
                <p className="mt-1 text-[10px] text-amber-800">
                  Sin IC pareada en cabecera — solo se divide la prefactura.
                </p>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3">
              <p className="mb-2 text-[10px] font-bold uppercase text-violet-900">
                Marcá artículos a mover
              </p>
              <div className="space-y-2">
                {splitPfTarget.articulos.map((art) => {
                  const checked = splitSelections.has(art.ppd_id);
                  const selPares = splitSelections.get(art.ppd_id) ?? art.pares;
                  return (
                    <label
                      key={art.ppd_id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-[10px] ${
                        checked ? "border-violet-500 bg-violet-50" : "border-slate-200 bg-white"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggleSplitArt(art.ppd_id, art.pares, e.target.checked)}
                        className="h-4 w-4 shrink-0"
                      />
                      <ProductThumbFrame
                        alt={`${art.linea}-${art.referencia}`}
                        candidates={art.imageCandidates}
                        size={36}
                      />
                      <div className="min-w-0 flex-1 grid grid-cols-3 gap-x-2 gap-y-0.5">
                        <span>
                          <strong>L</strong> {art.linea} · <strong>R</strong> {art.referencia}
                        </span>
                        <span>
                          <strong>M</strong> {art.material_code} · <strong>C</strong> {art.color_code}
                        </span>
                        <span>
                          <strong>G</strong> {art.grada ?? "—"} · máx {art.pares}p
                        </span>
                      </div>
                      {checked && art.pares > 1 ? (
                        <input
                          type="number"
                          min={1}
                          max={art.pares}
                          value={selPares}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setSplitArtPares(art.ppd_id, art.pares, e.target.value)}
                          className="w-14 rounded border border-violet-400 px-1 py-0.5 text-right font-mono text-xs"
                          title="Pares de este artículo"
                        />
                      ) : checked ? (
                        <span className="w-14 text-right font-bold tabular-nums">{art.pares}p</span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="border-t border-violet-200 p-5">
              <p className="text-xs font-bold text-violet-950">
                Total seleccionado: {splitParesTotal}p
                {splitPfTarget.total_pares - splitParesTotal > 0
                  ? ` · quedan ${splitPfTarget.total_pares - splitParesTotal}p en origen`
                  : ""}
              </p>
              <label className="mt-3 block text-xs font-bold text-slate-600">Cliente destino (nueva PF + IC)</label>
              <input
                type="number"
                min={1}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono"
                value={splitCliente}
                onChange={(e) => setSplitCliente(e.target.value)}
              />
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  disabled={splitBusy || splitParesTotal <= 0}
                  onClick={() => void confirmSplitPf()}
                  className="flex-1 rounded-lg bg-violet-700 px-4 py-2 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-50"
                >
                  {splitBusy ? "Creando…" : "Crear prefactura + IC cabecera"}
                </button>
                <button
                  type="button"
                  disabled={splitBusy}
                  onClick={() => {
                    setSplitPfTarget(null);
                    setSplitSelections(new Map());
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
