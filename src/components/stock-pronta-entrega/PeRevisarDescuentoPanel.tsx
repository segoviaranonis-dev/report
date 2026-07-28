"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DepositoProductThumb } from "@/app/depositos-bazzar/components/DepositoProductThumb";
import {
  PCT_POLITICA_OPCIONES,
  type MoleculaVerificacionPe,
} from "@/lib/stock-pronta-entrega/resumen-asignacion-pe";
import { PE_TIPO_DICCIONARIO_OPCIONES } from "@/lib/stock-pronta-entrega/filtro-tipo-pe-diccionario";

type Props = {
  open: boolean;
  onClose: () => void;
  batchLabel: string;
  titulo: string;
  moleculas: MoleculaVerificacionPe[];
  /** Filtrar solo esta política al abrir. */
  politicaId?: string | null;
  onApplied: () => void;
};

function AcordeonFiltro({
  title,
  children,
  count,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <details open className="rounded-lg border border-slate-200 bg-white">
      <summary className="cursor-pointer list-none px-2.5 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-600 [&::-webkit-details-marker]:hidden">
        ▸ {title}
        {count > 0 ? (
          <span className="ml-1 rounded-full bg-rimec-azul px-1.5 py-0.5 text-[9px] text-white">
            {count}
          </span>
        ) : null}
      </summary>
      <div className="border-t border-slate-100 p-1.5">{children}</div>
    </details>
  );
}

function molKeyLabel(key: string): string {
  return key.replace(/-/g, " · ");
}

type FiltroRevisarState = {
  marca: Set<string>;
  abcr: Set<string>;
  tipo: Set<string>;
  estilo: Set<string>;
  buscar: string;
};

type ExcluirDimFiltro = "marca" | "abcr" | "tipo" | "estilo" | "buscar";

/** Cadena estricta: cada dimensión ve solo filas que cumplen el resto de filtros activos. */
function matchesFiltrosRevisar(
  m: MoleculaVerificacionPe,
  f: FiltroRevisarState,
  excluir?: ExcluirDimFiltro,
): boolean {
  if (excluir !== "marca" && f.marca.size > 0 && !f.marca.has(m.labels.marca)) return false;
  if (excluir !== "abcr" && f.abcr.size > 0 && !f.abcr.has(m.labels.abcr)) return false;
  if (excluir !== "tipo" && f.tipo.size > 0 && !f.tipo.has(m.labels.tipoCadena)) return false;
  if (excluir !== "estilo" && f.estilo.size > 0 && !f.estilo.has(m.labels.estilo)) return false;
  if (excluir !== "buscar") {
    const q = f.buscar.trim().toLowerCase();
    if (q) {
      const hay =
        m.key.toLowerCase().includes(q) ||
        m.labels.marca.toLowerCase().includes(q) ||
        m.labels.estilo.toLowerCase().includes(q) ||
        m.labels.abcr.toLowerCase().includes(q) ||
        m.labels.tipoCadena.toLowerCase().includes(q);
      if (!hay) return false;
    }
  }
  return true;
}

function contarPorLabel(
  rows: MoleculaVerificacionPe[],
  label: (m: MoleculaVerificacionPe) => string,
  omitir?: string,
): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of rows) {
    const v = label(x);
    if (omitir && v === omitir) continue;
    m.set(v, (m.get(v) ?? 0) + 1);
  }
  return m;
}

function podarSeleccion(actual: Set<string>, validos: Iterable<string>): Set<string> {
  const allow = new Set(validos);
  const next = new Set<string>();
  for (const v of actual) {
    if (allow.has(v)) next.add(v);
  }
  if (next.size === actual.size && [...next].every((v) => actual.has(v))) return actual;
  return next;
}

