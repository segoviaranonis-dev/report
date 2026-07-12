"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ProcesoImportacionWaitOverlay } from "@/components/report/ProcesoImportacionWaitOverlay";
import type { PpAlaNorteRow, PpDetalleHeader } from "@/lib/pedido-proveedor/detail-query";
import type { EventoPrecioOption, EventoPpDetalle } from "@/lib/pedido-proveedor/stock-listado";
import { factorDescuentosFob } from "@/lib/pedido-proveedor/stock-listado";
import {
  FECHA_DE_EMBARQUE_LABEL,
  QUINCENA_ARRIBO_CATALOGO,
  quincenaSliderValue,
} from "@/lib/intencion-compra/quincena-arribo";
import type { EmparejamientoShop } from "@/lib/pedido-proveedor/run-python-pp";
import type { ProformaPrecioAuditResumen } from "@/lib/pedido-proveedor/proforma-programado-engine";
import type { ProformaPilaresImportReport } from "@/lib/pedido-proveedor/proforma-pilares-import-report";
import { pedidoProveedorDetalle } from "@/lib/report/routes";
import { CATEGORIA_COMPRA_PREVIA_ID, CATEGORIA_PROGRAMADO_ID } from "@/lib/intencion-compra/categoria-ic";
import type { AlzarWebPreview } from "@/lib/pedido-proveedor/alzar-web";
import type { BorrarImportEstado } from "@/lib/pedido-proveedor/borrar-import";
import { collectGradeColumns, gradeQty, paresPorCaja } from "@/lib/pedido-proveedor/ala-norte-grades";
import {
  ejecutarRatificarFiProgramado,
  resumenRatificarFi,
} from "@/lib/pedido-proveedor/ratificar-fi-programado-client";

/** Debe coincidir con PROFORMA_FI_BATCH_SIZE del engine (evitar import server-side en cliente). */
const PROFORMA_FI_BATCH_SIZE = 12;

