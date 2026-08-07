"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { actualizarLogisticaFiAction } from "../actions";
import type { FiEstado } from "../lib/aprobaciones-types";

export type ObsHiloItem = {
  id: number;
  origen: string;
  usuario_nombre: string;
  texto: string;
  created_at: string;
};

type Props = {
  fiId: number;
  estado: FiEstado;
  origenPe: boolean;
  observacion: string | null;
  fechaEntregaCliente: string | null;
  editable?: boolean;
  logisticaEditable?: boolean;
  onFeedback?: (tipo: "success" | "error", texto: string) => void;
  onApplied?: () => void;
};

const ORIGEN_LABEL: Record<string, string> = {
  PE_WEB: "Carrito Web",
  APROBACION: "Aprobación",
  IC: "IC",
  PP: "PP",
};

function fmtObsFecha(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-PY", {
    timeZone: "America/Asuncion",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Paridad visual carrito RIMEC Web — verde #ECFDF5 / borde #059669 */
export function FiObservacionesPanel({
  fiId,
  estado,
  origenPe,
  observacion,
  fechaEntregaCliente,
  editable = true,
  logisticaEditable,
  onFeedback,
  onApplied,
}: Props) {
  const estadoUpper = (estado || "").toUpperCase();
  const puedeAdmin = editable && estadoUpper !== "ANULADA";
  const puedeLogistica = (logisticaEditable ?? editable) && estadoUpper !== "ANULADA";
  const aprobadoConObs =
    estadoUpper === "CONFIRMADA" &&
    Boolean((observacion ?? "").trim() || (fechaEntregaCliente ?? "").trim());

  const [obsLocal, setObsLocal] = useState(observacion ?? "");
  const [fechaLocal, setFechaLocal] = useState(fechaEntregaCliente?.slice(0, 10) ?? "");
  const [guardandoLog, setGuardandoLog] = useState(false);
  const [hilo, setHilo] = useState<ObsHiloItem[]>([]);
  const [cargandoHilo, setCargandoHilo] = useState(false);
  const [hiloSolicitado, setHiloSolicitado] = useState(false);
  const [adminDraft, setAdminDraft] = useState("");
  const [enviandoAdmin, setEnviandoAdmin] = useState(false);

  // PE pendiente: pocos cards — auto-cargar hilo. Aprobados×N: NO (era el hang).
  const autoCargarHilo = origenPe && estadoUpper === "RESERVADA";

  useEffect(() => {
    setObsLocal(observacion ?? "");
    setFechaLocal(fechaEntregaCliente?.slice(0, 10) ?? "");
  }, [observacion, fechaEntregaCliente]);

  const cargarHilo = useCallback(async () => {
    setCargandoHilo(true);
    try {
      const res = await fetch(`/api/aprobaciones/facturas/${fiId}/observaciones`, {
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) throw new Error(String(res.status));
      const j = (await res.json()) as { items?: ObsHiloItem[] };
      setHilo(Array.isArray(j.items) ? j.items : []);
    } catch {
      setHilo([]);
    } finally {
      setCargandoHilo(false);
      setHiloSolicitado(true);
    }
  }, [fiId]);

  useEffect(() => {
    if (!autoCargarHilo || hiloSolicitado) return;
    void cargarHilo();
  }, [autoCargarHilo, hiloSolicitado, cargarHilo]);

  // RESERVADA: panel siempre (edición). CONFIRMADA/otros: solo si ya hay obs/fecha/PE.
  // Evita pintar 200 paneles verdes en pestaña Aprobados (UI + fetches).
  const tieneContenido =
    origenPe ||
    obsLocal.trim() ||
    fechaLocal.trim() ||
    hilo.length > 0 ||
    (estadoUpper === "RESERVADA" && (puedeAdmin || puedeLogistica));

  if (!tieneContenido) return null;

  async function guardarLogistica() {
    setGuardandoLog(true);
    const res = await actualizarLogisticaFiAction(fiId, {
      observacion: obsLocal.trim() || null,
      fecha_entrega_cliente: fechaLocal.trim().slice(0, 10) || null,
    });
    if (res.success) {
      onFeedback?.("success", res.message ?? "Observación guardada.");
      onApplied?.();
    } else {
      onFeedback?.("error", res.error ?? "No se pudo guardar.");
    }
    setGuardandoLog(false);
  }

  async function agregarAdmin() {
    const texto = adminDraft.trim();
    if (!texto) return;
    setEnviandoAdmin(true);
    try {
      const res = await fetch(`/api/aprobaciones/facturas/${fiId}/observaciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error ?? String(res.status));
      setAdminDraft("");
      onFeedback?.("success", "Nota administrativa agregada.");
      await cargarHilo();
      onApplied?.();
    } catch (e) {
      onFeedback?.("error", e instanceof Error ? e.message : "Error al agregar nota.");
    } finally {
      setEnviandoAdmin(false);
    }
  }

  return (
    <section className="mx-4 mb-4 mt-2 rounded-2xl border-2 border-emerald-600 bg-emerald-50 p-4 sm:mx-5 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-base font-black text-emerald-900">
          Entrega al cliente · Pronta entrega
        </h3>
        {aprobadoConObs ? (
          <span className="rounded-md bg-emerald-600 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
            ✓ Aprobado con observaciones
          </span>
        ) : null}
        {origenPe && estadoUpper === "RESERVADA" ? (
          <span className="text-[11px] font-semibold text-emerald-800">
            — mensaje del vendedor en carrito Web
          </span>
        ) : null}
      </div>

      <p className="mb-4 text-[13px] leading-snug text-emerald-800">
        Lo que el vendedor dejó al confirmar — visible en Logística OK. Nivel Dios puede corregir
        antes o después de aprobar.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs sm:col-span-1">
          <span className="mb-1.5 block text-[13px] font-bold text-emerald-900">
            Fecha de entrega al cliente
          </span>
          <input
            type="date"
            value={fechaLocal}
            disabled={!puedeLogistica}
            onChange={(e) => setFechaLocal(e.target.value)}
            className={`w-full max-w-[220px] rounded-[10px] px-3 py-2.5 text-[15px] ${
              fechaLocal
                ? "border border-emerald-500"
                : "border border-amber-500"
            } disabled:opacity-70`}
          />
          {!fechaLocal && puedeLogistica ? (
            <span className="mt-1.5 block text-xs text-amber-800">
              Sin fecha → pendiente de confirmación en Logística OK
            </span>
          ) : null}
        </label>
      </div>

      <label className="mt-3 block">
        <span className="mb-1.5 block text-[13px] font-bold text-emerald-900">
          Logística (carrito / vendedor)
        </span>
        <textarea
          value={obsLocal}
          disabled={!puedeLogistica}
          onChange={(e) => setObsLocal(e.target.value)}
          placeholder="Ej.: entregar por la mañana, llamar antes, acceso por lateral…"
          rows={3}
          maxLength={2000}
          className="w-full resize-y rounded-[10px] border border-emerald-300 px-3 py-2.5 text-sm disabled:opacity-70"
        />
      </label>

      {puedeLogistica ? (
        <div className="mt-2">
          <Button
            size="sm"
            onClick={() => void guardarLogistica()}
            disabled={guardandoLog}
            className="bg-emerald-700 font-bold text-white hover:bg-emerald-600"
          >
            {guardandoLog ? "Guardando…" : "Guardar observación logística"}
          </Button>
        </div>
      ) : null}

      <div className="mt-5 border-t border-emerald-300/80 pt-4">
        <p className="mb-2 text-[13px] font-bold text-emerald-900">
          Observaciones administrativas · Aprobación
        </p>
        {!hiloSolicitado && !autoCargarHilo ? (
          <Button
            size="sm"
            variant="secondary"
            className="mb-3 border-emerald-600 text-emerald-900 hover:bg-emerald-100"
            disabled={cargandoHilo}
            onClick={() => void cargarHilo()}
          >
            {cargandoHilo ? "Cargando…" : "Ver historial de notas"}
          </Button>
        ) : null}
        {cargandoHilo ? (
          <p className="mb-2 text-xs text-emerald-700">Cargando historial…</p>
        ) : null}
        {hiloSolicitado && !cargandoHilo && hilo.length === 0 ? (
          <p className="mb-2 text-xs text-emerald-700/80">Sin notas en el hilo aún.</p>
        ) : null}
        {hiloSolicitado && !cargandoHilo && hilo.length > 0 ? (
          <ul className="mb-3 max-h-40 space-y-2 overflow-y-auto">
            {hilo.map((item) => (
              <li
                key={item.id}
                className={`rounded-lg border px-3 py-2 text-xs ${
                  item.origen === "APROBACION"
                    ? "border-emerald-500/60 bg-white"
                    : "border-emerald-200/80 bg-emerald-50/50"
                }`}
              >
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 font-semibold text-emerald-900">
                  <span>{ORIGEN_LABEL[item.origen] ?? item.origen}</span>
                  <span className="font-normal text-emerald-700">· {item.usuario_nombre}</span>
                  <span className="font-normal tabular-nums text-emerald-600">
                    {fmtObsFecha(item.created_at)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-neutral-800">{item.texto}</p>
              </li>
            ))}
          </ul>
        ) : null}

        {puedeLogistica ? (
          <>
            <textarea
              value={adminDraft}
              onChange={(e) => setAdminDraft(e.target.value)}
              placeholder="Nota interna de aprobación — visible en Logística OK…"
              rows={2}
              maxLength={2000}
              className="w-full rounded-[10px] border border-emerald-400 bg-white px-3 py-2 text-sm"
            />
            <Button
              size="sm"
              variant="secondary"
              className="mt-2 border-emerald-600 font-semibold text-emerald-900 hover:bg-emerald-100"
              disabled={enviandoAdmin || !adminDraft.trim()}
              onClick={() => void agregarAdmin()}
            >
              {enviandoAdmin ? "Enviando…" : "+ Agregar nota administrativa"}
            </Button>
          </>
        ) : null}
      </div>
    </section>
  );
}
