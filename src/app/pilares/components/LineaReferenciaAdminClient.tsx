"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProductThumbFrame } from "@/components/product/ProductThumbFrame";
import type {
  LineaReferenciaCascada,
  LineaReferenciaProblemasEstiloResumen,
  LineaReferenciaRow,
  PilaresMaestras,
} from "@/lib/pilares/types";
import {
  emptyLrCabecera,
  type LrCabeceraPatch,
  type LrCabeceraState,
  type LrDepositoCodigo,
  type LrOrigenTipo,
} from "@/lib/pilares/lr-cascada-molecula";
import { parseTipoV2Id } from "@/lib/pilares/constants";
import { productImageCandidatesForRow } from "@/lib/retail/product-image";
import { PilaresLrFiltrosSidebar } from "./PilaresLrFiltrosSidebar";
import { LineaReferenciaEditor } from "./LineaReferenciaEditor";
import { SdrmPilaresMapaPanel } from "./SdrmPilaresMapaPanel";

const EMPTY_MAESTRAS: PilaresMaestras = { marcas: [], generos: [], estilos: [], tipos1: [] };
const EMPTY_CASCADA: LineaReferenciaCascada = {
  generos: [],
  marcas: [],
  estilos: [],
  tipos1: [],
  lineas: [],
  referencias: [],
  materiales: [],
  colores: [],
};

function parseIds(raw: string | null): number[] {
  if (!raw?.trim() || raw === "__null__") return [];
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
}

function parseOrigen(raw: string | null): LrOrigenTipo {
  const u = (raw || "TODOS").toUpperCase();
  if (u.includes("PRONTA")) return "PRONTA_ENTREGA";
  if (u === "CP" || u.includes("PREVIA")) return "CP";
  return "TODOS";
}

