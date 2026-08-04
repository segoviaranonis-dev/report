"use client";

import { useEffect, useState } from "react";
import {
  actualizarEncabezadoFiAction,
  cambiarClienteFiAction,
  cambiarVendedorFiAction,
  resincronizarFiDesdeListadoPpAction,
} from "../actions";
import type { AprobacionesCatalogos, FiRecord } from "../lib/aprobaciones-types";
import {
  descuentoInputDisplay,
  fmtDescuentoPct,
  fmtGs,
  normalizarDescuentos4,
  parseDescuentoInput,
  plazoDisplay,
  sanitizeDescuentoTyping,
} from "../lib/aprobaciones-utils";

type Feedback = (tipo: "success" | "error", texto: string) => void;

/** Factor cascada d1→d4 (preview de ratificación). */
function factorCascada(desc: number[]): number {
  let f = 1;
  for (const d of desc) {
    const pct = Number(d) || 0;
    if (pct > 0) f *= 1 - pct / 100;
  }
  return f;
}

/** Neto post-descuento: Gs enteros · sin centena (ley carrito / pre-FI). */
function montoPostDescuento(n: number): number {
  return Math.round(n);
}

export function ClienteEditor({
  fi,
  editable,
  onFeedback,
  onApplied,
}: {
  fi: FiRecord;
  editable: boolean;
  onFeedback?: Feedback;
  onApplied?: () => void;
}) {
  const [codigo, setCodigo] = useState(String(fi.cliente_id ?? ""));
  const [nombre, setNombre] = useState(fi.cliente_nombre ?? "");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setCodigo(String(fi.cliente_id ?? ""));
    setNombre(fi.cliente_nombre ?? "");
  }, [fi.cliente_id, fi.cliente_nombre]);

  async function aplicar() {
    const id = parseInt(codigo, 10);
    if (!Number.isFinite(id) || id <= 0) {
      onFeedback?.("error", "Código de cliente inválido.");
      return;
    }
    setGuardando(true);
    const res = await cambiarClienteFiAction(fi.id, id);
    if (res.success) {
      if (res.clienteNombre) setNombre(res.clienteNombre);
      onFeedback?.("success", res.message ?? "Cliente actualizado.");
      onApplied?.();
    } else {
      onFeedback?.("error", res.error ?? "Error al cambiar cliente.");
    }
    setGuardando(false);
  }

  return (
    <div className="min-w-0 flex-1">
      {editable ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-bold uppercase tracking-widest text-rimec-azul">
            Cliente · Cod.
            <input
              type="number"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              className="mt-1 block w-28 rounded border border-neutral-300 px-2 py-1 text-sm font-bold"
            />
          </label>
          <button
            type="button"
            disabled={guardando}
            onClick={aplicar}
            className="rounded bg-rimec-azul px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            {guardando ? "…" : "Aplicar"}
          </button>
        </div>
      ) : (
        fi.cliente_id != null && (
          <p className="text-xs font-bold uppercase tracking-widest text-rimec-azul">
            Cliente · Cod. {fi.cliente_id}
          </p>
        )
      )}
      <h3 className="mt-1 font-serif text-xl font-semibold leading-snug text-rimec-azul-dark sm:text-2xl">
        {nombre || "Sin cliente"}
      </h3>
    </div>
  );
}

