"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CasoBibliotecaRow } from "@/lib/motor-precios/biblioteca-editor";

type LineaLibre = { codigo: string; marca: string | null };

type Props = {
  bibliotecaId: number;
  casos: CasoBibliotecaRow[];
  nLibres: number;
  open: boolean;
  onClose: () => void;
  onApplied: () => void;
};

export function LineasLibresPanel({ bibliotecaId, casos, nLibres, open, onClose, onApplied }: Props) {
  const [loading, setLoading] = useState(false);
  const [lineas, setLineas] = useState<LineaLibre[]>([]);
  const [asignaciones, setAsignaciones] = useState<Record<string, number>>({});
  const [filtro, setFiltro] = useState("");
  const [casoMasivo, setCasoMasivo] = useState("");
  const [applying, setApplying] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/motor-precios/biblioteca/${bibliotecaId}/lineas-libres`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar");
      setLineas(data.lineas ?? []);
      setAsignaciones({});
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [bibliotecaId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const filtradas = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (!q) return lineas;
    return lineas.filter(
      (l) => l.codigo.includes(q) || (l.marca?.toLowerCase().includes(q) ?? false),
    );
  }, [lineas, filtro]);

  const pendientes = useMemo(
    () => Object.entries(asignaciones).filter(([, casoId]) => casoId > 0).length,
    [asignaciones],
  );

  const aplicarMasivo = () => {
    const cid = Number(casoMasivo);
    if (!cid) return;
    const next: Record<string, number> = { ...asignaciones };
    for (const l of filtradas) next[l.codigo] = cid;
    setAsignaciones(next);
    setMsg(`${filtradas.length} línea(s) marcadas para ${casos.find((c) => c.id === cid)?.nombre_caso ?? "caso"}`);
  };

  const aplicar = async () => {
    setApplying(true);
    setErr(null);
    setMsg(null);
    const payload = Object.entries(asignaciones)
      .filter(([, casoId]) => casoId > 0)
      .map(([codigo, caso_id]) => ({ codigo, caso_id }));

    if (!payload.length) {
      setErr("Elegí al menos un caso por línea.");
      setApplying(false);
      return;
    }

    try {
      const res = await fetch(`/api/motor-precios/biblioteca/${bibliotecaId}/lineas-libres`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asignaciones: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al aplicar");

      const aviso =
        data.errores?.length > 0 ? ` · ${data.errores.slice(0, 2).join("; ")}` : "";
      setMsg(`${data.asignadas} línea(s) asignadas${aviso}`);
      onApplied();
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setApplying(false);
    }
  };

  if (!open) return null;

  return (
    <div className="mt-6 rounded-xl border-2 border-amber-300 bg-amber-50/50 shadow-sm">
      <div className="flex items-start justify-between border-b border-amber-200 px-4 py-3">
        <div>
          <h2 className="font-serif text-lg font-semibold text-rimec-azul-dark">
            Líneas libres — {nLibres.toLocaleString("es-PY")} sin caso
          </h2>
          <p className="mt-0.5 text-xs text-slate-600">
            Elegí el caso comercial para cada línea y pulsá <strong>Aplicar</strong>.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cerrar
        </button>
      </div>

      {casos.length === 0 ? (
        <p className="px-4 py-6 text-sm text-amber-900">Creá al menos un caso comercial antes de asignar líneas.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3 border-b border-amber-100 px-4 py-3">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Buscar línea o marca</span>
              <input
                type="search"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Ej. 2251 o BRSPORT"
                className="mt-1 w-48 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Asignar visibles a</span>
              <select
                value={casoMasivo}
                onChange={(e) => setCasoMasivo(e.target.value)}
                className="mt-1 block min-w-[180px] rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              >
                <option value="">— elegir caso —</option>
                {casos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre_caso}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={aplicarMasivo}
              disabled={!casoMasivo || filtradas.length === 0}
              className="rounded-lg border border-rimec-azul/30 bg-white px-3 py-2 text-sm font-semibold text-rimec-azul hover:bg-blue-50 disabled:opacity-50"
            >
              Marcar visibles
            </button>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">Cargando líneas…</p>
            ) : filtradas.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">No hay líneas libres con ese filtro.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-amber-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Línea</th>
                    <th className="px-4 py-2">Marca</th>
                    <th className="px-4 py-2">Asignar a caso</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((l) => (
                    <tr key={l.codigo} className="border-t border-amber-100/80 bg-white/60">
                      <td className="px-4 py-2 font-mono font-semibold text-rimec-azul-dark">{l.codigo}</td>
                      <td className="px-4 py-2 text-slate-600">{l.marca ?? "—"}</td>
                      <td className="px-4 py-2">
                        <select
                          value={asignaciones[l.codigo] ?? ""}
                          onChange={(e) =>
                            setAsignaciones((prev) => ({
                              ...prev,
                              [l.codigo]: Number(e.target.value) || 0,
                            }))
                          }
                          className="w-full max-w-xs rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                        >
                          <option value="">— sin asignar —</option>
                          {casos.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nombre_caso}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-amber-200 px-4 py-3">
            <button
              type="button"
              onClick={aplicar}
              disabled={applying || pendientes === 0}
              className="rounded-lg bg-rimec-azul px-5 py-2 text-sm font-bold text-white hover:bg-rimec-azul-light disabled:opacity-50"
            >
              {applying ? "Aplicando…" : `Aplicar (${pendientes})`}
            </button>
            <span className="text-xs text-slate-600">
              {filtradas.length} visible(s) · {lineas.length} libre(s) en total
            </span>
            {msg && <span className="text-sm text-emerald-700">{msg}</span>}
            {err && <span className="text-sm text-red-700">{err}</span>}
          </div>
        </>
      )}
    </div>
  );
}
