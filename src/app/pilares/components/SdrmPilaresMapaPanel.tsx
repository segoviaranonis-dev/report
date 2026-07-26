"use client";

import { useCallback, useEffect, useState } from "react";
import type { TipoV2Id } from "@/lib/pilares/types";
import { mapaResumenPorProveedor, SDRM_BATCH_DEFAULT } from "@/lib/pilares/sdrm-pilares-map";
import type { SdrmMapaApplyResult, SdrmMapaPreview } from "@/lib/pilares/aplicar-mapa-sdrm";

type Props = {
  tipoV2Id: TipoV2Id;
  onApplied?: () => Promise<void>;
};

function CoberturaBar({ label, pct, n, tot }: { label: string; pct: number; n: number; tot: number }) {
  return (
    <div className="min-w-[140px] flex-1">
      <div className="mb-0.5 flex justify-between text-[10px] uppercase text-neutral-500">
        <span>{label}</span>
        <span className="font-mono font-semibold text-emerald-900">
          {pct}% · {n}/{tot}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-neutral-200">
        <div
          className="h-full rounded-full bg-emerald-600 transition-all"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  );
}

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

  const cob = preview?.cobertura;

  return (
    <details className="mb-4 rounded-xl border-2 border-emerald-300/60 bg-gradient-to-r from-emerald-50/90 to-white shadow-sm">
      <summary className="cursor-pointer list-none px-5 py-4 marker:content-none">
        <span className="font-serif text-lg font-semibold text-emerald-900">Mapa SDRM → Pilares</span>
        <span className="ml-2 text-sm font-normal text-neutral-600">{resumen.titulo}</span>
        {cob ? (
          <span className="ml-2 font-mono text-xs text-emerald-800">
            cobertura marca {cob.con_marca_pct}% · estilo {cob.con_estilo_pct}%
          </span>
        ) : null}
      </summary>

      <div className="space-y-4 border-t border-emerald-200/60 px-5 pb-5 pt-4">
        <table className="w-full text-xs text-neutral-700">
          <thead>
            <tr className="text-left text-[10px] uppercase text-neutral-500">
              <th className="pb-1 pr-3">Excel / COD.GRUPO</th>
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

        {cob ? (
          <div className="rounded-lg border border-emerald-200 bg-white/80 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-900">
              Cobertura pilares proveedor {preview?.proveedor_id} · {cob.lineas_totales} líneas
            </p>
            <div className="flex flex-wrap gap-3">
              <CoberturaBar label="Marca" pct={cob.con_marca_pct} n={cob.con_marca} tot={cob.lineas_totales} />
              <CoberturaBar label="Género" pct={cob.con_genero_pct} n={cob.con_genero} tot={cob.lineas_totales} />
              <CoberturaBar label="Tipo 1 / AB-CR" pct={cob.con_tipo1_pct} n={cob.con_tipo1} tot={cob.lineas_totales} />
              <CoberturaBar label="Estilo" pct={cob.con_estilo_pct} n={cob.con_estilo} tot={cob.lineas_totales} />
            </div>
          </div>
        ) : null}

        {preview?.color_backfill_gate?.blocked ? (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-950">
            Gate color 638: {preview.color_backfill_gate.message}
          </p>
        ) : null}

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
            <strong className="text-emerald-800">{preview.liquidacion_articulos}</strong> con LIQUIDACIÓN ·
            tipo1: {preview.pendiente_tipo1} · estilo: {preview.pendiente_estilo} · marca sin id:{" "}
            {preview.pendiente_marca}
            {preview.conflictos_label_digito > 0 ? (
              <>
                {" "}
                · <strong className="text-amber-800">{preview.conflictos_label_digito}</strong> conflictos
                label≠dígito (gana dígito)
              </>
            ) : null}
          </p>
        ) : null}

        {applied ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
            OK — género {applied.lineas_genero} · marca {applied.lineas_marca} · L×R {applied.lr_estilo_tipo1}
            · cadena SDRM {applied.cadena_sdrm_actualizada} · AM sync {applied.ppd_am_sync}
            {applied.maestras_tipo1_creadas.length
              ? ` · tipo1 nuevos: ${applied.maestras_tipo1_creadas.join(", ")}`
              : ""}
            {applied.maestras_estilo_creadas.length
              ? ` · estilo nuevos: ${applied.maestras_estilo_creadas.join(", ")}`
              : ""}
          </p>
        ) : null}

        {preview?.muestra?.length ? (
          <div className="overflow-x-auto rounded-lg border border-report-rule">
            <table className="min-w-full text-[10px]">
              <thead className="bg-slate-50 text-left uppercase text-slate-500">
                <tr>
                  <th className="px-2 py-1">Línea</th>
                  <th className="px-2 py-1">COD.GRUPO</th>
                  <th className="px-2 py-1">Marca</th>
                  <th className="px-2 py-1">Género</th>
                  <th className="px-2 py-1">Estilo</th>
                  <th className="px-2 py-1">Tipo 1</th>
                  <th className="px-2 py-1">Cadena</th>
                  <th className="px-2 py-1">Conflictos</th>
                </tr>
              </thead>
              <tbody>
                {preview.muestra.map((m) => (
                  <tr key={m.linea_codigo} className="border-t border-slate-100">
                    <td className="px-2 py-1 font-mono">{m.linea_codigo}</td>
                    <td className="px-2 py-1 font-mono">{m.cod_grupo ?? "—"}</td>
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
                    <td className="px-2 py-1 text-amber-800">
                      {m.conflictos?.length ? m.conflictos.join("; ") : "—"}
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
