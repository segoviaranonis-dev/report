"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ProductThumbFrame } from "@/components/product/ProductThumbFrame";
import type { LineaReferenciaCascada, LineaReferenciaRow, PilaresMaestras } from "@/lib/pilares/types";
import { productImageCandidatesForRow } from "@/lib/retail/product-image";
import { PilaresLineaReferenciaFiltrosBar } from "./PilaresLineaReferenciaFiltrosBar";
import { LineaReferenciaBuscador } from "./LineaReferenciaBuscador";
import { LineaReferenciaEditor } from "./LineaReferenciaEditor";
import { SdrmPilaresMapaPanel } from "./SdrmPilaresMapaPanel";
import { useTipoV2FromUrl } from "./TipoV2Selector";

const EMPTY_MAESTRAS: PilaresMaestras = { marcas: [], generos: [], estilos: [], tipos1: [] };
const EMPTY_CASCADA: LineaReferenciaCascada = { marcas: [], estilos: [], tipos1: [], lineas: [] };

export function LineaReferenciaAdminClient() {
  const tipoV2Id = useTipoV2FromUrl();
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<LineaReferenciaRow[]>([]);
  const [total, setTotal] = useState(0);
  const [cascada, setCascada] = useState<LineaReferenciaCascada>(EMPTY_CASCADA);
  const [maestras, setMaestras] = useState<PilaresMaestras>(EMPTY_MAESTRAS);
  const [filtroMarca, setFiltroMarca] = useState("");
  const [filtroEstilo, setFiltroEstilo] = useState("");
  const [filtroTipo1, setFiltroTipo1] = useState("");
  const [lineasSeleccionadas, setLineasSeleccionadas] = useState<string[]>([]);
  const [savingId, setSavingId] = useState<number | null>(null);

  const cascadaActiva = Boolean(
    filtroEstilo || filtroTipo1 || lineasSeleccionadas.length > 0,
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ tipo_v2_id: String(tipoV2Id), limit: "200" });
      if (filtroMarca) params.set("marca", filtroMarca);
      if (filtroEstilo) params.set("estilo_id", filtroEstilo);
      if (filtroTipo1) params.set("tipo_1_id", filtroTipo1);
      if (lineasSeleccionadas.length) params.set("linea_codigos", lineasSeleccionadas.join(","));

      const [resLr, resMaestras] = await Promise.all([
        fetch(`/api/pilares/linea-referencia?${params}`),
        fetch(`/api/pilares/maestras?tipo_v2_id=${tipoV2Id}`),
      ]);
      const dataLr = await resLr.json();
      const dataMaestras = await resMaestras.json();

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

      if (resMaestras.ok && dataMaestras.configured !== false) {
        setMaestras({
          marcas: dataMaestras.marcas ?? [],
          generos: dataMaestras.generos ?? [],
          estilos: dataMaestras.estilos ?? [],
          tipos1: dataMaestras.tipos1 ?? [],
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }, [tipoV2Id, filtroMarca, filtroEstilo, filtroTipo1, lineasSeleccionadas]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setFiltroMarca("");
    setFiltroEstilo("");
    setFiltroTipo1("");
    setLineasSeleccionadas([]);
  }, [tipoV2Id]);

  useEffect(() => {
    if (!cascadaActiva || !filtroMarca) return;
    const keys = new Set(cascada.marcas.map((m) => m.key.trim().toLowerCase()));
    if (!keys.has(filtroMarca.trim().toLowerCase())) setFiltroMarca("");
  }, [cascada, cascadaActiva, filtroMarca]);

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
        body: JSON.stringify({ tipo_v2_id: tipoV2Id, id: row.id, ...patch }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo guardar");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSavingId(null);
    }
  };

  if (!configured) {
    return (
      <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-6 text-amber-900">
        DATABASE_URL no configurada en el servidor.
      </div>
    );
  }

  const hasAnyFilter =
    filtroMarca || filtroEstilo || filtroTipo1 || lineasSeleccionadas.length > 0;

  return (
    <div>
      <div className="mb-6">
        <Link href="/pilares" className="text-sm font-semibold text-rimec-azul hover:underline">
          ← Pilares
        </Link>
        <h1 className="mt-2 font-serif text-3xl text-rimec-azul-dark">Administrador Línea × Referencia</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Tabla <strong>linea_referencia</strong> · estilo y tipo 1 → filtros header Tablet y RIMEC
        </p>
      </div>

      <PilaresLineaReferenciaFiltrosBar
        maestras={maestras}
        filtroMarca={filtroMarca}
        filtroEstilo={filtroEstilo}
        filtroTipo1={filtroTipo1}
        onMarca={setFiltroMarca}
        onEstilo={setFiltroEstilo}
        onTipo1={setFiltroTipo1}
        cascada={cascada}
        cascadaActiva={cascadaActiva}
        loading={loading}
        tipoV2Id={tipoV2Id}
      />

      <LineaReferenciaBuscador
        tipoV2Id={tipoV2Id}
        lineasSeleccionadas={lineasSeleccionadas}
        onLineasChange={setLineasSeleccionadas}
        scopeTotal={total}
      />

      <SdrmPilaresMapaPanel tipoV2Id={tipoV2Id} onApplied={load} />

      <LineaReferenciaEditor tipoV2Id={tipoV2Id} maestras={maestras} onApplied={load} />

      {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-800">{error}</p>}

      {total > 200 && !hasAnyFilter && (
        <p className="mb-3 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {total.toLocaleString("es-PY")} combinaciones en total — aplicá filtros para acotar (máx. 200 filas).
        </p>
      )}

      <p className="mb-3 text-sm text-neutral-600">
        {loading ? "Cargando…" : `${rows.length} filas · ${total.toLocaleString("es-PY")} total filtrado en BD`}
      </p>

      <div className="overflow-x-auto rounded-xl border border-rimec-azul/20 bg-card-bg shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-rimec-azul/15 bg-rimec-celeste-bg/40 text-xs uppercase tracking-wide text-rimec-azul-dark">
            <tr>
              <th className="px-3 py-3">Línea</th>
              <th className="px-3 py-3">Ref</th>
              <th className="px-3 py-3 w-16" aria-label="Imagen" />
              <th className="px-3 py-3">Marca</th>
              <th className="px-3 py-3">Estilo</th>
              <th className="px-3 py-3">Tipo 1</th>
              <th className="px-3 py-3 w-24" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <LrRowEditor
                key={row.id}
                row={row}
                estilos={estilosForRow(maestras.estilos, row)}
                tipos1={tipos1ForRow(maestras.tipos1, row)}
                saving={savingId === row.id}
                onSave={saveRow}
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
    </div>
  );
}

