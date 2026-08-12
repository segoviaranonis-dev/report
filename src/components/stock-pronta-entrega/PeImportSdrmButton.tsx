"use client";

import { useCallback, useRef, useState } from "react";
import { SDRM_FILENAME_REGEX } from "@/lib/deposito-rimec/rimec-csv-sdrm";

type ImportResult = {
  ok: boolean;
  batch?: string;
  resumen?: {
    batch_label: string;
    uds_total: number;
    uds_inicial: number;
    skus: number;
    monto_gs: number;
    calzado: { pares_saldo: number; skus: number; monto_gs: number };
    confecciones: { pares_saldo: number; skus: number; monto_gs: number };
  };
  stdout?: string;
  error?: string;
  filas_expandidas?: number;
  fk_miss?: number;
  ppd_inserted?: number;
};

type Props = {
  onDone?: () => void;
};

export function PeImportSdrmButton({ onDone }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setResult(null);
    setErr(null);
    setElapsedSec(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  const runImport = useCallback(async () => {
    if (!file) {
      setErr("Elegí un CSV sdrm####");
      return;
    }
    if (!SDRM_FILENAME_REGEX.test(file.name)) {
      setErr("Nombre inválido — usar sdrm####.csv");
      return;
    }
    const ok = window.confirm(
      "REEMPLAZO TOTAL del stock Pronta Entrega (PPD PE + staging).\n\n¿Importar y migrar a Panel + RIMEC Web?",
    );
    if (!ok) return;

    setLoading(true);
    setErr(null);
    setResult(null);
    setElapsedSec(0);
    const t0 = Date.now();
    const tick = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - t0) / 1000));
    }, 250);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", "replace");

      const r = await fetch("/api/stock-pronta-entrega/import-csv", {
        method: "POST",
        body: fd,
        signal: AbortSignal.timeout(280_000),
      });

      let j: ImportResult;
      try {
        j = (await r.json()) as ImportResult;
      } catch {
        throw new Error(
          r.status === 413
            ? "Archivo demasiado grande para el servidor (límite body). Avisá a sistemas."
            : `Respuesta inválida del servidor (HTTP ${r.status}). Probá de nuevo.`,
        );
      }

      if (!r.ok || !j.ok) {
        throw new Error(j.error ?? `Error al importar (HTTP ${r.status})`);
      }

      setResult(j);
      // Refresco liviano: el panel pesa; el usuario ya ve el resumen aquí.
      onDone?.();
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.name === "TimeoutError" || e.name === "AbortError"
            ? "Timeout (>4 min). El CSV es muy grande o la BD está lenta — reintentá."
            : e.message
          : "Error";
      setErr(msg);
    } finally {
      window.clearInterval(tick);
      setElapsedSec(Math.floor((Date.now() - t0) / 1000));
      setLoading(false);
    }
  }, [file, onDone]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          reset();
        }}
        className="rounded-lg border border-emerald-600 bg-emerald-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-emerald-800 hover:bg-emerald-600 hover:text-white"
      >
        Importar CSV sdrm
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="font-serif text-lg font-semibold text-slate-900">Import Pronta Entrega</h2>
            <p className="mt-1 text-xs text-slate-600">
              Pipeline Node: staging → pilares FK → PPD + DPE (COD.GRUPO) · Panel AM + RIMEC Web
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Mismo motor que el servidor (~15–30 s típico). No hace falta agente.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.txt"
              className="mt-4 block w-full text-sm"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                setErr(f && !SDRM_FILENAME_REGEX.test(f.name) ? "Usar sdrm####.csv" : null);
              }}
            />
            {file ? (
              <p className="mt-1 text-[11px] text-slate-500">
                {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            ) : null}
            {err ? <p className="mt-2 text-sm text-red-600">{err}</p> : null}
            {loading ? (
              <p className="mt-3 text-sm font-medium text-emerald-800">
                Importando… {elapsedSec}s (esperá; no cierres)
              </p>
            ) : null}
            {result?.ok ? (
              <dl className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-xs">
                <div>
                  <dt className="text-slate-500">Batch</dt>
                  <dd className="font-mono font-bold">
                    {result.resumen?.batch_label ?? result.batch ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Tiempo</dt>
                  <dd className="font-bold tabular-nums">{elapsedSec}s</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Saldo total</dt>
                  <dd className="font-bold tabular-nums">
                    {(result.resumen?.uds_total ?? 0).toLocaleString("es-PY")} p
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">FK miss</dt>
                  <dd className="tabular-nums">{result.fk_miss ?? 0}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Calzado</dt>
                  <dd className="tabular-nums">
                    {(result.resumen?.calzado.pares_saldo ?? 0).toLocaleString("es-PY")} p
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Confecciones</dt>
                  <dd className="tabular-nums">
                    {(result.resumen?.confecciones.pares_saldo ?? 0).toLocaleString("es-PY")} p
                  </dd>
                </div>
              </dl>
            ) : null}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                onClick={() => setOpen(false)}
              >
                Cerrar
              </button>
              <button
                type="button"
                disabled={loading || !file || !!result?.ok}
                onClick={() => void runImport()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {loading ? `Importando… ${elapsedSec}s` : result?.ok ? "Listo" : "Importar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