export function PeRevisarDescuentoPanel({
  open,
  onClose,
  batchLabel,
  titulo,
  moleculas,
  politicaId = null,
  onApplied,
}: Props) {
  const [filtroMarca, setFiltroMarca] = useState<Set<string>>(new Set());
  const [filtroAbcr, setFiltroAbcr] = useState<Set<string>>(new Set());
  const [filtroTipo, setFiltroTipo] = useState<Set<string>>(new Set());
  const [filtroEstilo, setFiltroEstilo] = useState<Set<string>>(new Set());
  const [buscar, setBuscar] = useState("");
  const [asignaciones, setAsignaciones] = useState<Record<string, number>>({});
  const [pctMasivo, setPctMasivo] = useState<string>("");
  const [applying, setApplying] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAsignaciones({});
    setFiltroMarca(new Set());
    setFiltroAbcr(new Set());
    setFiltroTipo(new Set());
    setFiltroEstilo(new Set());
    setBuscar("");
    setPctMasivo("");
    setMsg(null);
    setErr(null);
  }, [open, politicaId, moleculas.length]);

  const base = useMemo(
    () => (politicaId ? moleculas.filter((m) => m.politicaId === politicaId) : moleculas),
    [moleculas, politicaId],
  );

  const filtroState: FiltroRevisarState = useMemo(
    () => ({
      marca: filtroMarca,
      abcr: filtroAbcr,
      tipo: filtroTipo,
      estilo: filtroEstilo,
      buscar,
    }),
    [filtroMarca, filtroAbcr, filtroTipo, filtroEstilo, buscar],
  );

  const marcas = useMemo(() => {
    const pool = base.filter((m) => matchesFiltrosRevisar(m, filtroState, "marca"));
    const m = contarPorLabel(pool, (x) => x.labels.marca);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"));
  }, [base, filtroState]);

  const abcrOpts = useMemo(() => {
    const pool = base.filter((m) => matchesFiltrosRevisar(m, filtroState, "abcr"));
    const m = contarPorLabel(pool, (x) => x.labels.abcr);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "es"));
  }, [base, filtroState]);

  const tipoOpts = useMemo(() => {
    const pool = base.filter((m) => matchesFiltrosRevisar(m, filtroState, "tipo"));
    const m = contarPorLabel(pool, (x) => x.labels.tipoCadena);
    return PE_TIPO_DICCIONARIO_OPCIONES.map((o) => {
      const cad = o.cadena === "REGULAR" ? "NORMAL" : o.cadena;
      return { cadena: cad, label: o.label, n: m.get(cad) ?? 0 };
    }).filter((t) => t.n > 0);
  }, [base, filtroState]);

  const estiloOpts = useMemo(() => {
    const pool = base.filter((m) => matchesFiltrosRevisar(m, filtroState, "estilo"));
    const m = contarPorLabel(pool, (x) => x.labels.estilo, "—");
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"));
  }, [base, filtroState]);

  /** Quitar checks huérfanos cuando la cadena de filtros los deja fuera. */
  useEffect(() => {
    const pm = podarSeleccion(filtroMarca, marcas.map(([v]) => v));
    const pa = podarSeleccion(filtroAbcr, abcrOpts.map(([v]) => v));
    const pt = podarSeleccion(filtroTipo, tipoOpts.map((t) => t.cadena));
    const pe = podarSeleccion(filtroEstilo, estiloOpts.map(([v]) => v));
    if (pm !== filtroMarca) setFiltroMarca(pm);
    if (pa !== filtroAbcr) setFiltroAbcr(pa);
    if (pt !== filtroTipo) setFiltroTipo(pt);
    if (pe !== filtroEstilo) setFiltroEstilo(pe);
  }, [marcas, abcrOpts, tipoOpts, estiloOpts, filtroMarca, filtroAbcr, filtroTipo, filtroEstilo]);

  const filtradas = useMemo(
    () => base.filter((m) => matchesFiltrosRevisar(m, filtroState)),
    [base, filtroState],
  );

  const limpiarFiltros = () => {
    setFiltroMarca(new Set());
    setFiltroAbcr(new Set());
    setFiltroTipo(new Set());
    setFiltroEstilo(new Set());
    setBuscar("");
  };

  const filtrosActivos =
    filtroMarca.size + filtroAbcr.size + filtroTipo.size + filtroEstilo.size + (buscar.trim() ? 1 : 0);

  const toggleSet = (set: Set<string>, val: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    setter(next);
  };

  const marcarEsperadoVisible = () => {
    const next: Record<string, number> = { ...asignaciones };
    for (const m of filtradas) next[m.key] = m.pctEsperado;
    setAsignaciones(next);
    setMsg(`${filtradas.length} producto(s) marcados al % esperado de su política`);
  };

  const marcarMasivo = () => {
    const pct = Number(pctMasivo);
    if (!Number.isFinite(pct)) return;
    const next: Record<string, number> = { ...asignaciones };
    for (const m of filtradas) next[m.key] = pct;
    setAsignaciones(next);
    setMsg(`${filtradas.length} producto(s) marcados al ${pct}%`);
  };

  const pendientesApply = useMemo(
    () => Object.entries(asignaciones).filter(([, pct]) => Number.isFinite(pct)).length,
    [asignaciones],
  );

  const aplicar = useCallback(async () => {
    setApplying(true);
    setErr(null);
    setMsg(null);
    const byPct = new Map<number, string[]>();
    for (const [key, pct] of Object.entries(asignaciones)) {
      if (!Number.isFinite(pct)) continue;
      const list = byPct.get(pct) ?? [];
      list.push(key);
      byPct.set(pct, list);
    }
    if (byPct.size === 0) {
      setErr("Elegí el descuento «¿A dónde agregar?» en al menos un producto.");
      setApplying(false);
      return;
    }
    try {
      let total = 0;
      for (const [pct, keys] of byPct) {
        const res = await fetch("/api/stock-pronta-entrega/asignacion-descuento", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batch: batchLabel, pct, molecule_keys: keys }),
        });
        const j = (await res.json()) as { ok?: boolean; error?: string; upserted?: number };
        if (!res.ok || !j.ok) throw new Error(j.error ?? "Error al guardar");
        total += j.upserted ?? keys.length;
      }
      setMsg(`${total.toLocaleString("es-PY")} producto(s) asignados en BD`);
      setAsignaciones({});
      onApplied();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setApplying(false);
    }
  }, [asignaciones, batchLabel, onApplied]);

  if (!open) return null;

  return (
    <div className="mt-4 rounded-xl border-2 border-amber-300 bg-amber-50/40 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-amber-200 px-4 py-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">{titulo}</h2>
          <p className="mt-0.5 text-xs text-slate-600">
            Filtros en cadena: Marca · AB-CR · Tipo PE · Estilo se recortan entre sí. Marcá % y{" "}
            <strong>Aplicar</strong>.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cerrar
        </button>
      </div>

      <div className="flex flex-col gap-4 p-4 lg:flex-row">
        <aside className="w-full shrink-0 space-y-2 lg:w-52">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase text-slate-500">Filtros</p>
            {filtrosActivos > 0 ? (
              <button
                type="button"
                onClick={limpiarFiltros}
                className="text-[10px] font-semibold text-rimec-azul hover:underline"
              >
                Limpiar
              </button>
            ) : null}
          </div>
          <AcordeonFiltro title="Marca" count={filtroMarca.size}>
            <ul className="max-h-32 space-y-0.5 overflow-y-auto text-[11px]">
              {marcas.map(([marca, n]) => (
                <li key={marca}>
                  <label className="flex cursor-pointer items-center gap-1.5 px-1 py-0.5 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={filtroMarca.has(marca)}
                      onChange={() => toggleSet(filtroMarca, marca, setFiltroMarca)}
                    />
                    <span className="truncate">{marca}</span>
                    <span className="ml-auto tabular-nums text-slate-400">{n}</span>
                  </label>
                </li>
              ))}
            </ul>
          </AcordeonFiltro>
          <AcordeonFiltro title="AB - CR" count={filtroAbcr.size}>
            <ul className="max-h-32 space-y-0.5 overflow-y-auto text-[11px]">
              {abcrOpts.map(([abcr, n]) => (
                <li key={abcr}>
                  <label className="flex cursor-pointer items-center gap-1.5 px-1 py-0.5 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={filtroAbcr.has(abcr)}
                      onChange={() => toggleSet(filtroAbcr, abcr, setFiltroAbcr)}
                    />
                    <span>{abcr}</span>
                    <span className="ml-auto tabular-nums text-slate-400">{n}</span>
                  </label>
                </li>
              ))}
            </ul>
          </AcordeonFiltro>
          <AcordeonFiltro title="Tipo PE" count={filtroTipo.size}>
            <ul className="space-y-0.5 text-[11px]">
              {tipoOpts.map((t) => (
                <li key={t.cadena}>
                  <label className="flex cursor-pointer items-center gap-1.5 px-1 py-0.5 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={filtroTipo.has(t.cadena)}
                      onChange={() => toggleSet(filtroTipo, t.cadena, setFiltroTipo)}
                    />
                    <span>{t.label}</span>
                    <span className="ml-auto tabular-nums text-slate-400">{t.n}</span>
                  </label>
                </li>
              ))}
            </ul>
          </AcordeonFiltro>
          <AcordeonFiltro title="Estilo" count={filtroEstilo.size}>
            <ul className="max-h-40 space-y-0.5 overflow-y-auto text-[11px]">
              {estiloOpts.length === 0 ? (
                <li className="px-1 py-1 text-slate-400">Sin estilos en este lote</li>
              ) : (
                estiloOpts.map(([estilo, n]) => (
                  <li key={estilo}>
                    <label className="flex cursor-pointer items-center gap-1.5 px-1 py-0.5 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={filtroEstilo.has(estilo)}
                        onChange={() => toggleSet(filtroEstilo, estilo, setFiltroEstilo)}
                      />
                      <span className="truncate" title={estilo}>
                        {estilo}
                      </span>
                      <span className="ml-auto tabular-nums text-slate-400">{n}</span>
                    </label>
                  </li>
                ))
              )}
            </ul>
          </AcordeonFiltro>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <label className="block text-sm">
              <span className="text-xs font-medium text-slate-700">Buscar L+R+M+C · marca · estilo</span>
              <input
                type="search"
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
                className="mt-1 block w-56 rounded border border-slate-200 px-2 py-1.5 text-sm"
                placeholder="Ej. BOTAS MOLECA"
              />
            </label>
            <button
              type="button"
              onClick={marcarEsperadoVisible}
              disabled={filtradas.length === 0}
              className="rounded border border-rimec-azul/40 bg-white px-3 py-2 text-xs font-semibold text-rimec-azul hover:bg-blue-50 disabled:opacity-50"
            >
              Marcar visibles al % esperado
            </button>
            <select
              value={pctMasivo}
              onChange={(e) => setPctMasivo(e.target.value)}
              className="rounded border border-slate-200 px-2 py-2 text-xs"
            >
              <option value="">Asignar visibles a…</option>
              {PCT_POLITICA_OPCIONES.map((o) => (
                <option key={o.pct} value={o.pct}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={marcarMasivo}
              disabled={!pctMasivo || filtradas.length === 0}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50"
            >
              Marcar visibles
            </button>
          </div>

          <div className="max-h-[480px] overflow-y-auto rounded-lg border border-slate-200 bg-white">
            {filtradas.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">Nada que revisar con ese filtro.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-100 text-[10px] uppercase text-slate-500">
                  <tr>
                    <th className="px-2 py-2 w-12" />
                    <th className="px-2 py-2">Producto L+R+M+C</th>
                    <th className="px-2 py-2">Tipo · AB-CR · Marca · Estilo</th>
                    <th className="px-2 py-2">Actual</th>
                    <th className="px-2 py-2">¿A dónde agregar?</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((m) => {
                    const p = m.row;
                    return (
                      <tr key={m.key} className="border-t border-slate-100 align-top">
                        <td className="px-2 py-2">
                          <DepositoProductThumb
                            linea={p.linea_codigo_proveedor}
                            referencia={p.referencia_codigo_proveedor}
                            material={p.material_code}
                            color={p.color_code}
                            imagenNombre={p.imagen_nombre}
                            size={44}
                            imageCtx={{
                              tipoV2Id: p.tipo_v2_id,
                              imagenColorExcel: p.imagen_color_excel ?? null,
                            }}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <p className="font-mono text-xs font-bold text-slate-900">{molKeyLabel(m.key)}</p>
                          <p className="text-[10px] text-slate-500">
                            {m.politicaLabel} · sugerido auto {m.pctEsperado}%
                            {m.pctAsignado != null ? (
                              <span className="font-semibold text-emerald-700">
                                {" "}
                                · ratificado {m.pctAsignado}%
                              </span>
                            ) : null}
                            {m.divergenciaCriterio ? (
                              <span className="text-amber-700"> · criterio distinto DPE</span>
                            ) : null}
                          </p>
                        </td>
                        <td className="px-2 py-2 text-[11px] leading-snug text-slate-700">
                          <span className="font-semibold text-fuchsia-700">{m.labels.tipoDiccionario}</span>
                          <br />
                          <span className="text-slate-600">AB-CR: {m.labels.abcr}</span>
                          <br />
                          <span>{m.labels.marca}</span>
                          {m.labels.estilo !== "—" ? (
                            <>
                              <br />
                              <span className="text-slate-500">{m.labels.estilo}</span>
                            </>
                          ) : null}
                        </td>
                        <td className="px-2 py-2 tabular-nums text-xs">
                          {m.pctAsignado != null ? `${m.pctAsignado}%` : "—"}
                        </td>
                        <td className="px-2 py-2">
                          <select
                            value={asignaciones[m.key] ?? ""}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              setAsignaciones((prev) => {
                                const next = { ...prev };
                                if (!v && v !== 0) delete next[m.key];
                                else next[m.key] = v;
                                return next;
                              });
                            }}
                            className="w-full max-w-[220px] rounded border border-slate-200 px-2 py-1.5 text-xs"
                          >
                            <option value="">— elegir % —</option>
                            {PCT_POLITICA_OPCIONES.map((o) => (
                              <option key={o.pct} value={o.pct}>
                                {o.label}
                                {o.pct === m.pctEsperado ? " ✓" : ""}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={aplicar}
              disabled={applying || pendientesApply === 0}
              className="rounded-lg bg-rimec-azul px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {applying ? "Aplicando…" : `Aplicar (${pendientesApply})`}
            </button>
            <span className="text-xs text-slate-600">
              {filtradas.length} visible(s) · {base.length} pendiente(s)
            </span>
            {msg ? <span className="text-sm text-emerald-700">{msg}</span> : null}
            {err ? <span className="text-sm text-red-700">{err}</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
