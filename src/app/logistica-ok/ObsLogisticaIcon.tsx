"use client";

import { useCallback, useEffect, useState } from "react";
import type { LogisticaTabId } from "@/lib/logistica-ok/constants";

export type ObsLogisticaItem = {
  id: number;
  usuario_nombre: string;
  texto: string;
  created_at: string;
  origen: string;
};

type Props = {
  fiId: number;
  tab: LogisticaTabId;
  count: number;
  noLeida?: boolean;
  size?: "sm" | "md";
  /** Tras marcar leído en esta pestaña (queda abierto/leído aquí; otra pestaña se cierra) */
  onLeida?: (fiId: number) => void;
};

export function ObsLogisticaIcon({ fiId, tab, count, noLeida, size = "sm", onLeida }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ObsLogisticaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [localNoLeida, setLocalNoLeida] = useState(Boolean(noLeida));

  useEffect(() => {
    setLocalNoLeida(Boolean(noLeida));
  }, [noLeida, fiId, tab]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/logistica-ok/observaciones?fi_id=${fiId}`, {
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar");
      setItems(data.items ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [fiId]);

  const marcarLeida = useCallback(async () => {
    try {
      await fetch("/api/logistica-ok/observaciones/leer", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fi_id: fiId, pestana: tab }),
      });
      setLocalNoLeida(false);
      onLeida?.(fiId);
    } catch {
      /* no bloquear UI */
    }
  }, [fiId, tab, onLeida]);

  useEffect(() => {
    if (!open) return;
    void load();
    void marcarLeida();
  }, [open, load, marcarLeida]);

  if (!count || count <= 0) return null;

  const sz = size === "sm" ? "h-7 w-7 text-base" : "h-8 w-8 text-lg";

  return (
    <>
      <button
        type="button"
        title={
          localNoLeida
            ? "Obs. Logística · sin leer"
            : "Obs. Logística · leída en esta pestaña"
        }
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={`inline-flex shrink-0 items-center justify-center rounded-full border-2 border-white shadow transition hover:scale-105 ${sz} ${
          localNoLeida ? "bg-emerald-600 ring-2 ring-amber-400" : "bg-emerald-500"
        }`}
        aria-label="Ver observaciones logística"
      >
        ✉️
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="max-h-[80vh] w-full max-w-md overflow-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby={`obs-logistica-${fiId}`}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <h3 id={`obs-logistica-${fiId}`} className="text-sm font-bold text-rimec-azul-dark">
                Obs. Logística
              </h3>
              <button
                type="button"
                className="rounded px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-100"
                onClick={() => setOpen(false)}
              >
                Cerrar
              </button>
            </div>
            {loading && <p className="text-xs text-slate-500">Cargando…</p>}
            {err && <p className="text-xs text-red-600">{err}</p>}
            {!loading && !err && items.length === 0 && (
              <p className="text-xs text-slate-500">Sin mensajes.</p>
            )}
            <ul className="space-y-2">
              {items.map((it) => (
                <li key={it.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
                  <p className="font-bold text-emerald-800">{it.usuario_nombre}:</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-slate-800">{it.texto}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

export function ObsLogisticaGrupoIcon({
  filas,
  tab,
  onLeida,
}: {
  filas: Array<{ factura_interna_id: number; obs_count: number; obs_no_leida?: boolean }>;
  tab: LogisticaTabId;
  onLeida?: (fiId: number) => void;
}) {
  const conObs = filas.filter((f) => f.obs_count > 0);
  if (!conObs.length) return null;
  const primera = conObs.find((f) => f.obs_no_leida) ?? conObs[0];
  const noLeida = conObs.some((f) => f.obs_no_leida);
  return (
    <ObsLogisticaIcon
      fiId={primera.factura_interna_id}
      tab={tab}
      count={conObs.reduce((s, f) => s + f.obs_count, 0)}
      noLeida={noLeida}
      size="md"
      onLeida={onLeida}
    />
  );
}
