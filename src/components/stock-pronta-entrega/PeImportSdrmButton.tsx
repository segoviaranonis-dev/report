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
};

type Props = {
  onDone?: () => void;
};

export function PeImportSdrmButton({ onDone }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setResult(null);
    setErr(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const runImport = useCallback(async () => {
    if (!file) {
      setErr("Elegí un CSV sdrm####");
      return;
    }
    const ok = window.confirm(
      "REEMPLAZO TOTAL del stock Pronta Entrega (PPD PE + staging).\n\n¿Importar y migrar a Panel + RIMEC Web?",
    );
    if (!ok) return;

    setLoading(true);
    setErr(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", "replace");
      const r = await fetch("/api/stock-pronta-entrega/import-csv", { method: "POST", body: fd });
      const j = (await r.json()) as ImportResult;
      if (!r.ok || !j.ok) throw new Error(j.error ?? "Error al importar");
      setResult(j);
      onDone?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
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
              Pipeline: staging → pilares FK → PPD · paridad Panel Alejandro Magno + :3001
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
            {err ? <p className="mt-2 text-sm text-red-600">{err}</p> : null}
            {result?.resumen ? (
              <dl className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-xs">
                <div>
                  <dt className="text-slate-500">Batch</dt>
                  <dd className="font-mono font-bold">{result.resumen.batch_label}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Saldo total</dt>
                  <dd className="font-bold tabular-nums">{result.resumen.uds_total.toLocaleString("es-PY")} p</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Calzado</dt>
                  <dd className="tabular-nums">{result.resumen.calzado.pares_saldo.toLocaleString("es-PY")} p</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Confecciones</dt>
                  <dd className="tabular-nums">{result.resumen.confecciones.pares_saldo.toLocaleString("es-PY")} p</dd>
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
                disabled={loading || !file}
                onClick={() => void runImport()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {loading ? "Importando…" : "Importar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