export function VendedorEditor({
  fi,
  vendedores,
  editable,
  onFeedback,
  onApplied,
}: {
  fi: FiRecord;
  vendedores: AprobacionesCatalogos["vendedores"];
  editable: boolean;
  onFeedback?: Feedback;
  onApplied?: () => void;
}) {
  const [actual, setActual] = useState(fi.vendedor_id ?? 0);
  const [nombre, setNombre] = useState(fi.vendedor_nombre ?? "—");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setActual(fi.vendedor_id ?? 0);
    setNombre(fi.vendedor_nombre ?? "—");
  }, [fi.vendedor_id, fi.vendedor_nombre]);

  async function onChange(v: number) {
    if (v === actual || guardando) return;
    setGuardando(true);
    const res = await cambiarVendedorFiAction(fi.id, v);
    if (res.success) {
      setActual(v);
      if (res.vendedorNombre) setNombre(res.vendedorNombre);
      onFeedback?.("success", res.message ?? "Vendedor actualizado.");
      onApplied?.();
    } else {
      onFeedback?.("error", res.error ?? "Error al cambiar vendedor.");
    }
    setGuardando(false);
  }

  if (!editable) {
    return (
      <div className="rounded-lg border-2 border-rimec-azul/40 bg-rimec-azul/10 px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-rimec-azul">Usuario vendedor</p>
        <p className="mt-0.5 text-sm font-semibold text-rimec-azul-dark">{nombre}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-rimec-azul/40 bg-rimec-azul/10 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-rimec-azul">Usuario vendedor</p>
      <select
        value={actual || ""}
        disabled={guardando}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm font-semibold"
      >
        <option value="">— Elegir —</option>
        {vendedores.map((v) => (
          <option key={v.id} value={v.id}>
            {v.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}

export function PlazoEditor({
  fi,
  plazos,
  editable,
  descuentos,
  onFeedback,
  onApplied,
  onPlazoChange,
}: {
  fi: FiRecord;
  plazos: AprobacionesCatalogos["plazos"];
  editable: boolean;
  descuentos: [number, number, number, number];
  onFeedback?: Feedback;
  onApplied?: () => void;
  onPlazoChange?: (id: number) => void;
}) {
  const [plazoId, setPlazoId] = useState(fi.plazo_id ?? 0);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setPlazoId(fi.plazo_id ?? 0);
  }, [fi.plazo_id]);

  async function onChange(v: number) {
    if (v === plazoId || guardando || !v) return;
    setGuardando(true);
    const res = await actualizarEncabezadoFiAction(fi.id, {
      plazoId: v,
      descuento_1: descuentos[0],
      descuento_2: descuentos[1],
      descuento_3: descuentos[2],
      descuento_4: descuentos[3],
    });
    if (res.success) {
      setPlazoId(v);
      onPlazoChange?.(v);
      onFeedback?.("success", res.message ?? "Plazo actualizado.");
      onApplied?.();
    } else {
      onFeedback?.("error", res.error ?? "Error al cambiar plazo.");
    }
    setGuardando(false);
  }

  if (!editable) {
    return (
      <div className="rounded-lg border-2 border-rimec-azul/40 bg-rimec-azul/10 px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-rimec-azul">Plazo</p>
        <p className="mt-0.5 text-lg font-semibold text-rimec-azul-dark">{plazoDisplay(fi)}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-rimec-azul/40 bg-rimec-azul/10 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-rimec-azul">Plazo</p>
      <select
        value={plazoId || ""}
        disabled={guardando}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm font-bold text-rimec-azul-dark"
      >
        <option value="">—</option>
        {plazos.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}

export function DescuentosEditor({
  fi,
  editable,
  plazoId,
  onFeedback,
  onApplied,
}: {
  fi: FiRecord;
  editable: boolean;
  plazoId: number;
  onFeedback?: Feedback;
  onApplied?: () => void;
}) {
  const descGuardados: [number, number, number, number] = [
    fi.descuento_1,
    fi.descuento_2,
    fi.descuento_3,
    fi.descuento_4,
  ];
  const [dStr, setDStr] = useState(() => descGuardados.map(descuentoInputDisplay));
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setDStr(descGuardados.map(descuentoInputDisplay));
  }, [fi.descuento_1, fi.descuento_2, fi.descuento_3, fi.descuento_4]);

  const parsedDraft = normalizarDescuentos4(dStr.map(parseDescuentoInput));
  const alterado =
    parsedDraft[0] !== descGuardados[0] ||
    parsedDraft[1] !== descGuardados[1] ||
    parsedDraft[2] !== descGuardados[2] ||
    parsedDraft[3] !== descGuardados[3];

  const fGuardado = factorCascada(descGuardados);
  const fDraft = factorCascada(parsedDraft);
  const f20 = factorCascada([20, 0, 0, 0]);
  const totalActual = Number(fi.total_monto) || 0;
  // Bruto estimado desde total actual ÷ factor de descuentos guardados
  const brutoEst =
    fGuardado > 0.0001 ? montoPostDescuento(totalActual / fGuardado) : totalActual;
  const montoSinDesc = brutoEst;
  const monto20 = montoPostDescuento(brutoEst * f20);
  const montoDraft = montoPostDescuento(brutoEst * fDraft);
  const montoGuardado = totalActual;

  async function guardar() {
    if (!plazoId) {
      onFeedback?.("error", "Elegí un plazo antes de guardar descuentos.");
      return;
    }
    const parsed = normalizarDescuentos4(dStr.map(parseDescuentoInput));
    setGuardando(true);
    const res = await actualizarEncabezadoFiAction(fi.id, {
      plazoId,
      descuento_1: parsed[0],
      descuento_2: parsed[1],
      descuento_3: parsed[2],
      descuento_4: parsed[3],
    });
    if (res.success) {
      onFeedback?.("success", res.message ?? "Descuentos aplicados.");
      onApplied?.();
    } else {
      onFeedback?.("error", res.error ?? "Error al aplicar descuentos.");
    }
    setGuardando(false);
  }

  const panelComparacion = (
    <div
      className={`mt-2 rounded-lg border-2 px-3 py-2 text-xs ${
        alterado
          ? "border-amber-500 bg-amber-50 text-amber-950"
          : "border-rimec-azul/30 bg-rimec-azul/5 text-rimec-azul-dark"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider">
        {alterado ? "Descuentos alterados — ratificá antes de aplicar" : "Montos (referencia)"}
      </p>
      <div className="mt-1 grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
        <p>
          <span className="font-semibold">Sin desc.:</span> {fmtGs(montoSinDesc)}
        </p>
        <p>
          <span className="font-semibold">Con 20 %:</span> {fmtGs(monto20)}
        </p>
        <p>
          <span className="font-semibold">Guardado ({descGuardados.filter((d) => d > 0).join("+") || "0"}%):</span>{" "}
          {fmtGs(montoGuardado)}
        </p>
        <p className={alterado ? "font-black text-amber-900" : ""}>
          <span className="font-semibold">
            Draft ({parsedDraft.filter((d) => d > 0).join("+") || "0"}%):
          </span>{" "}
          {fmtGs(montoDraft)}
        </p>
      </div>
      {alterado && (
        <p className="mt-1 text-[10px] font-medium">
          Al aplicar: recalcula FI + PVR. La edición queda firme (no vuelve al dictado 20 %).
        </p>
      )}
    </div>
  );

  if (!editable) {
    return (
      <div className="mt-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`rounded-lg border-2 px-3 py-2 ${
                descGuardados[i] > 0
                  ? "border-amber-500/60 bg-amber-50"
                  : "border-neutral-200 bg-white"
              }`}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-rimec-azul">
                Desc. {i + 1}
              </p>
              <p className="mt-0.5 text-sm font-semibold">{fmtDescuentoPct(descGuardados[i])}</p>
            </div>
          ))}
        </div>
        {panelComparacion}
      </div>
    );
  }

  return (
    <div className="mt-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <label
            key={i}
            className={`rounded-lg border-2 bg-white px-3 py-2 ${
              alterado && parsedDraft[i] !== descGuardados[i]
                ? "border-amber-500 ring-1 ring-amber-400"
                : "border-neutral-200"
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-rimec-azul">
              Desc. {i + 1} %
            </span>
            <input
              type="text"
              inputMode="decimal"
              placeholder=""
              value={dStr[i]}
              onChange={(e) => {
                const next = [...dStr];
                next[i] = sanitizeDescuentoTyping(e.target.value);
                setDStr(next);
              }}
              className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm font-bold"
            />
          </label>
        ))}
      </div>
      {panelComparacion}
      <button
        type="button"
        disabled={guardando || !alterado}
        onClick={guardar}
        className="mt-2 rounded bg-rimec-azul px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
      >
        {guardando ? "Aplicando…" : "Aplicar descuentos (recalcula FI + PVR)"}
      </button>
      <ResyncListadoButton fi={fi} onFeedback={onFeedback} onApplied={onApplied} />
    </div>
  );
}

function ResyncListadoButton({
  fi,
  onFeedback,
  onApplied,
}: {
  fi: FiRecord;
  onFeedback?: Feedback;
  onApplied?: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function resync() {
    if (
      !window.confirm(
        "Resincronizar precios desde el listado PP vigente (evento ICP). Corrige vinculaciones erróneas. ¿Continuar?",
      )
    ) {
      return;
    }
    setBusy(true);
    const res = await resincronizarFiDesdeListadoPpAction(fi.id);
    if (res.success) {
      onFeedback?.("success", res.message ?? "Precios resincronizados.");
      onApplied?.();
    } else {
      onFeedback?.("error", res.error ?? "Error al resincronizar.");
    }
    setBusy(false);
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={resync}
      className="mt-2 ml-2 rounded border-2 border-amber-500 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 disabled:opacity-50"
    >
      {busy ? "Resincronizando…" : "Resincronizar con listado PP"}
    </button>
  );
}
