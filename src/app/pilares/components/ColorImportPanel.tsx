"use client";

import { useRef, useState } from "react";
import { readJsonResponse } from "@/lib/fetch-json";
import { POLITICA_IDIOMA_COLOR } from "@/lib/pilares/import-color-xlsx";

type ImportResult = {
  parsed: number;
  inserted: number;
  updated: number;
  skipped_empty: number;
  tono_suggested?: number;
  errors?: string[];
};

export function ColorImportPanel({
  tipoV2Id,
  onDone,
}: {
  tipoV2Id: number;
  onDone: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [suggestTono, setSuggestTono] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onImport() {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError("Elegí un archivo .xlsx (COLOR CODE + COLOR).");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.set("tipo_v2_id", String(tipoV2Id));
      fd.set("file", file);
      if (suggestTono) fd.set("suggest_tono", "1");
      const r = await fetch("/api/pilares/color/import", { method: "POST", body: fd });
      const data = await readJsonResponse<ImportResult & { ok?: boolean; error?: string }>(r);
      if (!r.ok || !data.ok) throw new Error(data.error || "Import falló");
      setResult(data);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="mb-6 rounded-xl border-2 border-amber-200/80 bg-amber-50/60">
      <summary className="cursor-pointer list-none px-5 py-4 marker:content-none">
        <span className="font-serif text-lg font-semibold text-rimec-azul-dark">
          Importar listado proveedor · descripciones
        </span>
      </summary>
      <div className="space-y-4 border-t border-amber-200/60 px-5 pb-5 pt-4 text-sm text-neutral-700">
        <div className="rounded-lg border border-amber-200 bg-white/80 p-4">
          <p className="font-semibold text-rimec-azul-dark">{POLITICA_IDIOMA_COLOR.titulo}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>{POLITICA_IDIOMA_COLOR.proveedor}</li>
            <li>{POLITICA_IDIOMA_COLOR.operacion}</li>
            <li>{POLITICA_IDIOMA_COLOR.regla}</li>
          </ul>
        </div>

        <p>
          Formato Beira Rio (654): columnas <strong>COLOR CODE</strong> + <strong>COLOR</strong>. Los códigos que no
          vengan en el Excel siguen sin descripción (alta ciega retail).
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-xs font-bold uppercase text-neutral-500">Archivo .xlsx</span>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="mt-1 block w-full max-w-md text-sm"
            />
          </label>
          <label className="flex items-center gap-2 pb-1 text-sm">
            <input type="checkbox" checked={suggestTono} onChange={(e) => setSuggestTono(e.target.checked)} />
            Sugerir tono_canon (español) tras import
          </label>
          <button
            type="button"
            onClick={onImport}
            disabled={busy}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Importando…" : "Importar"}
          </button>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-800">{error}</p>}
        {result && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-900">
            {result.parsed} filas · {result.inserted} nuevos · {result.updated} sync · omitidas vacías{" "}
            {result.skipped_empty}
            {result.tono_suggested != null && result.tono_suggested > 0
              ? ` · ${result.tono_suggested} tono_canon sugeridos`
              : ""}
          </p>
        )}
      </div>
    </details>
  );
}
