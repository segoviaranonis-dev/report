"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { LineaRow, LineasResumen, PilaresMaestras, TipoV2Id } from "@/lib/pilares/types";
import { DatosGeneralesLineas } from "./DatosGeneralesLineas";
import { PilaresLineasFiltrosBar } from "./PilaresLineasFiltrosBar";
import { useTipoV2FromUrl } from "./TipoV2Selector";

const EMPTY_MAESTRAS: PilaresMaestras = { marcas: [], generos: [], estilos: [], tipos1: [] };

export function LineasAdminClient() {
  const tipoV2Id = useTipoV2FromUrl();
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<LineaRow[]>([]);
  const [total, setTotal] = useState(0);
  const [maestras, setMaestras] = useState<PilaresMaestras>(EMPTY_MAESTRAS);
  const [filtroMarca, setFiltroMarca] = useState("");
  const [filtroGenero, setFiltroGenero] = useState("");
  const [resumen, setResumen] = useState<LineasResumen | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ tipo_v2_id: String(tipoV2Id), limit: "500" });
      if (filtroMarca) params.set("marca", filtroMarca);
      if (filtroGenero) params.set("genero", filtroGenero);

      const [resLineas, resMaestras] = await Promise.all([
        fetch(`/api/pilares/lineas?${params}`),
        fetch(`/api/pilares/maestras?tipo_v2_id=${tipoV2Id}`),
      ]);
      const dataLineas = await resLineas.json();
      const dataMaestras = await resMaestras.json();

      if (!resLineas.ok) throw new Error(dataLineas.error || "Error al cargar líneas");
      if (dataLineas.configured === false) {
        setConfigured(false);
        setRows([]);
        return;
      }
      setConfigured(true);
      setRows(dataLineas.rows ?? []);
      setTotal(dataLineas.total ?? 0);
      setResumen(dataLineas.resumen ?? null);

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
  }, [tipoV2Id, filtroMarca, filtroGenero]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setFiltroMarca("");
    setFiltroGenero("");
  }, [tipoV2Id]);

  const saveRow = async (row: LineaRow, patch: { marca_id?: number | null; genero_id?: number | null }) => {
    setSavingId(row.id);
    setError(null);
    try {
      const res = await fetch("/api/pilares/lineas", {
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

  return (
    <div>
      <div className="mb-6">
        <Link href="/pilares" className="text-sm font-semibold text-rimec-azul hover:underline">
          ← Pilares
        </Link>
        <h1 className="mt-2 font-serif text-3xl text-rimec-azul-dark">Administrador de Líneas</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Tabla <strong>linea</strong> · asignación <strong>marca_id</strong> / <strong>genero_id</strong> → filtros
          header Tablet y RIMEC
        </p>
      </div>

      <PilaresLineasFiltrosBar
        maestras={maestras}
        filtroMarca={filtroMarca}
        filtroGenero={filtroGenero}
        onMarca={setFiltroMarca}
        onGenero={setFiltroGenero}
        loading={loading}
      />

      <DatosGeneralesLineas
        resumen={resumen}
        maestras={maestras}
        totalFiltrado={total}
        filasMostradas={rows.length}
        filtroMarca={filtroMarca}
        filtroGenero={filtroGenero}
        loading={loading}
        onSelectMarca={(marca) => setFiltroMarca(marca)}
      />

      {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-800">{error}</p>}

      {!loading && (
        <p className="mb-3 text-sm text-neutral-600">
          Grilla: {rows.length} filas mostradas ·{" "}
          <strong>{total.toLocaleString("es-PY")}</strong> coinciden con el filtro
          {resumen && total !== resumen.total && (
            <> (de {resumen.total.toLocaleString("es-PY")} totales en BD)</>
          )}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-rimec-azul/20 bg-card-bg shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-rimec-azul/15 bg-rimec-celeste-bg/40 text-xs uppercase tracking-wide text-rimec-azul-dark">
            <tr>
              <th className="px-3 py-3">Código</th>
              <th className="px-3 py-3">Descripción</th>
              <th className="px-3 py-3">Marca</th>
              <th className="px-3 py-3">Género</th>
              <th className="px-3 py-3 w-24" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <LineaRowEditor
                key={row.id}
                row={row}
                marcas={marcasForRow(maestras.marcas, row)}
                generos={maestras.generos}
                saving={savingId === row.id}
                onSave={saveRow}
              />
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-neutral-500">
                  Sin líneas para este proveedor / filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function marcasForRow(catalogo: PilaresMaestras["marcas"], row: LineaRow) {
  if (row.marca_id == null || !row.marca) return catalogo;
  if (catalogo.some((m) => m.id === row.marca_id)) return catalogo;
  return [...catalogo, { id: row.marca_id, label: row.marca }].sort((a, b) =>
    a.label.localeCompare(b.label, "es"),
  );
}

function LineaRowEditor({
  row,
  marcas,
  generos,
  saving,
  onSave,
}: {
  row: LineaRow;
  marcas: PilaresMaestras["marcas"];
  generos: PilaresMaestras["generos"];
  saving: boolean;
  onSave: (row: LineaRow, patch: { marca_id?: number | null; genero_id?: number | null }) => Promise<void>;
}) {
  const [marcaId, setMarcaId] = useState<string>(row.marca_id != null ? String(row.marca_id) : "");
  const [generoId, setGeneroId] = useState<string>(row.genero_id != null ? String(row.genero_id) : "");

  useEffect(() => {
    setMarcaId(row.marca_id != null ? String(row.marca_id) : "");
    setGeneroId(row.genero_id != null ? String(row.genero_id) : "");
  }, [row.marca_id, row.genero_id]);

  const dirty =
    (marcaId || "") !== (row.marca_id != null ? String(row.marca_id) : "") ||
    (generoId || "") !== (row.genero_id != null ? String(row.genero_id) : "");

  return (
    <tr className="border-b border-neutral-100 hover:bg-rimec-celeste-bg/20">
      <td className="px-3 py-2 font-mono font-semibold">{row.codigo_proveedor}</td>
      <td className="px-3 py-2 text-neutral-600">{row.descripcion || "—"}</td>
      <td className="px-3 py-2">
        <select
          value={marcaId}
          onChange={(e) => setMarcaId(e.target.value)}
          className="w-full max-w-[180px] rounded border border-neutral-200 px-2 py-1 text-sm"
        >
          <option value="">— vacío —</option>
          {marcas.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <select
          value={generoId}
          onChange={(e) => setGeneroId(e.target.value)}
          className="w-full max-w-[160px] rounded border border-neutral-200 px-2 py-1 text-sm"
        >
          <option value="">— vacío —</option>
          {generos.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
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
              marca_id: marcaId ? Number(marcaId) : null,
              genero_id: generoId ? Number(generoId) : null,
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
