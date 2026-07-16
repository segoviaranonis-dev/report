"use client";

import { useCallback, useEffect, useState } from "react";
import type { TipoV2Id } from "@/lib/pilares/types";
import { mapaResumenPorProveedor, SDRM_BATCH_DEFAULT } from "@/lib/pilares/sdrm-pilares-map";
import type { SdrmMapaApplyResult, SdrmMapaPreview } from "@/lib/pilares/aplicar-mapa-sdrm";

type Props = {
  tipoV2Id: TipoV2Id;
  onApplied?: () => Promise<void>;
};

export function SdrmPilaresMapaPanel({ tipoV2Id, onApplied }: Props) {
  const [batch, setBatch] = useState(SDRM_BATCH_DEFAULT);
  const [preview, setPreview] = useState<SdrmMapaPreview | null>(null);
  const [applied, setApplied] = useState<SdrmMapaApplyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const resumen = mapaResumenPorProveedor(tipoV2Id);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const q = new URLSearchParams({
        tipo_v2_id: String(tipoV2Id),
        batch: batch.trim().toLowerCase(),
      });
      const res = await fetch(`/api/pilares/aplicar-mapa-sdrm?${q}`);
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) {
        throw new Error("Sesión expirada o acceso denegado — recargá e iniciá sesión RIMEC Admin.");
      }
      const j = (await res.json()) as { ok?: boolean; preview?: SdrmMapaPreview; error?: string };
      if (!res.ok || !j.ok || !j.preview) throw new Error(j.error ?? "Error en vista previa");
      setPreview(j.preview);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [batch, tipoV2Id]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const aplicar = async () => {
    setLoading(true);
    setErr(null);
    setApplied(null);
    try {
      const res = await fetch("/api/pilares/aplicar-mapa-sdrm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch: batch.trim().toLowerCase(), tipo_v2_id: tipoV2Id }),
      });
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) {
        throw new Error("Sesión expirada o acceso denegado — recargá e iniciá sesión RIMEC Admin.");
      }
      const j = (await res.json()) as {
        ok?: boolean;
        applied?: SdrmMapaApplyResult;
        error?: string;
      };
      if (!res.ok || !j.ok || !j.applied) throw new Error(j.error ?? "No se pudo aplicar");
      setApplied(j.applied);
      await loadPreview();
      await onApplied?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al aplicar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <details className="mb-4 rounded-xl border-2 border-emerald-300/60 bg-gradient-to-r from-emerald-50/90 to-white shadow-sm">
      <summary className="cursor-pointer list-none px-5 py-4 marker:content-none">
        <span className="font-serif text-lg font-semibold text-emerald-900">Mapa SDRM → Pilares</span>
        <span className="ml-2 text-sm font-normal text-neutral-600">{resumen.titulo}</span>
      </summary>

      <div className="space-y-4 border-t border-emerald-200/60 px-5 pb-5 pt-4">
        <table className="w-full text-xs text-neutral-700">
          <thead>
            <tr className="text-left text-[10px] uppercase text-neutral-500">
              <th className="pb-1 pr-3">Excel SDRM</th>
              <th className="pb-1">Campo pilares</th>
            </tr>
          </thead>
          <tbody>
            {resumen.filas.map((f) => (
              <tr key={f.excel} className="border-t border-emerald-100/80">
                <td className="py-1 pr-3 font-mono font-semibold text-emerald-900">{f.excel}</td>
                <td className="py-1">{f.pilares}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase text-report-muted">Batch</span>
            <input
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
              className="w-36 rounded-lg border border-report-rule px-3 py-2 font-mono text-sm"
            />
          </label>
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadPreview()}
            className="rounded-lg border border-emerald-400 px-4 py-2 text-sm font-semibold text-emerald-900"
          >
            Vista previa
          </button>
          <button
            type="button"
            disabled={loading || !preview?.lineas_distintas}
            onClick={() => void aplicar()}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Aplicar mapa a pilares
          </button>
        </div>

        {preview ? (
          <p className="text-xs text-neutral-700">
            <strong>{preview.lineas_distintas}</strong> líneas ·{" "}
            <strong className="text-emerald-800">{preview.liquidacion_articulos}</strong> con LIQUIDACIÓN
            (cadena SDRM) · tipo1 mapeables: {preview.pendiente_tipo1} · estilo: {preview.pendiente_estilo}
          </p>
        ) : null}

        {applied ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
            OK — género {applied.lineas_genero} · marca {applied.lineas_marca} · L×R {applied.lr_estilo_tipo1}
            {applied.maestras_tipo1_creadas.length
              ? ` · tipo1 nuevos: ${applied.maestras_tipo1_creadas.join(", ")}`
              : ""}
          </p>
        ) : null}

        {preview?.muestra?.length ? (
          <div className="overflow-x-auto rounded-lg border border-report-rule">
            <table className="min-w-full text-[10px]">
              <thead className="bg-slate-50 text-left uppercase text-slate-500">
                <tr>
                  <th className="px-2 py-1">Línea</th>
                  <th className="px-2 py-1">Marca</th>
                  <th className="px-2 py-1">Género</th>
                  <th className="px-2 py-1">Estilo</th>
                  <th className="px-2 py-1">Tipo 1</th>
                  <th className="px-2 py-1">Cadena</th>
                </tr>
              </thead>
              <tbody>
                {preview.muestra.map((m) => (
                  <tr key={m.linea_codigo} className="border-t border-slate-100">
                    <td className="px-2 py-1 font-mono">{m.linea_codigo}</td>
                    <td className="px-2 py-1">{m.marca ?? "—"}</td>
                    <td className="px-2 py-1">{m.genero ?? "—"}</td>
                    <td className="px-2 py-1">{m.estilo ?? "—"}</td>
                    <td className="px-2 py-1">{m.tipo1 ?? "—"}</td>
                    <td
                      className={`px-2 py-1 font-semibold ${
                        m.cadena_comercial === "LIQUIDACION" ? "text-emerald-700" : ""
                      }`}
                    >
                      {m.cadena_comercial ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {err ? <p className="text-xs font-semibold text-red-600">{err}</p> : null}
      </div>
    </details>
  );
}