function urlBibliotecaAsignar(bibliotecaId: number, codigos: string[]): string {
  const params = new URLSearchParams({ abrir: "1" });
  if (codigos.length) params.set("destacar", codigos.join(","));
  return `/proceso-importacion/motor-precios/biblioteca/${bibliotecaId}?${params.toString()}`;
}

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
  const [recalcFi, setRecalcFi] = useState(true);
  const [incluirFiConfirmadas, setIncluirFiConfirmadas] = useState(false);
  const [vincularConfirm, setVincularConfirm] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [waitPhase, setWaitPhase] = useState<"preview" | "import" | null>(null);
  const [importProgress, setImportProgress] = useState("");
  const [proformaFile, setProformaFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<EmparejamientoShop[] | null>(null);
  const [previewOk, setPreviewOk] = useState(false);
  const [previewErrores, setPreviewErrores] = useState<string[]>([]);
  const [previewAvisos, setPreviewAvisos] = useState<string[]>([]);
  const [precioAudit, setPrecioAudit] = useState<ProformaPrecioAuditResumen | null>(null);
  const [pilaresImport, setPilaresImport] = useState<ProformaPilaresImportReport | null>(null);
  const [previewPares, setPreviewPares] = useState<number | null>(null);
  const [alzarPreview, setAlzarPreview] = useState<AlzarWebPreview | null>(null);
  const [alzarLoading, setAlzarLoading] = useState(false);
  const [borrarEstado, setBorrarEstado] = useState<BorrarImportEstado | null>(null);
  const [borrarConfirm, setBorrarConfirm] = useState(false);
  const [borrarLoading, setBorrarLoading] = useState(false);

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
  const gradeColumns = useMemo(() => collectGradeColumns(alaNorte), [alaNorte]);
  const resumenMarca = useMemo(() => {
    const map = new Map<string, { inicial: number; vendido: number; saldo: number }>();
    for (const r of alaNorte) {
      const prev = map.get(r.marca) ?? { inicial: 0, vendido: 0, saldo: 0 };
      map.set(r.marca, {
        inicial: prev.inicial + r.cantidad_inicial,
        vendido: prev.vendido + r.vendido,
        saldo: prev.saldo + r.saldo,
      });
    }
    return Array.from(map.entries()).map(([marca, t]) => ({ marca, ...t }));
  }, [alaNorte]);
  const variasMarcas = resumenMarca.length > 1;
  const factorNeto = useMemo(
    () => factorDescuentosFob(draft.descuento_1, draft.descuento_2, draft.descuento_3, draft.descuento_4),
    [draft.descuento_1, draft.descuento_2, draft.descuento_3, draft.descuento_4],
  );
  const editable = pp.cabecera_editable;
  const sinStock = pp.total_articulos === 0;
  const esProgramado = pp.categoria_id === CATEGORIA_PROGRAMADO_ID;
  const esCompraPrevia = pp.categoria_id === CATEGORIA_COMPRA_PREVIA_ID;

  const loadAlzarPreview = useCallback(async () => {
    if (!esCompraPrevia || sinStock) {
      setAlzarPreview(null);
      return;
    }
    try {
      const res = await fetch(`/api/proceso-importacion/pedido-proveedor/${pp.id}/alzar-web`, {
        credentials: "same-origin",
      });
      const data = await res.json();
      if (res.ok && data.preview) setAlzarPreview(data.preview);
    } catch {
      setAlzarPreview(null);
    }
  }, [esCompraPrevia, sinStock, pp.id]);

  useEffect(() => {
    void loadAlzarPreview();
  }, [loadAlzarPreview, pp.web_alzado, eventoDetalle?.evento_id, pp.total_articulos]);

  const loadBorrarEstado = useCallback(async () => {
    if (sinStock) {
      setBorrarEstado(null);
      return;
    }
    try {
      const res = await fetch(`/api/proceso-importacion/pedido-proveedor/${pp.id}/borrar-import`, {
        credentials: "same-origin",
      });
      const data = await res.json();
      if (res.ok && data.estado) setBorrarEstado(data.estado);
    } catch {
      setBorrarEstado(null);
    }
  }, [sinStock, pp.id]);

  useEffect(() => {
    void loadBorrarEstado();
  }, [loadBorrarEstado, pp.total_articulos, pp.web_alzado]);

  async function borrarImportacion() {
    setBorrarLoading(true);
    onMsg(null);
    try {
      const res = await fetch(`/api/proceso-importacion/pedido-proveedor/${pp.id}/borrar-import`, {
        method: "POST",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo borrar");
      setBorrarConfirm(false);
      onMsg(
        pp.web_alzado
          ? `${data.message} · Stock bajado del catálogo RIMEC Web.`
          : data.message,
      );
      await onReload();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Error al borrar");
    } finally {
      setBorrarLoading(false);
    }
  }

  async function alzarEnRimecWeb() {
    if (!window.confirm(
      "¿Alzar este PP en RIMEC Web?\n\nLos vendedores verán el stock en catálogo (tránsito) con precios del listado vinculado.",
    )) return;
    setAlzarLoading(true);
    onMsg(null);
    try {
      const res = await fetch(`/api/proceso-importacion/pedido-proveedor/${pp.id}/alzar-web`, {
        method: "POST",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo alzar");
      const p = data.preview as AlzarWebPreview;
      setAlzarPreview(p);
      onMsg(
        p.ya_alzado
          ? `Stock alzado en RIMEC Web · ${p.filas_catalogo} moléculas · ${p.pares_saldo.toLocaleString("es-PY")} pares disponibles`
          : "Alzado completado",
      );
      await onReload();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Error al alzar");
    } finally {
      setAlzarLoading(false);
    }
  }

  async function previewProformaProgramado() {
    if (!proformaFile) {
      onMsg("Seleccioná el archivo .xls/.xlsx de la proforma.");
      return;
    }
    setBusy(true);
    setWaitPhase("preview");
    onMsg(null);
    setPreviewRows(null);
    setPreviewOk(false);
    setPreviewErrores([]);
    setPreviewAvisos([]);
    setPrecioAudit(null);
    setPilaresImport(null);
    try {
      const fd = new FormData();
      fd.append("file", proformaFile);
      const res = await fetch(`/api/proceso-importacion/pedido-proveedor/${pp.id}/proforma/preview`, {
        method: "POST",
        credentials: "same-origin",
        body: fd,
      });
      const data = await res.json();
      const hasPreviewPayload = Array.isArray(data.emparejamientos) || (data.errores?.length ?? 0) > 0;
      if (!res.ok && !hasPreviewPayload) {
        throw new Error(data.error || "Error en preview");
      }

      const emparejamientos = (data.emparejamientos ?? []) as EmparejamientoShop[];
      const shopMatchOk =
        emparejamientos.length > 0 && emparejamientos.every((r) => r.match);
      setPreviewRows(emparejamientos);
      setPreviewOk(Boolean(data.ok) && shopMatchOk);
      setPreviewErrores(data.errores ?? []);
      setPreviewAvisos(data.avisos ?? []);
      setPrecioAudit(data.precio_audit ?? null);
      setPilaresImport((data.pilares_import as ProformaPilaresImportReport | undefined) ?? null);
      setPreviewPares(data.total_pares ?? null);

      if (!data.listado_vinculado) {
        onMsg("Preview OK parcial — vinculá el listado RIMEC antes de confirmar import.");
      } else if (data.ok && shopMatchOk) {
        const nAvisos = data.avisos?.length ?? 0;
        const audit = data.precio_audit as ProformaPrecioAuditResumen | undefined;
        const precioWarn =
          audit && (audit.n_sin_precio > 0 || audit.n_sin_caso > 0 || audit.n_pilares_faltantes > 0)
            ? ` · ${audit.n_sin_precio} sin LPN · ${audit.n_sin_caso} sin caso · ${audit.n_pilares_faltantes} pilares`
            : "";
        onMsg(
          nAvisos > 0
            ? `Emparejamiento OK · ${data.n_grupos_shop ?? "?"} SHOP · ${Number(data.total_pares ?? 0).toLocaleString("es-PY")} pares · ${nAvisos} aviso(s) pilares/precio${precioWarn}.`
            : `Emparejamiento OK · ${data.n_grupos_shop ?? "?"} SHOP · ${Number(data.total_pares ?? 0).toLocaleString("es-PY")} pares · precios OK.`,
        );
      } else if (data.ok && !shopMatchOk) {
        const nBad = emparejamientos.filter((r) => !r.match).length;
        onMsg(
          `Preview: ${nBad} SHOP(s) con pares ≠ IC — revisá tabla abajo. Paso 2 bloqueado hasta match total.`,
        );
      } else {
        const nErr = data.errores?.length ?? 0;
        onMsg(
          `Preview con ${nErr} error(es) SHOP↔IC — corregí Excel o ICs. Paso 2 bloqueado hasta match total.`,
        );
      }
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
      setWaitPhase(null);
    }
  }

  async function postProformaImport(fd: FormData) {
    const res = await fetch(`/api/proceso-importacion/pedido-proveedor/${pp.id}/proforma`, {
      method: "POST",
      credentials: "same-origin",
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al importar");
    return data;
  }

  async function runProgramadoFiLoop(
    baseFd: () => FormData,
    startOffset: number,
    initialFiTotal?: number,
  ): Promise<Record<string, unknown>> {
    let offset = startOffset;
    const batch = PROFORMA_FI_BATCH_SIZE;
    let data: Record<string, unknown> = {
      done: false,
      fi_total: initialFiTotal ?? 0,
      n_fi: startOffset,
    };

    while (!data.done) {
      const totalFi = Number(data.fi_total ?? initialFiTotal ?? 0);
      const labelTotal = totalFi > 0 ? totalFi : "?";
      const labelDone = totalFi > 0 ? Math.min(offset + batch, totalFi) : offset + batch;
      setImportProgress(`Paso 2/2 — creando FI ${labelDone}/${labelTotal}…`);

      const fdFi = baseFd();
      fdFi.append("phase", "fi");
      fdFi.append("fi_offset", String(offset));
      fdFi.append("fi_batch", String(batch));
      data = await postProformaImport(fdFi);

      if (data.done) break;

      const nextOff = Number(data.fi_offset_next);
      const nFi = Number(data.n_fi ?? 0);
      const fiTotal = Number(data.fi_total ?? totalFi);
      if (!Number.isFinite(nextOff) || nextOff <= offset) {
        throw new Error(
          fiTotal > 0
            ? `FI incompletas (${nFi}/${fiTotal}). Reintentá «Completar FI pendientes».`
            : "La fase FI se detuvo sin crear facturas — reintentá con el mismo Excel.",
        );
      }
      offset = nextOff;
    }

    const nFiFinal = Number(data.n_fi ?? 0);
    const fiTotalFinal = Number(data.fi_total ?? initialFiTotal ?? 0);
    if (fiTotalFinal > 0 && nFiFinal < fiTotalFinal) {
      throw new Error(`Solo ${nFiFinal}/${fiTotalFinal} FI — usá «Completar FI pendientes».`);
    }
    return data;
  }

  async function completarFiPendientes() {
    setBusy(true);
    setWaitPhase("import");
    setImportProgress("IC = PROFORMA = FI…");
    onMsg(null);
    try {
      const data = await ejecutarRatificarFiProgramado(pp.id, false);
      onMsg(`✓ ${resumenRatificarFi(data)}`);
      await onReload();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
      setWaitPhase(null);
      setImportProgress("");
    }
  }

  async function importarProforma() {
    if (!proformaFile) {
      onMsg("Seleccioná el archivo .xls/.xlsx de la proforma.");
      return;
    }
    if (!draft.numero_proforma.trim()) {
      onMsg("Completá Nro Proforma antes de importar.");
      return;
    }
    if (esProgramado && !previewOk) {
      onMsg("Ejecutá Preview emparejamiento SHOP↔IC antes de confirmar.");
      return;
    }
    setBusy(true);
    setWaitPhase("import");
    setImportProgress("");
    onMsg(null);
    try {
      const baseFd = (opts?: { borrarPrevio?: boolean }) => {
        const fd = new FormData();
        fd.append("file", proformaFile);
        fd.append("numero_proforma", draft.numero_proforma.trim());
        if (!sinStock && opts?.borrarPrevio) fd.append("borrar_previo", "1");
        return fd;
      };

      let data: Record<string, unknown>;
      if (esProgramado) {
        setImportProgress("Paso 1/2 — cargando stock PPD (moléculas)…");
        const fdPpd = baseFd({ borrarPrevio: true });
        fdPpd.append("phase", "ppd");
        data = await postProformaImport(fdPpd);
        data = await runProgramadoFiLoop(baseFd, 0, Number(data.fi_total ?? 0));
      } else {
        data = await postProformaImport(baseFd({ borrarPrevio: true }));
      }

      let msg = `Proforma importada · ${Number(data.pares ?? 0).toLocaleString("es-PY")} pares · ${data.n_articulos ?? "?"} moléculas.`;
      const pilaresReport = data.pilares_import as ProformaPilaresImportReport | undefined;
      if (pilaresReport) setPilaresImport(pilaresReport);
      const importAvisos = data.import_avisos as string[] | undefined;
      if (importAvisos?.length) {
        const nBib = pilaresReport?.lineas_sin_biblioteca.length ?? 0;
        msg += nBib > 0
          ? ` ⚠ ${nBib} línea(s) sin caso en biblioteca — asigná en Motor.`
          : ` ⚠ ${importAvisos.length} aviso(s) pilares/precio.`;
      }
      if (esProgramado) {
        const nFi = Number(data.n_fi ?? 0);
        const fiTotal = Number(data.fi_total ?? 0);
        if (nFi > 0) msg += ` ${nFi} FI programado.`;
        else if (fiTotal > 0) msg += ` ⚠ Sin FI (${fiTotal} esperadas) — usá «Completar FI pendientes».`;
      }
      onMsg(msg);
      setProformaFile(null);
      setPreviewRows(null);
      setPreviewOk(false);
      setPreviewAvisos([]);
      setPrecioAudit(null);
      await onReload();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
      setWaitPhase(null);
      setImportProgress("");
    }
  }

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
    setVincularConfirm(Number(eventoSel));
  }

  async function confirmarVincularListado() {
    if (vincularConfirm == null) return;
    setBusy(true);
    onMsg(null);
    try {
      const res = await fetch(`/api/proceso-importacion/pedido-proveedor/${pp.id}/vincular-listado`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evento_id: vincularConfirm,
          recalcular_fi: recalcFi,
          incluir_confirmadas: incluirFiConfirmadas,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al vincular");
      const snap = data.stats?.snapshot;
      const fi = data.stats;
      onMsg(
        [
          data.message ?? "Listado vinculado.",
          data.stats?.delta_monto_fi != null
            ? `Δ FI: Gs. ${Number(data.stats.delta_monto_fi).toLocaleString("es-PY")} (${Number(data.stats.monto_fi_antes ?? 0).toLocaleString("es-PY")} → ${Number(data.stats.monto_fi_despues ?? 0).toLocaleString("es-PY")})`
            : null,
          data.stats?.lineas_actualizadas != null
            ? `${data.stats.lineas_actualizadas} líneas FI con precio nuevo`
            : null,
          data.stats?.lineas_congeladas_venta
            ? `${data.stats.lineas_congeladas_venta} líneas vendidas congeladas`
            : null,
          snap?.actualizados != null ? `${snap.actualizados} PPD con saldo actualizados` : null,
          data.stats?.lineas_sin_precio
            ? `${data.stats.lineas_sin_precio} líneas con saldo sin LPN en evento`
            : null,
        ]
          .filter(Boolean)
          .join(" · "),
      );
      setVincularConfirm(null);
      await onReload();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function recalcularFiSolo() {
    if (!eventoDetalle?.evento_id) return;
    setBusy(true);
    onMsg(null);
    try {
      const res = await fetch(`/api/proceso-importacion/pedido-proveedor/${pp.id}/recalcular-fi`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incluir_confirmadas: incluirFiConfirmadas }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al recalcular");
      onMsg(data.message ?? "FI recalculadas.");
      await onReload();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <ProcesoImportacionWaitOverlay
        open={alzarLoading}
        title="Desplegando en RIMEC Web…"
        detail={`${pp.numero_registro} · EN_TRANSITO`}
        hint="Catálogo tránsito · v_stock_rimec"
      />
      <ProcesoImportacionWaitOverlay
        open={borrarLoading}
        title="Borrando importación…"
        detail={`${pp.numero_registro} · PPD + baja catálogo`}
        hint="Solo si ventas = 0"
      />
      <ProcesoImportacionWaitOverlay
        open={waitPhase === "preview"}
        title="Validando emparejamiento SHOP↔IC…"
        detail={`${pp.numero_registro} · leyendo Excel y cruzando con ICs`}
        hint="Suele tardar 30–90 segundos. No cierres la pestaña."
      />
      <ProcesoImportacionWaitOverlay
        open={waitPhase === "import"}
        title={
          esProgramado
            ? "Importando proforma PROGRAMADO…"
            : "Importando proforma…"
        }
        detail={
          importProgress ||
          (esProgramado
            ? `${pp.numero_registro} · ${(previewPares ?? pp.pares_comprometidos).toLocaleString("es-PY")} pares · pilares · FI por IC`
            : `${pp.numero_registro} · cargando PPD`)
        }
        hint={
          esProgramado
            ? "Varias llamadas cortas (PPD + lotes FI). No cierres la pestaña."
            : "Puede tardar 1–2 minutos. No cierres la pestaña."
        }
      />
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

          {pilaresImport && (
            <div className="rounded-xl border-2 border-amber-300 bg-amber-50/70 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-amber-900">Pilares × biblioteca (proforma)</h3>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-amber-950">
                {pilaresImport.avisos.map((av) => (
                  <li key={av}>{av}</li>
                ))}
              </ul>
              {pilaresImport.biblioteca_id && pilaresImport.lineas_sin_biblioteca.length > 0 ? (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <p className="text-xs text-amber-900">
                    <span className="font-mono font-semibold">
                      {pilaresImport.lineas_sin_biblioteca.join(", ")}
                    </span>{" "}
                    → sin caso en «{pilaresImport.biblioteca_nombre}»
                  </p>
                  <Link
                    href={urlBibliotecaAsignar(
                      pilaresImport.biblioteca_id,
                      pilaresImport.lineas_sin_biblioteca,
                    )}
                    className="rounded-lg bg-rimec-azul px-3 py-1.5 text-xs font-bold text-white hover:bg-rimec-azul-light"
                  >
                    Asignar en biblioteca →
                  </Link>
                </div>
              ) : null}
              {pilaresImport.lineas_en_biblioteca?.length ? (
                <div className="mt-3 rounded-lg border border-slate-200 bg-white/80 p-3">
                  <p className="text-[10px] font-bold uppercase text-slate-600">
                    Ya en biblioteca (no libres — revisar caso)
                  </p>
                  <ul className="mt-1 max-h-32 overflow-y-auto text-xs font-mono text-slate-800">
                    {pilaresImport.lineas_en_biblioteca.map((r) => (
                      <li key={r.codigo}>
                        {r.codigo} → <span className="font-semibold text-rimec-azul">{r.caso}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}

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
            {esProgramado && (
              <p className="mt-1 text-xs font-semibold text-violet-900">
                PROGRAMADO · compra_previa = false · Alejandro Magno (tercera entidad)
              </p>
            )}
            <p className="mt-2 text-xs text-slate-600">
              Archivo Beira Rio (.xls / .xlsx) · columna <strong>SHOP</strong> = código cliente IC ·{" "}
              <code className="text-[10px]">parse_proforma</code>
            </p>
            <input
              type="file"
              accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={!editable || busy}
              className="mt-3 block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-700 file:px-4 file:py-2 file:text-xs file:font-bold file:text-white hover:file:bg-violet-800"
              onChange={(e) => {
                setProformaFile(e.target.files?.[0] ?? null);
                setPreviewRows(null);
                setPreviewOk(false);
                setPreviewErrores([]);
              }}
            />
            {esProgramado && (
              <>
                <p className="mt-3 text-xs text-violet-900">
                  Protocolo manual: (1) Preview SHOP↔IC · (2) Confirmar import · (3) 1 FI por IC con cabecera IC +
                  detalle proforma.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || !editable || !proformaFile}
                    onClick={previewProformaProgramado}
                    className="rounded-lg border-2 border-violet-600 bg-white px-4 py-2 text-sm font-bold text-violet-800 hover:bg-violet-50 disabled:opacity-50"
                  >
                    {busy ? "…" : "1 · Preview emparejamiento SHOP↔IC"}
                  </button>
                  <button
                    type="button"
                    disabled={
                      busy ||
                      !editable ||
                      !proformaFile ||
                      !draft.numero_proforma.trim() ||
                      draft.quincena_arribo_id <= 0 ||
                      !previewOk
                    }
                    onClick={importarProforma}
                    className="rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-50"
                  >
                    {busy ? "Importando…" : "2 · Confirmar import programado →"}
                  </button>
                </div>
                {esProgramado && (
                  <ul className="mt-2 space-y-0.5 text-[11px] text-slate-600">
                    <li>{proformaFile ? "✅" : "⬜"} Archivo Excel seleccionado</li>
                    <li>{draft.numero_proforma.trim() ? "✅" : "⬜"} Nro proforma en cabecera</li>
                    <li>{draft.quincena_arribo_id > 0 ? "✅" : "⬜"} Fecha de embarque (quincena)</li>
                    <li>{previewOk ? "✅" : "⬜"} Preview SHOP↔IC sin errores (paso 1)</li>
                  </ul>
                )}
                {(previewRows || previewErrores.length > 0 || previewAvisos.length > 0) && (
                  <div className="mt-4 overflow-x-auto rounded-lg border border-violet-200 bg-white">
                    <table className="w-full min-w-[640px] text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-2 pl-3 pr-2">SHOP</th>
                          <th className="py-2 pr-2">IC</th>
                          <th className="py-2 pr-2">Cliente</th>
                          <th className="py-2 pr-2 text-right">Pares proforma</th>
                          <th className="py-2 pr-3 text-right">Pares IC</th>
                          <th className="py-2 pr-3">Match</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(previewRows ?? []).map((r) => (
                          <tr key={`${r.shop}-${r.ic_nro}`} className="border-b border-slate-100">
                            <td className="py-2 pl-3 pr-2 font-mono">{r.shop}</td>
                            <td className="py-2 pr-2 font-mono">{r.ic_nro}</td>
                            <td className="py-2 pr-2">{r.cliente_nombre}</td>
                            <td className="py-2 pr-2 text-right tabular-nums">{r.pares_proforma.toLocaleString("es-PY")}</td>
                            <td className="py-2 pr-3 text-right tabular-nums">{r.pares_ic.toLocaleString("es-PY")}</td>
                            <td className="py-2 pr-3">{r.match ? "✅" : "❌"}</td>
                          </tr>
                        ))}
                      </tbody>
                      {previewPares != null && (
                        <tfoot>
                          <tr className="font-bold text-violet-900">
                            <td colSpan={3} className="py-2 pl-3">
                              Total
                            </td>
                            <td className="py-2 pr-2 text-right tabular-nums">{previewPares.toLocaleString("es-PY")}</td>
                            <td colSpan={2} />
                          </tr>
                        </tfoot>
                      )}
                    </table>
                    {previewErrores.length > 0 && (
                      <ul className="list-disc px-4 py-2 text-xs text-red-700">
                        {previewErrores.map((err) => (
                          <li key={err}>{err}</li>
                        ))}
                      </ul>
                    )}
                    {previewAvisos.length > 0 && (
                      <div className="border-t border-amber-200 bg-amber-50/80 px-4 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                          Pilares × precio_lista (no bloquean import)
                        </p>
                        {precioAudit ? (
                          <p className="mt-1 text-xs text-amber-900">
                            {precioAudit.n_ok} OK · {precioAudit.n_sin_precio} sin LPN · {precioAudit.n_sin_caso}{" "}
                            sin caso · {precioAudit.n_pilares_faltantes} pilares incompletos
                          </p>
                        ) : null}
                        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-amber-900">
                          {previewAvisos.map((av) => (
                            <li key={av}>{av}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
            {!esProgramado && (
              <button
                type="button"
                disabled={
                  busy || !editable || !proformaFile || !draft.numero_proforma.trim() || draft.quincena_arribo_id <= 0
                }
                onClick={importarProforma}
                className="mt-4 rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-50"
              >
                {busy ? "Importando…" : "Importar proforma →"}
              </button>
            )}
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
          {/* Proforma ↔ Listado — vista vinculada */}
          <div className="rounded-xl border-2 border-rimec-azul/30 bg-gradient-to-r from-slate-50 to-sky-50/40 p-5 shadow-sm">
            <h2 className="font-serif text-lg text-rimec-azul-dark">Proforma ↔ Listado de precios</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-violet-200 bg-white px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600">Fatura proforma</p>
                <p className="mt-1 font-mono text-xl font-bold text-slate-900">
                  {pp.numero_proforma?.trim() || "— sin nro —"}
                </p>
                {pp.nro_pedido_externo ? (
                  <p className="mt-0.5 text-xs text-slate-500">PP externo: {pp.nro_pedido_externo}</p>
                ) : null}
              </div>
              <div className="rounded-lg border border-emerald-200 bg-white px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Listado RIMEC vinculado</p>
                {eventoDetalle ? (
                  <>
                    <p className="mt-1 font-mono text-xl font-bold text-emerald-900">{eventoDetalle.nombre_evento}</p>
                    <p className="mt-0.5 text-xs text-slate-600">
                      {eventoDetalle.n_precios} precios · {eventoDetalle.estado} · evento #{eventoDetalle.evento_id}
                      {eventoDetalle.biblioteca ? ` · ${eventoDetalle.biblioteca}` : ""}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-sm font-semibold text-amber-800">Sin listado — vinculá abajo antes de alzar</p>
                )}
              </div>
            </div>
          </div>

          {esCompraPrevia && (
            <div
              className={`rounded-xl border-2 p-5 shadow-md ${
                pp.web_alzado
                  ? "border-emerald-400 bg-emerald-50"
                  : "border-sky-500 bg-gradient-to-br from-sky-100 to-white"
              }`}
            >
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="font-serif text-xl text-rimec-azul-dark">
                    {pp.web_alzado ? "✅ Desplegado en RIMEC Web" : "🚢 Desplegar en RIMEC Web"}
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm text-slate-700">
                    {pp.web_alzado
                      ? "Vendedores ven este PP en catálogo tránsito (compra previa). Si la proforma es incorrecta, borrá e importá de nuevo."
                      : "Alzar pone el stock a disposición de vendedores en rimec-web.vercel.app (solo compra previa · TRÁNSITO_PP)."}
                  </p>
                  {alzarPreview && (
                    <p className="mt-2 text-sm text-slate-600">
                      {alzarPreview.moleculas} moléculas · {alzarPreview.pares_saldo.toLocaleString("es-PY")} pares
                      saldo · listado {alzarPreview.listado_nombre ?? "—"}
                    </p>
                  )}
                  {alzarPreview?.bloqueos.length ? (
                    <ul className="mt-2 list-disc pl-4 text-sm text-red-800">
                      {alzarPreview.bloqueos.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  ) : null}
                  {alzarPreview?.avisos.map((a) => (
                    <p key={a} className="mt-1 text-sm text-amber-800">
                      ⚠ {a}
                    </p>
                  ))}
                </div>
                {!pp.web_alzado && (
                  <button
                    type="button"
                    disabled={alzarLoading || busy || !alzarPreview?.ok}
                    onClick={() => void alzarEnRimecWeb()}
                    className="w-full rounded-xl bg-sky-600 px-8 py-5 text-lg font-extrabold text-white shadow-lg transition hover:bg-sky-700 disabled:opacity-40 sm:w-auto sm:min-w-[320px]"
                  >
                    {alzarLoading ? "Desplegando…" : "🚀 DESPLEGAR EN RIMEC WEB →"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Borrar y reimportar — clon Streamlit */}
          {esProgramado && pp.total_articulos > 0 && pp.n_facturas_internas === 0 && (
            <div className="rounded-lg border border-amber-400 bg-amber-50 px-4 py-3">
              <p className="text-sm font-bold text-amber-900">Stock cargado · faltan facturas internas</p>
              <p className="mt-1 text-xs text-amber-950">
                {pp.total_articulos} moléculas · <strong>0 FI</strong> — generá con paridad marca×caso (riguroso).
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void completarFiPendientes()}
                className="mt-3 rounded-lg border-2 border-violet-600 bg-violet-700 px-4 py-2 text-xs font-bold text-white hover:bg-violet-800 disabled:opacity-50"
              >
                {busy ? "Generando…" : "⚡ IC = PROFORMA = FI"}
              </button>
            </div>
          )}

          {borrarEstado && borrarEstado.n_articulos > 0 && (
            <div className="rounded-lg border border-red-300 bg-red-950/5 px-4 py-3">
              <p className="text-sm font-bold text-red-800">Importación incorrecta</p>
              <p className="mt-1 text-xs text-slate-600">
                Si el Excel salió mal (Ref. vacía, nan, proforma equivocada), podés borrar{" "}
                <strong>todo el stock importado</strong> y cargar la proforma otra vez. Solo si{" "}
                <strong>ventas = 0</strong>.
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {borrarEstado.n_articulos} artículos · {borrarEstado.pares_total.toLocaleString("es-PY")} pares ·
                vendidos Web: <strong>{borrarEstado.vendido.toLocaleString("es-PY")}</strong>
                {(borrarEstado.comprometido_fi ?? 0) > 0 && (
                  <>
                    {" "}
                    · reservados FI:{" "}
                    <strong>{borrarEstado.comprometido_fi.toLocaleString("es-PY")}</strong>
                  </>
                )}
                {borrarEstado.n_facturas > 0 && (
                  <> · {borrarEstado.n_facturas} FI (se eliminan al borrar)</>
                )}
                {borrarEstado.web_alzado ? " · baja automática del catálogo al borrar" : ""}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {!borrarEstado.puede_borrar ? (
                  <span className="text-xs text-red-700">{borrarEstado.motivo}</span>
                ) : borrarConfirm ? (
                  <>
                    <span className="text-sm font-semibold text-red-900">¿Borrar toda la importación?</span>
                    <button
                      type="button"
                      disabled={borrarLoading}
                      onClick={() => void borrarImportacion()}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {borrarLoading ? "Borrando…" : "Sí, borrar todo"}
                    </button>
                    <button
                      type="button"
                      disabled={borrarLoading}
                      onClick={() => setBorrarConfirm(false)}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={borrarLoading || busy}
                    onClick={() => setBorrarConfirm(true)}
                    className="rounded-lg border-2 border-red-400 bg-white px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    🗑️ Borrar y reimportar
                  </button>
                )}
              </div>
            </div>
          )}

          <details className="rounded-lg border border-slate-200 bg-white">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-rimec-azul-dark [&::-webkit-details-marker]:hidden">
              <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>Ala Norte · F9 / Proforma</span>
                <span className="text-xs font-normal text-slate-600">
                  {alaNorte.length} moléculas · {totalStockPares.toLocaleString("es-PY")} pares iniciales ·{" "}
                  {pp.total_vendido.toLocaleString("es-PY")} vendidos · {pp.saldo.toLocaleString("es-PY")} disponibles
                </span>
              </span>
            </summary>
            <div className="border-t border-slate-200 px-4 pb-4 pt-3">
              {variasMarcas && (
                <details className="mb-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs">
                  <summary className="cursor-pointer font-semibold text-slate-700">Ver resumen por marca</summary>
                  <table className="mt-2 w-full max-w-md text-left">
                    <thead>
                      <tr className="text-slate-500">
                        <th className="py-1 pr-2">Marca</th>
                        <th className="py-1 pr-2 text-right">Inicial</th>
                        <th className="py-1 pr-2 text-right">Vendido</th>
                        <th className="py-1 text-right">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumenMarca.map((m) => (
                        <tr key={m.marca} className="border-t border-slate-200">
                          <td className="py-1 pr-2">{m.marca}</td>
                          <td className="py-1 pr-2 text-right tabular-nums">{m.inicial.toLocaleString("es-PY")}</td>
                          <td className="py-1 pr-2 text-right tabular-nums">{m.vendido.toLocaleString("es-PY")}</td>
                          <td className="py-1 text-right tabular-nums">{m.saldo.toLocaleString("es-PY")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )}
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full min-w-[1200px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="sticky left-0 z-10 bg-white py-2 pl-3 pr-2">Marca</th>
                      <th className="py-2 pr-2">Línea</th>
                      <th className="py-2 pr-2">Ref.</th>
                      <th className="py-2 pr-2">Código</th>
                      <th className="py-2 pr-2">Cód.Mat</th>
                      <th className="py-2 pr-2">Material</th>
                      <th className="py-2 pr-2">Cód.Col</th>
                      <th className="py-2 pr-2">Color</th>
                      <th className="py-2 pr-2">Tallas</th>
                      <th className="py-2 pr-2 text-center">x Caja</th>
                      {gradeColumns.map((g) => (
                        <th key={g} className="min-w-[2rem] py-2 px-1 text-center font-mono text-slate-600">
                          {g}
                        </th>
                      ))}
                      <th className="py-2 pr-2 text-right">Inicial</th>
                      <th className="py-2 pr-2 text-right">Vendido</th>
                      <th className="py-2 pr-3 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alaNorte.map((r) => {
                      const xCaja = paresPorCaja(r);
                      return (
                        <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                          <td className="sticky left-0 z-10 bg-white py-1.5 pl-3 pr-2">{r.marca}</td>
                          <td className="py-1.5 pr-2 font-mono">{r.linea}</td>
                          <td className="py-1.5 pr-2 font-mono">{r.referencia}</td>
                          <td className="py-1.5 pr-2 font-mono text-slate-600">
                            {r.style_code ?? `${r.linea}.${r.referencia}`}
                          </td>
                          <td className="py-1.5 pr-2 font-mono">{r.material_code ?? "—"}</td>
                          <td className="py-1.5 pr-2">{r.material}</td>
                          <td className="py-1.5 pr-2 font-mono">{r.color_code ?? "—"}</td>
                          <td className="py-1.5 pr-2">{r.color}</td>
                          <td className="py-1.5 pr-2 font-mono text-slate-600">{r.grada ?? "—"}</td>
                          <td className="py-1.5 pr-2 text-center tabular-nums">{xCaja ?? "—"}</td>
                          {gradeColumns.map((g) => {
                            const q = gradeQty(r, g);
                            return (
                              <td
                                key={g}
                                className={`px-1 py-1.5 text-center font-mono tabular-nums ${q > 0 ? "font-semibold text-rimec-azul-dark" : "text-slate-400"}`}
                              >
                                {q}
                              </td>
                            );
                          })}
                          <td className="py-1.5 pr-2 text-right tabular-nums">{r.cantidad_inicial.toLocaleString("es-PY")}</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums">{r.vendido.toLocaleString("es-PY")}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums font-semibold">{r.saldo.toLocaleString("es-PY")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                1 fila = 1 molécula (L+R+mat+color+grada). Columnas numéricas = unidades por talla en{" "}
                <code className="rounded bg-slate-100 px-1">grades_json</code>.
              </p>
            </div>
          </details>
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
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
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
                disabled={busy || eventoSel === "" || eventoSel === eventoDetalle?.evento_id}
                onClick={vincularListado}
                className="rounded-lg border-2 border-rimec-azul bg-rimec-azul px-4 py-2 text-xs font-bold text-white hover:bg-rimec-azul-dark disabled:opacity-50"
              >
                🔗 Vincular al PP
              </button>
            </div>
            <div className="flex flex-col gap-2 text-xs text-slate-700">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={recalcFi}
                  onChange={(e) => setRecalcFi(e.target.checked)}
                  disabled={busy}
                />
                Al vincular, recalcular facturas internas RESERVADA
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={incluirFiConfirmadas}
                  onChange={(e) => setIncluirFiConfirmadas(e.target.checked)}
                  disabled={busy || !recalcFi}
                />
                Incluir también FI CONFIRMADA (avanzado)
              </label>
            </div>
            {eventoDetalle && (
              <button
                type="button"
                disabled={busy}
                onClick={recalcularFiSolo}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                ↻ Recalcular FI (sin cambiar listado)
              </button>
            )}
            {vincularConfirm != null && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-xs text-amber-950">
                <p>
                  ¿Vincular evento <strong>#{vincularConfirm}</strong> a este PP?
                  {recalcFi ? " Se recalcularán las FI abiertas." : ""}
                  {incluirFiConfirmadas && recalcFi ? " Incluye CONFIRMADA." : ""}
                </p>
                <p className="mt-1 text-slate-600">
                  Filas PPD 100 % vendidas conservan su LP; solo se actualiza stock con saldo disponible.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={confirmarVincularListado}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Sí, vincular
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setVincularConfirm(null)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-white disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
