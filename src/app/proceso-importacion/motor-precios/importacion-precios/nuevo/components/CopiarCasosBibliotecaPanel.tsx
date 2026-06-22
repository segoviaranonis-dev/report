"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PrecioEventoDetalle } from "@/lib/motor-precios/evento-queries";
import type { BibliotecaRow } from "@/lib/motor-precios/queries";
import { MOTOR_BIBLIOTECA, motorBibliotecaEditor } from "@/lib/report/routes";

type Props = {
  evento: PrecioEventoDetalle;
  bibliotecas: BibliotecaRow[];
  bibSeleccionada: number | "";
  onBibChange: (id: number | "") => void;
  onCopiado: (evento: PrecioEventoDetalle, mensaje: string) => void;
};

export function CopiarCasosBibliotecaPanel({
  evento,
  bibliotecas,
  bibSeleccionada,
  onBibChange,
  onCopiado,
}: Props) {
  const [copiando, setCopiando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmarReemplazo, setConfirmarReemplazo] = useState(false);
  const [exito, setExito] = useState<string | null>(null);

  const eventoCerrado = evento.estado.toLowerCase() === "cerrado";
  const tieneSkus = evento.matriz.skus_count > 0;
  const tieneMatriz = evento.matriz.casos_count > 0;
  const bibOrigen = bibliotecas.find((b) => b.id === bibSeleccionada) ?? null;
  const bibSinCasos = bibOrigen != null && bibOrigen.casos_count === 0;

  useEffect(() => {
    setConfirmarReemplazo(false);
    setError(null);
  }, [bibSeleccionada]);

  async function ejecutarCopia() {
    if (!bibSeleccionada || eventoCerrado || bibSinCasos || tieneSkus) return;

    setCopiando(true);
    setError(null);
    setExito(null);
    try {
      const res = await fetch(`/api/motor-precios/eventos/${evento.id}/copiar-casos`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ biblioteca_id: bibSeleccionada, reemplazar_matriz: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "No se pudieron copiar los casos");
      }
      setConfirmarReemplazo(false);
      const nombre = bibliotecas.find((b) => b.id === data.biblioteca_id)?.nombre ?? `#${data.biblioteca_id}`;
      const msg = `${data.n_casos} caso(s) copiados desde «${nombre}» → precio_evento_caso · FK biblioteca_precio_id=${data.biblioteca_id}`;
      setExito(msg);
      onCopiado(data.evento, msg);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al copiar casos");
    } finally {
      setCopiando(false);
    }
  }

  function handleClickCopiar() {
    if (tieneMatriz && !confirmarReemplazo) {
      setConfirmarReemplazo(true);
      return;
    }
    void ejecutarCopia();
  }

  const botonDisabled =
    !bibSeleccionada || copiando || eventoCerrado || bibSinCasos || tieneSkus;

  return (
    <div className="rounded-xl border-2 border-rimec-azul/30 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-rimec-azul/70">2.3.1.7.2.1.1</p>
      <h2 className="mt-1 font-serif text-lg text-rimec-azul-dark">Copiar casos de biblioteca anterior</h2>
      <p className="mt-1 text-sm text-slate-600">
        Origen: <code className="text-xs">caso_precio_biblioteca</code> +{" "}
        <code className="text-xs">biblioteca_caso_linea</code> → Destino:{" "}
        <code className="text-xs">precio_evento_caso</code> +{" "}
        <code className="text-xs">precio_evento_linea_excepcion</code>
      </p>

      {tieneSkus && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          Hay {evento.matriz.skus_count} SKU(s) en <code className="text-xs">precio_lista</code>. No se puede
          reemplazar la matriz — listado ya calculado.
        </div>
      )}

      {eventoCerrado && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Evento cerrado — solo lectura.
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm">
          <span className="mb-1 block font-semibold text-slate-700">Biblioteca origen</span>
          <select
            value={bibSeleccionada}
            onChange={(e) => onBibChange(Number(e.target.value) || "")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            disabled={copiando || eventoCerrado || tieneSkus}
          >
            <option value="">— Elegir biblioteca anterior —</option>
            {bibliotecas.map((b) => (
              <option key={b.id} value={b.id} disabled={b.casos_count === 0}>
                #{b.id} · {b.nombre} · {b.casos_count} casos · {b.lineas_count} líneas BCL
                {b.canonica ? " · CANÓNICA" : ""}
                {b.casos_count === 0 ? " · SIN CASOS" : ""}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={handleClickCopiar}
          disabled={botonDisabled}
          className="rounded-xl border-2 border-rimec-azul bg-rimec-azul px-5 py-2.5 text-sm font-bold text-white shadow disabled:cursor-not-allowed disabled:opacity-50"
        >
          {copiando
            ? "Copiando…"
            : confirmarReemplazo
              ? "Confirmar reemplazo"
              : "Copiar casos de biblioteca anterior"}
        </button>
      </div>

      {bibOrigen && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
          <p className="font-semibold text-rimec-azul-dark">
            Vista previa · #{bibOrigen.id} {bibOrigen.nombre}
            {bibOrigen.canonica && (
              <span className="ml-2 rounded bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">CANÓNICA</span>
            )}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {bibOrigen.casos_count} casos · {bibOrigen.lineas_count} líneas en matriz BCL
          </p>
          {bibOrigen.casos_count > 0 && (
            <Link
              href={motorBibliotecaEditor(bibOrigen.id)}
              className="mt-2 inline-block text-xs font-semibold text-rimec-azul underline"
            >
              Ver casos en editor →
            </Link>
          )}
        </div>
      )}

      {bibSinCasos && (
        <p className="mt-3 text-sm text-amber-800">
          Esa biblioteca no tiene casos — elegí otra o creá casos en el histórico.
        </p>
      )}

      {confirmarReemplazo && !tieneSkus && (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          El evento ya tiene {evento.matriz.casos_count} caso(s). Se vaciará{" "}
          <code className="text-xs">precio_evento_caso</code> y se copiará la biblioteca elegida. Tocá de nuevo para
          confirmar o{" "}
          <button
            type="button"
            className="font-semibold text-rimec-azul underline"
            onClick={() => setConfirmarReemplazo(false)}
          >
            cancelar
          </button>
          .
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      )}
      {exito && (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {exito}
        </p>
      )}

      <Link href={MOTOR_BIBLIOTECA} className="mt-4 inline-block text-xs font-semibold text-rimec-azul underline">
        Histórico biblioteca de precios →
      </Link>
    </div>
  );
}
