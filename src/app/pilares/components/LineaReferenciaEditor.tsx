"use client";

import { useState } from "react";
import type { PilaresMaestras, TipoV2Id } from "@/lib/pilares/types";
import { PilaresLineaSearchInput } from "./PilaresLineaSearchInput";

const NO_CAMBIAR = "none";

interface LineaReferenciaEditorProps {
  tipoV2Id: TipoV2Id;
  maestras: PilaresMaestras;
  onApplied: () => Promise<void>;
}

export function LineaReferenciaEditor({ tipoV2Id, maestras, onApplied }: LineaReferenciaEditorProps) {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [generoId, setGeneroId] = useState(NO_CAMBIAR);
  const [estiloId, setEstiloId] = useState(NO_CAMBIAR);
  const [tipo1Id, setTipo1Id] = useState(NO_CAMBIAR);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const apply = async () => {
    setError(null);
    setSuccess(null);
    const d = desde.trim();
    const h = hasta.trim();
    if (!d || !h) {
      setError("Indicá línea inicial y final.");
      return;
    }
    if (d > h) {
      setError("Línea inicial debe ser ≤ línea final.");
      return;
    }
    if (generoId === NO_CAMBIAR && estiloId === NO_CAMBIAR && tipo1Id === NO_CAMBIAR) {
      setError("Seleccioná al menos Género, Estilo o Tipo 1.");
      return;
    }

    setApplying(true);
    try {
      const body: Record<string, unknown> = {
        rango: true,
        tipo_v2_id: tipoV2Id,
        desde: d,
        hasta: h,
      };
      if (generoId !== NO_CAMBIAR) body.genero_id = Number(generoId);
      if (estiloId !== NO_CAMBIAR) body.grupo_estilo_id = Number(estiloId);
      if (tipo1Id !== NO_CAMBIAR) body.tipo_1_id = Number(tipo1Id);

      const res = await fetch("/api/pilares/linea-referencia", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) {
        throw new Error("Sesión expirada o acceso denegado — recargá e iniciá sesión RIMEC Admin.");
      }
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo aplicar");

      const parts: string[] = [];
      if (data.lineas_updated) parts.push(`${data.lineas_updated} líneas (género)`);
      if (data.lr_updated) parts.push(`${data.lr_updated} pares L×R (estilo/tipo 1)`);
      setSuccess(parts.length ? parts.join(" · ") : "Sin filas en ese rango.");
      await onApplied();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al aplicar");
    } finally {
      setApplying(false);
    }
  };

  return (
    <details
      open
      className="mb-4 rounded-xl border-2 border-rimec-azul/25 bg-card-bg shadow-sm"
    >
      <summary className="cursor-pointer list-none px-5 py-4 marker:content-none">
        <span className="font-serif text-lg font-semibold text-rimec-azul-dark">Editor</span>
        <span className="ml-2 text-sm font-normal text-neutral-500">
          Cambio masivo por rango de código línea
        </span>
      </summary>

      <div className="space-y-4 border-t border-rimec-azul/10 px-5 pb-5 pt-4">
        <p className="text-xs text-neutral-600">
          Ej.: líneas <strong>1122</strong>–<strong>1184</strong> · estilo taco alto → chatita · tipo 1 cerrado →
          abierto. Género actualiza <code className="text-[10px]">linea</code>; estilo y tipo 1 actualizan{" "}
          <code className="text-[10px]">linea_referencia</code> (todas las refs del rango).
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <PilaresLineaSearchInput
            tipoV2Id={tipoV2Id}
            label="Línea inicial"
            value={desde}
            onChange={setDesde}
            placeholder="1122"
          />
          <PilaresLineaSearchInput
            tipoV2Id={tipoV2Id}
            label="Línea final"
            value={hasta}
            onChange={setHasta}
            placeholder="1184"
          />
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase text-report-muted">Género</span>
            <select
              value={generoId}
              onChange={(e) => setGeneroId(e.target.value)}
              className="w-full rounded-lg border border-report-rule px-3 py-2 text-sm"
            >
              <option value={NO_CAMBIAR}>— No cambiar —</option>
              {maestras.generos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase text-report-muted">Estilo</span>
            <select
              value={estiloId}
              onChange={(e) => setEstiloId(e.target.value)}
              className="w-full rounded-lg border border-report-rule px-3 py-2 text-sm"
            >
              <option value={NO_CAMBIAR}>— No cambiar —</option>
              {maestras.estilos.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase text-report-muted">Tipo 1</span>
            <select
              value={tipo1Id}
              onChange={(e) => setTipo1Id(e.target.value)}
              className="w-full rounded-lg border border-report-rule px-3 py-2 text-sm"
            >
              <option value={NO_CAMBIAR}>— No cambiar —</option>
              {maestras.tipos1.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={applying}
            onClick={apply}
            className="rounded-lg bg-red-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
          >
            {applying ? "Aplicando…" : "Aplicar"}
          </button>
          {error && <p className="text-sm text-red-700">{error}</p>}
          {success && <p className="text-sm font-medium text-green-800">{success}</p>}
        </div>
      </div>
    </details>
  );
}
