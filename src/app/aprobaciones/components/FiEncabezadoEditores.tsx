"use client";

import { useEffect, useState } from "react";
import {
  actualizarEncabezadoFiAction,
  cambiarClienteFiAction,
  cambiarVendedorFiAction,
  resincronizarFiDesdeListadoPpAction,
} from "../actions";
import type { AprobacionesCatalogos, FiRecord } from "../lib/aprobaciones-types";
import { fmtDescuentoPct, plazoDisplay } from "../lib/aprobaciones-utils";

type Feedback = (tipo: "success" | "error", texto: string) => void;

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
  const [d, setD] = useState([
    fi.descuento_1,
    fi.descuento_2,
    fi.descuento_3,
    fi.descuento_4,
  ]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setD([fi.descuento_1, fi.descuento_2, fi.descuento_3, fi.descuento_4]);
  }, [fi.descuento_1, fi.descuento_2, fi.descuento_3, fi.descuento_4]);

  async function guardar() {
    if (!plazoId) {
      onFeedback?.("error", "Elegí un plazo antes de guardar descuentos.");
      return;
    }
    setGuardando(true);
    const res = await actualizarEncabezadoFiAction(fi.id, {
      plazoId,
      descuento_1: d[0],
      descuento_2: d[1],
      descuento_3: d[2],
      descuento_4: d[3],
    });
    if (res.success) {
      onFeedback?.("success", res.message ?? "Descuentos aplicados.");
      onApplied?.();
    } else {
      onFeedback?.("error", res.error ?? "Error al aplicar descuentos.");
    }
    setGuardando(false);
  }

  if (!editable) {
    return (
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border-2 border-neutral-200 bg-white px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-rimec-azul">
              Desc. {i + 1}
            </p>
            <p className="mt-0.5 text-sm font-semibold">{fmtDescuentoPct(d[i])}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <label key={i} className="rounded-lg border-2 border-neutral-200 bg-white px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rimec-azul">
              Desc. {i + 1} %
            </span>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={d[i]}
              onChange={(e) => {
                const next = [...d] as [number, number, number, number];
                next[i] = Number(e.target.value) || 0;
                setD(next);
              }}
              className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm font-bold"
            />
          </label>
        ))}
      </div>
      <button
        type="button"
        disabled={guardando}
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