function estilosForRow(catalogo: PilaresMaestras["estilos"], row: LineaReferenciaRow) {
  if (row.grupo_estilo_id == null) return catalogo;
  if (catalogo.some((e) => e.id === row.grupo_estilo_id)) return catalogo;
  const label = row.descp_grupo_estilo || `Estilo #${row.grupo_estilo_id}`;
  return [...catalogo, { id: row.grupo_estilo_id, label }].sort((a, b) =>
    a.label.localeCompare(b.label, "es"),
  );
}

function tipos1ForRow(catalogo: PilaresMaestras["tipos1"], row: LineaReferenciaRow) {
  if (row.tipo_1_id == null) return catalogo;
  if (catalogo.some((t) => t.id === row.tipo_1_id)) return catalogo;
  const label = row.descp_tipo_1 || `Tipo #${row.tipo_1_id}`;
  return [...catalogo, { id: row.tipo_1_id, label }].sort((a, b) => a.label.localeCompare(b.label, "es"));
}

function LrRowEditor({
  row,
  estilos,
  tipos1,
  saving,
  onSave,
}: {
  row: LineaReferenciaRow;
  estilos: PilaresMaestras["estilos"];
  tipos1: PilaresMaestras["tipos1"];
  saving: boolean;
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
  }, [row.grupo_estilo_id, row.tipo_1_id]);

  const dirty =
    (estiloId || "") !== (row.grupo_estilo_id != null ? String(row.grupo_estilo_id) : "") ||
    (tipo1Id || "") !== (row.tipo_1_id != null ? String(row.tipo_1_id) : "");

  return (
    <tr className="border-b border-neutral-100 hover:bg-rimec-celeste-bg/20">
      <td className="px-3 py-2 font-mono font-semibold">{row.linea_codigo}</td>
      <td className="px-3 py-2 font-mono">
        {row.referencia_codigo}
        {isK && (
          <span className="ml-2 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-800">
            K
          </span>
        )}
      </td>
      <td className="px-2 py-2">
        <ProductThumbFrame
          alt={`${row.linea_codigo}-${row.referencia_codigo}`}
          candidates={productImageCandidatesForRow(
            row.linea_codigo,
            row.referencia_codigo,
            row.thumb?.material_code ?? "",
            row.thumb?.color_code ?? "",
            row.thumb?.imagen_nombre,
            "thumb",
          )}
          size={48}
        />
      </td>
      <td className="px-3 py-2 text-neutral-600">{row.marca || "—"}</td>
      <td className="px-3 py-2">
        <select
          value={estiloId}
          onChange={(e) => setEstiloId(e.target.value)}
          className="w-full max-w-[180px] rounded border border-neutral-200 px-2 py-1 text-sm"
        >
          <option value="">— vacío —</option>
          {estilos.map((e) => (
            <option key={e.id} value={e.id}>
              {e.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <select
          value={tipo1Id}
          onChange={(e) => setTipo1Id(e.target.value)}
          className="w-full max-w-[160px] rounded border border-neutral-200 px-2 py-1 text-sm"
        >
          <option value="">— vacío —</option>
          {tipos1.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={() =>
            onSave(row, {
              grupo_estilo_id: estiloId ? Number(estiloId) : null,
              tipo_1_id: tipo1Id ? Number(tipo1Id) : null,
            })
          }
          className="rounded bg-rimec-azul px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
        >
          {saving ? "…" : "Guardar"}
        </button>
      </td>
    </tr>
  );
}
