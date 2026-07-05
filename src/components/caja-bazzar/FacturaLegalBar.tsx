"use client";

import { useCallback, useEffect, useState } from "react";

type Turno = {
  serial_activo: string;
  puede_anterior: boolean;
  historial_len: number;
};

/** Barra vital — serial factura legal pendiente · todas las cajas · fluye a bóveda ORO. */
export function FacturaLegalBar({ clienteId }: { clienteId: number }) {
  const [turno, setTurno] = useState<Turno | null>(null);
  const [editSerial, setEditSerial] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/tablet-bazzar/factura-legal?cliente_id=${clienteId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) {
          setError(data.error ?? "Sin turno factura legal");
          setTurno(null);
          return;
        }
        setTurno(data.turno);
        setEditSerial(data.turno.serial_activo ?? "");
      })
      .catch(() => setError("Error de red"))
      .finally(() => setLoading(false));
  }, [clienteId]);

  useEffect(() => {
    load();
  }, [load]);

  async function accion(action: "siguiente" | "anterior" | "set") {
    setBusy(action);
    setError(null);
    try {
      const r = await fetch("/api/tablet-bazzar/factura-legal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: clienteId,
          action,
          ...(action === "set" ? { serial: editSerial } : {}),
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setError(data.error ?? "No se pudo actualizar serial");
        return;
      }
      setTurno(data.turno);
      setEditSerial(data.turno.serial_activo ?? "");
    } catch {
      setError("Error de red");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mb-6 rounded-2xl border-[3px] border-rimec-azul bg-gradient-to-r from-rimec-azul/10 via-white to-rimec-azul/5 p-4 shadow-md">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rimec-azul">
            Factura legal · pendiente bóveda
          </p>
          <p className="text-xs text-neutral-muted">Serial alfanumérico · vital para ORO · formato legal TBD</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
        >
          {loading ? "…" : "Actualizar"}
        </button>
      </div>

      {error && <p className="mb-2 text-sm text-red-700">{error}</p>}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <label className="block min-w-0 flex-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rimec-azul-dark">Activa</span>
          <input
            type="text"
            value={editSerial}
            onChange={(e) => setEditSerial(e.target.value.toUpperCase())}
            spellCheck={false}
            autoComplete="off"
            className="mt-1 w-full rounded-xl border-2 border-rimec-azul bg-white px-4 py-3 font-mono text-2xl font-black uppercase tracking-wide text-rimec-azul-dark shadow-inner"
            placeholder="SERIAL-LEGAL"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy != null || !turno?.puede_anterior}
            onClick={() => void accion("anterior")}
            className="rounded-xl border-2 border-slate-400 bg-white px-4 py-3 text-sm font-bold text-slate-800 disabled:opacity-40"
          >
            {busy === "anterior" ? "…" : "◀ Anterior"}
          </button>
          <button
            type="button"
            disabled={busy != null}
            onClick={() => void accion("siguiente")}
            className="rounded-xl border-2 border-bazzar-naranja bg-bazzar-naranja px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy === "siguiente" ? "…" : "Siguiente ▶"}
          </button>
          <button
            type="button"
            disabled={busy != null || !editSerial.trim()}
            onClick={() => void accion("set")}
            className="rounded-xl border-2 border-rimec-azul bg-rimec-azul/10 px-4 py-3 text-sm font-bold text-rimec-azul disabled:opacity-50"
          >
            {busy === "set" ? "…" : "Fijar Activa"}
          </button>
        </div>
      </div>

      {turno && (
        <p className="mt-2 text-[10px] text-neutral-muted">
          Historial turno: {turno.historial_len} serial(es) · al Enviar a Empaque se sella en bóveda y avanza Siguiente
        </p>
      )}
    </section>
  );
}
