"use client";

import { useCallback, useState } from "react";
import { calcIndiceGs, pctDesdeDecimal } from "@/lib/motor-precios/caso-utils";
import type { CasoBibliotecaRow } from "@/lib/motor-precios/biblioteca-editor";
import { lineasATexto } from "@/lib/motor-precios/lineas-texto";

type Props = {
  bibliotecaId: number;
  caso: CasoBibliotecaRow;
  defaultOpen?: boolean;
  onUpdated: () => void;
};

export function CasoPanel({ bibliotecaId, caso, defaultOpen = false, onUpdated }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [dolar, setDolar] = useState(caso.dolar_politica);
  const [factor, setFactor] = useState(caso.factor_conversion);
  const [d1, setD1] = useState(pctDesdeDecimal(caso.descuento_1));
  const [d2, setD2] = useState(pctDesdeDecimal(caso.descuento_2));
  const [d3, setD3] = useState(pctDesdeDecimal(caso.descuento_3));
  const [d4, setD4] = useState(pctDesdeDecimal(caso.descuento_4));
  const [generaLpc, setGeneraLpc] = useState(caso.genera_lpc03_lpc04);
  const [editLineas, setEditLineas] = useState(false);
  const [lineasTexto, setLineasTexto] = useState(lineasATexto(caso.lineas));
  const [savingParams, setSavingParams] = useState(false);
  const [savingLineas, setSavingLineas] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const indice = calcIndiceGs(dolar, factor);

  const guardarParams = useCallback(async () => {
    setSavingParams(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/motor-precios/biblioteca/${bibliotecaId}/casos/${caso.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre_caso: caso.nombre_caso,
          dolar_politica: dolar,
          factor_conversion: factor,
          d1,
          d2,
          d3,
          d4,
          genera_lpc03_lpc04: generaLpc,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      setMsg("Parámetros guardados");
      onUpdated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSavingParams(false);
    }
  }, [bibliotecaId, caso.id, caso.nombre_caso, dolar, factor, d1, d2, d3, d4, generaLpc, onUpdated]);

  const guardarLineas = useCallback(async () => {
    setSavingLineas(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(
        `/api/motor-precios/biblioteca/${bibliotecaId}/casos/${caso.id}/lineas`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lineas_texto: lineasTexto }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar líneas");
      setMsg(`${data.lineas_guardadas ?? 0} línea(s) guardadas`);
      setEditLineas(false);
      if (data.lineas) setLineasTexto(lineasATexto(data.lineas));
      onUpdated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSavingLineas(false);
    }
  }, [bibliotecaId, caso.id, lineasTexto, onUpdated]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
      >
        <span className="font-semibold text-rimec-azul-dark">
          📂 {caso.nombre_caso} — {caso.lineas_count} línea(s) · índice {indice.toLocaleString("es-PY")} Gs
        </span>
        <span className="text-slate-400">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Dólar de política (Gs)</span>
              <input
                type="number"
                min={1}
                step={100}
                value={dolar}
                onChange={(e) => setDolar(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Factor</span>
              <input
                type="number"
                min={1}
                step={1}
                value={factor}
                onChange={(e) => setFactor(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-500">índice = {indice.toLocaleString("es-PY")} Gs / USD FOB</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {(
              [
                ["D1 % s/ USD", d1, setD1],
                ["D2 % s/ USD", d2, setD2],
                ["D3 % s/ USD", d3, setD3],
                ["D4 % s/ USD", d4, setD4],
              ] as const
            ).map(([label, val, set]) => (
              <label key={label} className="block text-sm">
                <span className="font-medium text-slate-700">{label}</span>
                <input
                  type="number"
                  min={0}
                  max={99}
                  step={1}
                  value={val}
                  onChange={(e) => set(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
            ))}
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={generaLpc}
              onChange={(e) => setGeneraLpc(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Genera LPC03 y LPC04
          </label>

          <button
            type="button"
            onClick={guardarParams}
            disabled={savingParams}
            className="mt-4 rounded-lg bg-rimec-azul px-4 py-2 text-sm font-semibold text-white hover:bg-rimec-azul-light disabled:opacity-60"
          >
            {savingParams ? "Guardando…" : "Guardar parámetros"}
          </button>

          <hr className="my-6 border-slate-100" />

          <p className="text-sm font-semibold text-slate-800">
            Líneas del caso — {caso.lineas_count.toLocaleString("es-PY")} asignada(s)
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Editá la lista como texto (comas o una por línea, rangos 520-530). Si pegás una línea nueva, debe existir
            en el pilar del proveedor.
          </p>

          {editLineas ? (
            <textarea
              value={lineasTexto}
              onChange={(e) => setLineasTexto(e.target.value)}
              rows={Math.min(18, Math.max(6, Math.ceil(caso.lineas_count / 8)))}
              className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
            />
          ) : (
            <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
              {lineasTexto || "— sin líneas —"}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {!editLineas ? (
              <button
                type="button"
                onClick={() => {
                  setLineasTexto(lineasATexto(caso.lineas));
                  setEditLineas(true);
                }}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                ✏️ Editar lista
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={guardarLineas}
                  disabled={savingLineas}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {savingLineas ? "Guardando…" : "💾 Guardar lista"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLineasTexto(lineasATexto(caso.lineas));
                    setEditLineas(false);
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Cancelar
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onUpdated}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              🔄 Actualizar vista
            </button>
          </div>

          {msg && <p className="mt-3 text-sm text-emerald-700">{msg}</p>}
          {err && <p className="mt-3 text-sm text-red-700">{err}</p>}
        </div>
      )}
    </div>
  );
}

export function NuevoCasoForm({
  bibliotecaId,
  onCreated,
}: {
  bibliotecaId: number;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [dolar, setDolar] = useState(8000);
  const [factor, setFactor] = useState(180);
  const [generaLpc, setGeneraLpc] = useState(true);
  const [lineasTexto, setLineasTexto] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const crear = async () => {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/motor-precios/biblioteca/${bibliotecaId}/casos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre_caso: nombre,
          dolar_politica: dolar,
          factor_conversion: factor,
          d1: 0,
          d2: 0,
          d3: 0,
          d4: 0,
          genera_lpc03_lpc04: generaLpc,
          lineas_texto: lineasTexto,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setNombre("");
      setLineasTexto("");
      setOpen(false);
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 text-left text-sm font-semibold text-rimec-azul"
      >
        ➕ Agregar caso comercial {open ? "▾" : "▸"}
      </button>
      {open && (
        <div className="border-t border-slate-200 px-4 py-4">
          <input
            placeholder="Nombre del caso (ej. ACT-BRSPORT)"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Dólar (Gs)
              <input
                type="number"
                value={dolar}
                onChange={(e) => setDolar(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>
            <label className="text-sm">
              Factor
              <input
                type="number"
                value={factor}
                onChange={(e) => setFactor(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={generaLpc} onChange={(e) => setGeneraLpc(e.target.checked)} />
            Genera LPC03 y LPC04
          </label>
          <textarea
            placeholder="Líneas iniciales (opcional): 1122, 1123 o 520-600"
            value={lineasTexto}
            onChange={(e) => setLineasTexto(e.target.value)}
            rows={4}
            className="mt-3 w-full rounded-lg border px-3 py-2 font-mono text-xs"
          />
          <button
            type="button"
            onClick={crear}
            disabled={saving || !nombre.trim()}
            className="mt-3 rounded-lg bg-rimec-azul px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Creando…" : "Crear caso en esta biblioteca"}
          </button>
          {err && <p className="mt-2 text-sm text-red-700">{err}</p>}
        </div>
      )}
    </div>
  );
}
