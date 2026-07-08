"use client";

import { ProcesoImportacionWaitOverlay } from "@/components/report/ProcesoImportacionWaitOverlay";
import { useState } from "react";
import type { PrecioEventoDetalle } from "@/lib/motor-precios/evento-queries";
import type { BibliotecaRow } from "@/lib/motor-precios/queries";

type Props = {
  evento: PrecioEventoDetalle;
  bibliotecas: BibliotecaRow[];
  bibSeleccionada: number | "";
  onBibChange: (id: number | "") => void;
  onAsignada: (evento: PrecioEventoDetalle) => void;
};

export function AsignarBibliotecaPanel({
  evento,
  bibliotecas,
  bibSeleccionada,
  onBibChange,
  onAsignada,
}: Props) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const eventoCerrado = evento.estado.toLowerCase() === "cerrado";
  const bibOrigen = bibliotecas.find((b) => b.id === bibSeleccionada) ?? null;
  const yaAsignada = bibSeleccionada !== "" && evento.biblioteca_precio_id === bibSeleccionada;

  async function asignar() {
    if (!bibSeleccionada || eventoCerrado) return;
    setGuardando(true);
    setError(null);
    setExito(null);
    try {
      const res = await fetch(`/api/motor-precios/eventos/${evento.id}/vincular-biblioteca`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ biblioteca_id: bibSeleccionada }),
      });
      const raw = await res.text();
      let data: { ok?: boolean; error?: string; biblioteca_nombre?: string; casos_copiados?: number; evento?: PrecioEventoDetalle };
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(
          res.ok
            ? "Respuesta inválida del servidor"
            : `Error ${res.status}: ${raw.slice(0, 120) || "sin detalle"} — reiniciá dev (borrar .next) si persiste`,
        );
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "No se pudo asignar la biblioteca");
      }
      setExito(
        `Biblioteca «${data.biblioteca_nombre}» · ${data.casos_copiados ?? 0} casos sincronizados al evento`,
      );
      if (data.evento) onAsignada(data.evento);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al asignar");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <ProcesoImportacionWaitOverlay
        open={guardando}
        title="Sincronizando biblioteca…"
        detail={`Evento #${evento.id}`}
        hint="Copiando casos y líneas BCL al evento"
      />
      <h2 className="font-serif text-lg text-rimec-azul-dark">Asignar biblioteca al evento</h2>
      <p className="mt-1 text-xs text-slate-600">
        Al asignar, los casos de la biblioteca se sincronizan al evento automáticamente (sin paso Casos).
      </p>

      {bibliotecas.length === 0 ? (
        <p className="mt-4 text-sm text-amber-800">No hay bibliotecas para este proveedor.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm">
            <span className="mb-1 block font-semibold text-slate-700">Biblioteca</span>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={bibSeleccionada === "" ? "" : String(bibSeleccionada)}
              disabled={eventoCerrado || guardando}
              onChange={(e) => onBibChange(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">— Elegir biblioteca —</option>
              {bibliotecas.map((b) => (
                <option key={b.id} value={b.id}>
                  #{b.id} · {b.nombre} · {b.casos_count} casos · {b.lineas_count} BCL
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!bibSeleccionada || guardando || eventoCerrado || yaAsignada}
            onClick={() => void asignar()}
            className="rounded-lg bg-rimec-azul px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40"
          >
            {guardando ? "Asignando…" : yaAsignada ? "Ya asignada" : "Asignar biblioteca"}
          </button>
        </div>
      )}

      {bibOrigen && (
        <p className="mt-3 text-xs text-slate-500">
          Referencia: {bibOrigen.casos_count} casos en maestro · editar/clonar casos solo en biblioteca.
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      )}
      {exito && (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {exito}
        </p>
      )}
    </div>
  );
}
