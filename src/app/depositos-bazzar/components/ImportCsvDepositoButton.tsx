"use client";

import { useCallback, useRef, useState } from "react";
import type { ImportCsvBatchResult, ImportCsvMode } from "@/lib/depositos/bazzar-csv-import-types";

type Props = {
  /** Hub: hasta 3 CSV · detalle: 1 ente */
  maxFiles?: number;
  label?: string;
  compact?: boolean;
  onDone?: () => void;
};

const PREFIX_HINT = "sdfm####.csv · sdsm####.csv · sdpl####.csv";

export function ImportCsvDepositoButton({
  maxFiles = 3,
  label = "Importar CSV",
  compact = false,
  onDone,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<ImportCsvMode>("replace");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportCsvBatchResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const reset = () => {
    setFiles([]);
    setResult(null);
    setErr(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onPick = (list: FileList | null) => {
    if (!list?.length) return;
    const picked = Array.from(list).slice(0, maxFiles);
    setFiles(picked);
    setResult(null);
    setErr(null);
  };

  const runImport = useCallback(async () => {
    if (!files.length) {
      setErr("Elegí al menos un CSV");
      return;
    }
    if (mode === "replace") {
      const ok = window.confirm(
        "REEMPLAZO TOTAL: se borrará todo el stock de las tablas afectadas por estos CSV y se cargará solo lo del archivo.\n\n¿Continuar?",
      );
      if (!ok) return;
    }

    setLoading(true);
    setErr(null);
    setResult(null);

    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      fd.append("mode", mode);
      if (mode === "replace") fd.append("confirm_replace", "1");

      const r = await fetch("/api/depositos/import-csv", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Error al importar");

      setResult(j as ImportCsvBatchResult);
      onDone?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [files, mode, onDone]);

  const totalInsert =
    result?.files.reduce(
      (s, f) => s + f.tablas.reduce((t, tb) => t + tb.inserted + tb.updated, 0),
      0,
    ) ?? 0;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className={
          compact
            ? "rounded-lg bg-bazzar-naranja px-4 py-2 text-sm font-bold text-white hover:opacity-90"
            : "rounded-lg border-2 border-bazzar-naranja bg-white px-4 py-1.5 text-sm font-bold text-bazzar-naranja hover:bg-bazzar-fondo"
        }
      >
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-report-rule bg-white p-5 shadow-xl"
            role="dialog"
            aria-labelledby="import-csv-title"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="import-csv-title" className="font-serif text-lg font-bold">
                  Importar stock CSV
                </h2>
                <p className="mt-1 text-xs text-report-muted">
                  Ciclo Bazzar · sin Retail · origen <code className="text-[10px]">BAZZAR_CSV</code>
                </p>
              </div>
              <button
                type="button"
                className="text-report-muted hover:text-report-ink"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs font-bold uppercase text-report-muted">Archivos</p>
                <p className="text-[11px] text-report-muted">{PREFIX_HINT}</p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,.txt"
                  multiple={maxFiles > 1}
                  className="mt-2 w-full text-sm"
                  onChange={(e) => onPick(e.target.files)}
                />
                {files.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs">
                    {files.map((f) => (
                      <li key={f.name} className="font-mono text-bazzar-naranja-dark">
                        {f.name} ({Math.round(f.size / 1024)} KB)
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <fieldset className="space-y-2">
                <legend className="text-xs font-bold uppercase text-report-muted">Modo</legend>
                <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-report-rule p-3 has-[:checked]:border-bazzar-naranja has-[:checked]:bg-orange-50/50">
                  <input
                    type="radio"
                    name="import-mode"
                    checked={mode === "replace"}
                    onChange={() => setMode("replace")}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-semibold">Reemplazar total</span>
                    <span className="text-xs text-report-muted">
                      Borra <strong>todo</strong> el stock de cada tabla destino y carga solo el CSV.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-report-rule p-3 has-[:checked]:border-rimec-azul has-[:checked]:bg-slate-50">
                  <input
                    type="radio"
                    name="import-mode"
                    checked={mode === "merge"}
                    onChange={() => setMode("merge")}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-semibold">Agregar (sumar)</span>
                    <span className="text-xs text-report-muted">
                      Suma unidades sobre moléculas existentes; filas nuevas se insertan.
                    </span>
                  </span>
                </label>
              </fieldset>

              {err && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {err}
                </p>
              )}

              {result && (
                <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900 space-y-2">
                  <p className="font-semibold">
                    {result.dry_run ? "Simulación OK" : "Importación OK"} · {totalInsert} filas
                    procesadas · {(result.duracion_ms / 1000).toFixed(1)}s total
                  </p>
                  {result.timing && (
                    <p className="text-xs text-green-800">
                      Pilares {(result.timing.pilares_ms / 1000).toFixed(1)}s · Depósito{" "}
                      {(result.timing.deposito_ms / 1000).toFixed(1)}s
                    </p>
                  )}
                  {result.files.map((f) => (
                    <div key={f.filename} className="text-xs">
                      <p className="font-mono font-bold">{f.filename}</p>
                      {f.error ? (
                        <p className="text-red-700">{f.error}</p>
                      ) : (
                        <p>
                          {f.ente} · calzado {f.stats.calzado} uds · conf. {f.stats.confecciones} uds
                        </p>
                      )}
                      {f.tablas.map((t) => (
                        <p key={t.tabla} className="text-report-muted">
                          {t.tabla}: {mode === "replace" && t.deleted >= 0 ? `del ${t.deleted} · ` : ""}
                          ins {t.inserted}
                          {t.updated ? ` · +${t.updated} sumadas` : ""}
                          {t.fk_miss ? ` · FK miss ${t.fk_miss}` : ""}
                          {t.pilares ? (
                            <>
                              {" "}
                              · pilares +{t.pilares.lineas}L +{t.pilares.referencias}R +{t.pilares.materiales}M
                              +{t.pilares.colores}C +{t.pilares.linea_referencia}LR
                            </>
                          ) : null}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  disabled={loading || !files.length}
                  onClick={runImport}
                  className="flex-1 rounded-lg bg-bazzar-naranja px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {loading ? "Importando…" : mode === "replace" ? "Reemplazar e importar" : "Agregar stock"}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-report-rule px-4 py-2.5 text-sm font-semibold"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