function stateFromSearchParams(sp: URLSearchParams): LrCabeceraState {
  const tipo = parseTipoV2Id(sp.get("tipo_v2_id")) as 1 | 2;
  const estiloRaw = sp.get("estilo_ids") || sp.get("estilo_id");
  const dep = (sp.get("deposito_codigo") || "") as LrDepositoCodigo;
  return {
    tipo_v2_id: tipo,
    origen_tipo: parseOrigen(sp.get("origen_tipo")),
    deposito_codigo: dep === "D1" || dep === "DEP2" || dep === "D3" ? dep : "",
    buscar: sp.get("q") || sp.get("buscar") || "",
    genero_ids: parseIds(sp.get("genero_ids") || sp.get("genero_id")),
    marca_ids: parseIds(sp.get("marca_ids")),
    tipo_1_ids: parseIds(sp.get("tipo_1_ids") || sp.get("tipo_1_id")),
    tipo_grupos: (sp.get("tipo_grupos") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    estilo_ids: estiloRaw === "__null__" ? [] : parseIds(estiloRaw),
    estilo_null: estiloRaw === "__null__",
    problemas_estilo: sp.get("problemas_estilo") === "1",
    con_imagen:
      sp.get("con_imagen") === "1" || sp.get("con_imagen") === "0"
        ? (sp.get("con_imagen") as "1" | "0")
        : "",
    linea_ids: parseIds(sp.get("linea_ids")),
    referencia_ids: parseIds(sp.get("referencia_ids")),
    material_familias: (sp.get("material_familias") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    color_familias: (sp.get("color_familias") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

function stateToSearchParams(state: LrCabeceraState): URLSearchParams {
  const p = new URLSearchParams();
  p.set("tipo_v2_id", String(state.tipo_v2_id));
  if (state.origen_tipo !== "TODOS") p.set("origen_tipo", state.origen_tipo);
  if (state.deposito_codigo) p.set("deposito_codigo", state.deposito_codigo);
  if (state.buscar.trim()) p.set("q", state.buscar.trim());
  if (state.genero_ids.length) p.set("genero_ids", state.genero_ids.join(","));
  if (state.marca_ids.length) p.set("marca_ids", state.marca_ids.join(","));
  if (state.tipo_1_ids.length) p.set("tipo_1_ids", state.tipo_1_ids.join(","));
  if (state.tipo_grupos.length) p.set("tipo_grupos", state.tipo_grupos.join(","));
  if (state.problemas_estilo) p.set("problemas_estilo", "1");
  else if (state.estilo_null) p.set("estilo_ids", "__null__");
  else if (state.estilo_ids.length) p.set("estilo_ids", state.estilo_ids.join(","));
  if (state.problemas_estilo && state.con_imagen) p.set("con_imagen", state.con_imagen);
  if (state.linea_ids.length) p.set("linea_ids", state.linea_ids.join(","));
  if (state.referencia_ids.length) p.set("referencia_ids", state.referencia_ids.join(","));
  if (state.material_familias.length) p.set("material_familias", state.material_familias.join(","));
  if (state.color_familias.length) p.set("color_familias", state.color_familias.join(","));
  return p;
}

export function LineaReferenciaAdminClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const loadSeq = useRef(0);

  const state = useMemo(() => stateFromSearchParams(searchParams), [searchParams]);

  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<LineaReferenciaRow[]>([]);
  const [total, setTotal] = useState(0);
  const [cascada, setCascada] = useState<LineaReferenciaCascada>(EMPTY_CASCADA);
  const [maestras, setMaestras] = useState<PilaresMaestras>(EMPTY_MAESTRAS);
  const [problemasResumen, setProblemasResumen] =
    useState<LineaReferenciaProblemasEstiloResumen | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  const replaceState = useCallback(
    (next: LrCabeceraState) => {
      router.replace(`${pathname}?${stateToSearchParams(next).toString()}`, { scroll: false });
    },
    [pathname, router],
  );

  const onPatch = useCallback(
    (patch: LrCabeceraPatch) => replaceState({ ...state, ...patch }),
    [replaceState, state],
  );

  const onLimpiar = useCallback(() => {
    replaceState(emptyLrCabecera(state.tipo_v2_id));
  }, [replaceState, state.tipo_v2_id]);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setError(null);
    try {
      const params = stateToSearchParams(state);
      params.set("limit", "200");

      const [resLr, resMaestras] = await Promise.all([
        fetch(`/api/pilares/linea-referencia?${params}`, { cache: "no-store" }),
        fetch(`/api/pilares/maestras?tipo_v2_id=${state.tipo_v2_id}`, { cache: "no-store" }),
      ]);
      if (seq !== loadSeq.current) return;

      const dataLr = await resLr.json();
      const dataMaestras = await resMaestras.json();
      if (seq !== loadSeq.current) return;

      if (!resLr.ok) throw new Error(dataLr.error || "Error al cargar L×R");
      if (dataLr.configured === false) {
        setConfigured(false);
        setRows([]);
        return;
      }
      setConfigured(true);
      setRows(dataLr.rows ?? []);
      setTotal(dataLr.total ?? 0);
      setCascada(dataLr.cascada ?? EMPTY_CASCADA);
      setProblemasResumen(dataLr.problemas_estilo ?? null);

      if (resMaestras.ok && dataMaestras.configured !== false) {
        setMaestras({
          marcas: dataMaestras.marcas ?? [],
          generos: dataMaestras.generos ?? [],
          estilos: dataMaestras.estilos ?? [],
          tipos1: dataMaestras.tipos1 ?? [],
        });
      }
    } catch (e) {
      if (seq !== loadSeq.current) return;
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [state]);

  useEffect(() => {
    load();
  }, [load]);

  const saveRow = async (
    row: LineaReferenciaRow,
    patch: { grupo_estilo_id?: number | null; tipo_1_id?: number | null },
  ) => {
    setSavingId(row.id);
    setError(null);
    try {
      const res = await fetch("/api/pilares/linea-referencia", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo_v2_id: state.tipo_v2_id, id: row.id, ...patch }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo guardar");

      const nextEstiloId =
        "grupo_estilo_id" in patch ? patch.grupo_estilo_id ?? null : row.grupo_estilo_id;
      const nextTipo1Id = "tipo_1_id" in patch ? patch.tipo_1_id ?? null : row.tipo_1_id;
      const estiloLabel =
        nextEstiloId == null
          ? ""
          : maestras.estilos.find((e) => Number(e.id) === Number(nextEstiloId))?.label ??
            row.descp_grupo_estilo;
      const stillInView = rowMatchesCurrentFilter(state, {
        grupo_estilo_id: nextEstiloId,
        estilo_label: estiloLabel,
      });

      if (!stillInView) {
        setRows((prev) => prev.filter((r) => r.id !== row.id));
        setTotal((t) => Math.max(0, t - 1));
      } else {
        setRows((prev) =>
          prev.map((r) =>
            r.id !== row.id
              ? r
              : {
                  ...r,
                  grupo_estilo_id: nextEstiloId,
                  tipo_1_id: nextTipo1Id,
                  descp_grupo_estilo: estiloLabel || r.descp_grupo_estilo,
                  problema_estilo_kind:
                    nextEstiloId == null
                      ? "SIN_ESTILO"
                      : estiloLabel.trim().toUpperCase() === "OTROS"
                        ? "OTROS"
                        : null,
                  es_problema_estilo:
                    nextEstiloId == null || estiloLabel.trim().toUpperCase() === "OTROS",
                },
          ),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
      // revert visual: reload fila
      await load();
    } finally {
      setSavingId(null);
    }
  };

  const filtroActivo = useMemo(() => {
    return (
      state.origen_tipo !== "TODOS" ||
      Boolean(state.deposito_codigo) ||
      state.genero_ids.length > 0 ||
      state.marca_ids.length > 0 ||
      state.tipo_1_ids.length > 0 ||
      state.tipo_grupos.length > 0 ||
      state.estilo_ids.length > 0 ||
      state.estilo_null ||
      state.problemas_estilo ||
      Boolean(state.con_imagen) ||
      state.linea_ids.length > 0 ||
      state.referencia_ids.length > 0 ||
      state.material_familias.length > 0 ||
      state.color_familias.length > 0 ||
      Boolean(state.buscar.trim())
    );
  }, [state]);

  if (!configured) {
    return (
      <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-6 text-amber-900">
        DATABASE_URL no configurada en el servidor.
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <header className="space-y-1">
        <Link href="/pilares" className="text-sm font-semibold text-rimec-azul hover:underline">
          ← Pilares
        </Link>
        <h1 className="font-serif text-2xl text-rimec-azul-dark sm:text-3xl">
          Administrador Línea × Referencia
        </h1>
        <p className="text-sm text-neutral-600">
          Maestra L×R → FK de filtros (Web · AM · PE) · SDRM/PE solo delimitan el universo ·
          auto-guarda · editor sobre el filtro
        </p>
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-950">
          <strong>Ley holding:</strong> estilo, tipo 1, marca y género que guardés acá alimentan
          todos los filtros del proyecto. SDRM y Pronta entrega no son la verdad — solo el
          alcance de trabajo de hoy.
        </p>
      </header>

      {/* Filtros flotantes (herramientas maestra) + grilla — sin scroll interno en filtros */}
      <div className="grid min-w-0 items-start gap-3 xl:grid-cols-[minmax(15rem,18rem)_minmax(15rem,18rem)_minmax(0,1fr)] xl:gap-4">
          <PilaresLrFiltrosSidebar
            state={state}
            onPatch={onPatch}
            onLimpiar={onLimpiar}
            maestras={maestras}
            cascada={cascada}
            problemasResumen={problemasResumen}
            loading={loading}
            layout="split"
          />

          <section className="min-w-0 space-y-3 rounded-2xl border border-rimec-azul/20 bg-white p-3 shadow-sm sm:p-4">
            <details className="rounded-xl border border-slate-200 bg-white">
              <summary className="cursor-pointer list-none px-4 py-2 text-sm font-semibold text-slate-700 marker:content-none">
                Herramientas (mapa SDRM · editor)
              </summary>
              <div className="space-y-3 border-t border-slate-100 px-3 py-3 sm:px-4">
                <SdrmPilaresMapaPanel tipoV2Id={state.tipo_v2_id} onApplied={load} />
                <LineaReferenciaEditor
                  tipoV2Id={state.tipo_v2_id}
                  maestras={maestras}
                  filterState={state}
                  filtroActivo={filtroActivo}
                  totalFiltrado={total}
                  onApplied={load}
                />
              </div>
            </details>

            {error && (
              <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-800">{error}</p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-neutral-600">
                {loading
                  ? "Cargando…"
                  : `${rows.length} en pantalla · ${total.toLocaleString("es-PY")} filtrado`}
              </p>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                {state.tipo_v2_id === 2 ? "638 confecciones" : "654 calzado"}
              </span>
            </div>

            <div className="space-y-2 md:hidden">
              {rows.map((row) => (
                <LrRowEditor
                  key={row.id}
                  row={row}
                  tipoV2Id={state.tipo_v2_id}
                  estilos={estilosForRow(maestras.estilos, row)}
                  tipos1={tipos1ForRow(maestras.tipos1, row)}
                  saving={savingId === row.id}
                  showProblemaBadges={state.problemas_estilo}
                  onSave={saveRow}
                  layout="card"
                />
              ))}
              {!loading && rows.length === 0 && (
                <p className="rounded-xl border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-neutral-500">
                  Sin combinaciones para este proveedor / filtros.
                </p>
              )}
            </div>

            <div className="hidden overflow-x-auto rounded-xl border border-rimec-azul/15 bg-white md:block">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-rimec-azul/15 bg-rimec-celeste-bg/40 text-xs uppercase tracking-wide text-rimec-azul-dark">
                  <tr>
                    <th className="px-3 py-3">Línea</th>
                    <th className="px-3 py-3">Ref</th>
                    <th className="w-16 px-3 py-3" aria-label="Imagen" />
                    <th className="px-3 py-3">Marca</th>
                    <th className="px-3 py-3">Estilo</th>
                    <th className="px-3 py-3">Tipo 1</th>
                    <th className="w-24 px-3 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <LrRowEditor
                      key={row.id}
                      row={row}
                      tipoV2Id={state.tipo_v2_id}
                      estilos={estilosForRow(maestras.estilos, row)}
                      tipos1={tipos1ForRow(maestras.tipos1, row)}
                      saving={savingId === row.id}
                      showProblemaBadges={state.problemas_estilo}
                      onSave={saveRow}
                      layout="row"
                    />
                  ))}
                  {!loading && rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-neutral-500">
                        Sin combinaciones para este proveedor / filtros.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
      </div>
    </div>
  );
}

/** ¿Sigue visible tras PATCH con el filtro URL actual? */
function rowMatchesCurrentFilter(
  state: LrCabeceraState,
  next: { grupo_estilo_id: number | null; estilo_label: string },
): boolean {
  const label = next.estilo_label.trim().toUpperCase();
  if (state.problemas_estilo) {
    return next.grupo_estilo_id == null || label === "OTROS";
  }
  if (state.estilo_null) {
    return next.grupo_estilo_id == null;
  }
  if (state.estilo_ids.length) {
    return (
      next.grupo_estilo_id != null &&
      state.estilo_ids.some((id) => Number(id) === Number(next.grupo_estilo_id))
    );
  }
  return true;
}

function dedupeMaestraOptions<T extends { id: number | string; label: string }>(items: T[]): T[] {
  const seen = new Set<number>();
  const out: T[] = [];
  for (const item of items) {
    const n = Number(item.id);
    if (!Number.isFinite(n) || seen.has(n)) continue;
    seen.add(n);
    out.push(item);
  }
  return out;
}

function estilosForRow(catalogo: PilaresMaestras["estilos"], row: LineaReferenciaRow) {
  const base = dedupeMaestraOptions(catalogo);
  if (row.grupo_estilo_id == null) return base;
  if (base.some((e) => Number(e.id) === Number(row.grupo_estilo_id))) return base;
  const label = row.descp_grupo_estilo || `Estilo #${row.grupo_estilo_id}`;
  return dedupeMaestraOptions([...base, { id: row.grupo_estilo_id, label }]).sort((a, b) =>
    a.label.localeCompare(b.label, "es"),
  );
}

function tipos1ForRow(catalogo: PilaresMaestras["tipos1"], row: LineaReferenciaRow) {
  const base = dedupeMaestraOptions(catalogo);
  if (row.tipo_1_id == null) return base;
  if (base.some((t) => Number(t.id) === Number(row.tipo_1_id))) return base;
  const label = row.descp_tipo_1 || `Tipo #${row.tipo_1_id}`;
  return dedupeMaestraOptions([...base, { id: row.tipo_1_id, label }]).sort((a, b) =>
    a.label.localeCompare(b.label, "es"),
  );
}

function LrRowEditor({
  row,
  tipoV2Id,
  estilos,
  tipos1,
  saving,
  showProblemaBadges,
  onSave,
  layout = "row",
}: {
  row: LineaReferenciaRow;
  /** 1=654 · 2=638 — obligatorio para stem L_C (ley 2.01.04.021 §2). */
  tipoV2Id: 1 | 2;
  estilos: PilaresMaestras["estilos"];
  tipos1: PilaresMaestras["tipos1"];
  saving: boolean;
  showProblemaBadges: boolean;
  layout?: "row" | "card";
  onSave: (
    row: LineaReferenciaRow,
    patch: { grupo_estilo_id?: number | null; tipo_1_id?: number | null },
  ) => Promise<void>;
}) {
  const [estiloId, setEstiloId] = useState<string>(
    row.grupo_estilo_id != null ? String(row.grupo_estilo_id) : "",
  );
  const [tipo1Id, setTipo1Id] = useState<string>(row.tipo_1_id != null ? String(row.tipo_1_id) : "");
  const isK = row.referencia_codigo.toUpperCase() === "K";

  useEffect(() => {
    setEstiloId(row.grupo_estilo_id != null ? String(row.grupo_estilo_id) : "");
    setTipo1Id(row.tipo_1_id != null ? String(row.tipo_1_id) : "");
  }, [row.grupo_estilo_id, row.tipo_1_id, row.id]);

  const sugId = row.estilo_sugerido_id;
  const sugLabel = row.estilo_sugerido_label;

  const commitEstilo = (raw: string) => {
    const next = raw;
    setEstiloId(next);
    const prev = row.grupo_estilo_id != null ? String(row.grupo_estilo_id) : "";
    if (next === prev || saving) return;
    void onSave(row, { grupo_estilo_id: next === "" ? null : Number(next) });
  };

  const commitTipo1 = (raw: string) => {
    const next = raw;
    setTipo1Id(next);
    const prev = row.tipo_1_id != null ? String(row.tipo_1_id) : "";
    if (next === prev || saving) return;
    void onSave(row, { tipo_1_id: next === "" ? null : Number(next) });
  };

  const thumb = (
    <ProductThumbFrame
      alt={`${row.linea_codigo}-${row.referencia_codigo}`}
      candidates={productImageCandidatesForRow(
        row.linea_codigo,
        row.referencia_codigo,
        row.thumb?.material_code ?? "",
        row.thumb?.color_code ?? "",
        row.thumb?.imagen_nombre,
        "thumb",
        { tipoV2Id, imagenColorExcel: row.thumb?.color_code ?? null },
      )}
      size={layout === "card" ? 56 : 48}
    />
  );

  const estiloSelect = (
    <select
      value={estiloId}
      disabled={saving}
      onChange={(e) => commitEstilo(e.target.value)}
      className="w-full rounded border border-neutral-200 px-2 py-1.5 text-sm disabled:opacity-50"
    >
      <option value="">— vacío —</option>
      {estilos.map((e) => (
        <option key={e.id} value={e.id}>
          {e.label}
        </option>
      ))}
    </select>
  );

  const tipoSelect = (
    <select
      value={tipo1Id}
      disabled={saving}
      onChange={(e) => commitTipo1(e.target.value)}
      className="w-full rounded border border-neutral-200 px-2 py-1.5 text-sm disabled:opacity-50"
    >
      <option value="">— vacío —</option>
      {tipos1.map((t) => (
        <option key={t.id} value={t.id}>
          {t.label}
        </option>
      ))}
    </select>
  );

  if (layout === "card") {
    return (
      <article
        className={`rounded-xl border border-slate-200 bg-white p-3 shadow-sm ${
          saving ? "opacity-60" : ""
        }`}
      >
        <div className="flex gap-3">
          {thumb}
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-mono text-sm font-semibold text-rimec-azul-dark">
              {row.linea_codigo}
              <span className="ml-2 font-normal text-slate-500">
                · {row.referencia_codigo}
                {isK ? " (K)" : ""}
              </span>
            </p>
            <p className="truncate text-xs text-neutral-600">{row.marca || "—"}</p>
            {showProblemaBadges && (
              <div className="flex flex-wrap gap-1">
                {row.problema_estilo_kind === "SIN_ESTILO" && (
                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-800">
                    SIN ESTILO
                  </span>
                )}
                {row.problema_estilo_kind === "OTROS" && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                    OTROS
                  </span>
                )}
              </div>
            )}
          </div>
          <span className="self-start text-[10px] text-slate-400">
            {saving ? "…" : "auto"}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block text-xs">
            <span className="mb-1 block font-semibold uppercase text-slate-500">Estilo</span>
            {estiloSelect}
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-semibold uppercase text-slate-500">Tipo 1</span>
            {tipoSelect}
          </label>
        </div>
        {showProblemaBadges && sugId != null && sugLabel && (
          <button
            type="button"
            disabled={saving || Number(estiloId) === sugId}
            onClick={() => void onSave(row, { grupo_estilo_id: sugId })}
            className="mt-2 text-[11px] font-semibold text-rimec-azul underline-offset-2 hover:underline disabled:opacity-40"
          >
            Aplicar sugerido: {sugLabel}
          </button>
        )}
      </article>
    );
  }

  return (
    <tr
      className={`border-b border-neutral-100 hover:bg-rimec-celeste-bg/20 ${
        saving ? "opacity-60" : ""
      }`}
    >
      <td className="px-3 py-2 font-mono font-semibold">{row.linea_codigo}</td>
      <td className="px-3 py-2 font-mono">
        {row.referencia_codigo}
        {isK && (
          <span className="ml-2 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-800">
            K
          </span>
        )}
        {showProblemaBadges && (
          <div className="mt-1 flex flex-wrap gap-1">
            {row.problema_estilo_kind === "SIN_ESTILO" && (
              <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-800">
                SIN ESTILO
              </span>
            )}
            {row.problema_estilo_kind === "OTROS" && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                OTROS
              </span>
            )}
          </div>
        )}
      </td>
      <td className="px-2 py-2">{thumb}</td>
      <td className="px-3 py-2 text-neutral-600">{row.marca || "—"}</td>
      <td className="px-3 py-2">
        <div className="max-w-[200px]">{estiloSelect}</div>
        {showProblemaBadges && sugId != null && sugLabel && (
          <button
            type="button"
            disabled={saving || Number(estiloId) === sugId}
            onClick={() => void onSave(row, { grupo_estilo_id: sugId })}
            className="mt-1 text-[11px] font-semibold text-rimec-azul underline-offset-2 hover:underline disabled:opacity-40"
          >
            Aplicar sugerido: {sugLabel}
          </button>
        )}
      </td>
      <td className="px-3 py-2">
        <div className="max-w-[160px]">{tipoSelect}</div>
      </td>
      <td className="px-3 py-2 text-[11px] text-slate-500">
        {saving ? <span className="font-semibold text-rimec-azul">Guardando…</span> : "auto"}
      </td>
    </tr>
  );
}
