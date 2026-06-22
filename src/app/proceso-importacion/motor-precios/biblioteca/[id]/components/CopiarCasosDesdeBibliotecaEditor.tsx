"use client";

import { useCallback, useEffect, useState } from "react";
import type { BibliotecaEditorPayload } from "@/lib/motor-precios/biblioteca-editor";
import type { BibliotecaRow } from "@/lib/motor-precios/queries";

type Props = {
  bibliotecaId: number;
  proveedorId: number;
  vacia: boolean;
  onCopiado: () => void;
};

export function CopiarCasosDesdeBibliotecaEditor({
  bibliotecaId,
  proveedorId,
  vacia,
  onCopiado,
}: Props) {
  const [bibliotecas, setBibliotecas] = useState<BibliotecaRow[]>([]);
  const [origenId, setOrigenId] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [copiando, setCopiando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [confirmarReemplazo, setConfirmarReemplazo] = useState(false);

  const loadBibliotecas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/motor-precios/biblioteca?proveedor_id=${proveedorId}`, {
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al listar bibliotecas");
      const list: BibliotecaRow[] = (data.bibliotecas ?? []).filter(
        (b: BibliotecaRow) => b.id !== bibliotecaId && b.casos_count > 0,
      );
      setBibliotecas(list);
      const canon = list.find((b) => b.canonica);
      if (canon) setOrigenId(canon.id);
      else if (list[0]) setOrigenId(list[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }, [bibliotecaId, proveedorId]);

  useEffect(() => {
    loadBibliotecas();
  }, [loadBibliotecas]);

  useEffect(() => {
    setConfirmarReemplazo(false);
    setError(null);
  }, [origenId]);

  const origen = bibliotecas.find((b) => b.id === origenId);

  async function ejecutarCopia(reemplazar: boolean) {
    if (!origenId) return;
    setCopiando(true);
    setError(null);
    setExito(null);
    try {
      const res = await fetch(`/api/motor-precios/biblioteca/${bibliotecaId}/copiar-casos`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origen_biblioteca_id: origenId, reemplazar }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (res.status === 422 && !reemplazar) {
          setConfirmarReemplazo(true);
          throw new Error(data.error);
        }
        throw new Error(data.error || "No se pudieron copiar los casos");
      }
      setConfirmarReemplazo(false);
      setExito(
        `${data.n_casos} caso(s) clonados (${data.n_lineas} líneas BCL) desde biblioteca #${data.origen_biblioteca_id}. ` +
          `El origen conserva sus casos.`,
      );
      onCopiado();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al copiar");
    } finally {
      setCopiando(false);
    }
  }

  function handleClick() {
    if (!vacia && !confirmarReemplazo) {
      setConfirmarReemplazo(true);
      return;
    }
    void ejecutarCopia(!vacia);
  }

  if (loading) {
    return (
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
        Cargando bibliotecas origen…
      </div>
    );
  }

  if (bibliotecas.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        No hay otra biblioteca con casos para copiar. Creá casos manualmente o usá una biblioteca canónica con matriz
        cargada.
      </div>
    );
  }

  return (
    <div
      className={`mt-6 rounded-xl border-2 bg-white p-5 shadow-sm ${
        vacia ? "border-rimec-azul/40 ring-2 ring-rimec-azul/10" : "border-slate-200"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-rimec-azul/70">2.3.1.7.1.1</p>
      <h2 className="mt-1 font-serif text-lg text-rimec-azul-dark">Copiar casos de biblioteca anterior</h2>
      {vacia ? (
        <p className="mt-1 text-sm font-medium text-amber-900">
          Biblioteca vacía — copiá la matriz desde otra biblioteca del proveedor {proveedorId}.
        </p>
      ) : (
        <p className="mt-1 text-sm text-slate-600">
          Importá casos + líneas BCL desde otra biblioteca a esta (#{bibliotecaId}).
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm">
          <span className="mb-1 block font-semibold text-slate-700">Biblioteca origen</span>
          <select
            value={origenId}
            onChange={(e) => setOrigenId(Number(e.target.value) || "")}
            disabled={copiando}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          >
            <option value="">— Elegir —</option>
            {bibliotecas.map((b) => (
              <option key={b.id} value={b.id}>
                #{b.id} · {b.nombre} · {b.casos_count} casos · {b.lineas_count} líneas BCL
                {b.canonica ? " · CANÓNICA" : ""}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={handleClick}
          disabled={!origenId || copiando}
          className="rounded-xl border-2 border-rimec-azul bg-rimec-azul px-5 py-2.5 text-sm font-bold text-white shadow disabled:cursor-not-allowed disabled:opacity-50"
        >
          {copiando
            ? "Copiando…"
            : confirmarReemplazo && !vacia
              ? "Confirmar reemplazo"
              : "Copiar casos de biblioteca anterior"}
        </button>
      </div>

      {origen && (
        <p className="mt-3 text-xs text-slate-600">
          Origen: <strong>{origen.nombre}</strong> · {origen.casos_count} casos · {origen.lineas_count} líneas → destino
          #{bibliotecaId}. <strong>Clon</strong> — ambas bibliotecas quedan con los mismos casos.
        </p>
      )}

      {confirmarReemplazo && !vacia && (
        <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Se reemplazarán los casos actuales de esta biblioteca.{" "}
          <button type="button" className="font-semibold text-rimec-azul underline" onClick={() => setConfirmarReemplazo(false)}>
            Cancelar
          </button>
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
