"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyCostosSiameseFiltros,
  EMPTY_COSTOS_SIAMESE,
  opcionesSiameseCostos,
  type CostosSiameseFiltros,
} from "@/lib/costos-rimec-isla/costos-siamese-filtros";
import {
  agregarPorCodigo,
  calcFilaMargen,
  cmpCostosTxtLineaAsc,
  totalesMargen,
} from "@/lib/costos-rimec-isla/margen-calculo";
import { buildArchivoFromTxt } from "@/lib/costos-rimec-isla/parse-ifstgp4-txt";
import type {
  CostosDepositoSlot,
  CostosSimulacion,
  CostosTxtArchivo,
} from "@/lib/costos-rimec-isla/types";
import { COSTOS_DEPOSITOS, LISTA_COSTOS_TIERS } from "@/lib/costos-rimec-isla/types";
import { CostosFilaMargen } from "./costos-isla/CostosFilaMargen";
import { CostosIslaControles } from "./costos-isla/CostosIslaControles";
import { CostosSiameseSidebar } from "./costos-isla/CostosSiameseSidebar";

async function readTxtFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder("latin1").decode(buf);
  } catch {
    return new TextDecoder().decode(buf);
  }
}

const SIM_INICIAL: CostosSimulacion = {
  listaTier: "LPC03",
  descuento1: 4,
  descuento2: 50,
  descuento3: 0,
  descuento4: 0,
  cotizUsd: 7500,
  baseCosto: "dls",
};

const FILTROS_INICIAL: CostosSiameseFiltros = EMPTY_COSTOS_SIAMESE;

export function TabCostosPe() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [archivos, setArchivos] = useState<CostosTxtArchivo[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sim, setSim] = useState<CostosSimulacion>(SIM_INICIAL);
  const [filtros, setFiltros] = useState<CostosSiameseFiltros>(FILTROS_INICIAL);
  const [depositosSel, setDepositosSel] = useState<Set<CostosDepositoSlot>>(
    () => new Set(COSTOS_DEPOSITOS.map((d) => d.slot)),
  );

  const aplicarArchivos = useCallback((parsed: CostosTxtArchivo[]) => {
    setArchivos(parsed);
    const slots = new Set<CostosDepositoSlot>();
    for (const a of parsed) {
      if (a.depositoSlot) slots.add(a.depositoSlot);
    }
    if (slots.size) setDepositosSel(slots);
  }, []);

  const onPick = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      setBusy(true);
      setErr(null);
      try {
        const parsed: CostosTxtArchivo[] = [];
        for (const f of [...files]) {
          if (!/\.txt$/i.test(f.name)) throw new Error(`Solo TXT ifstgp4 · ${f.name}`);
          parsed.push(buildArchivoFromTxt(f.name, await readTxtFile(f)));
        }
        aplicarArchivos(parsed);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Error TXT");
        setArchivos([]);
      } finally {
        setBusy(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [aplicarArchivos],
  );

  const cargarLabHector = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/costos-rimec/lab-hector", {
        cache: "no-store",
        signal: AbortSignal.timeout(180_000),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        error?: string;
        archivos?: CostosTxtArchivo[];
      };
      if (!res.ok || !j.ok || !j.archivos?.length) {
        throw new Error(
          j.error ??
            (res.status === 403
              ? "RIMEC Admin requerido (rol_id=1) para lab TXT"
              : `HTTP ${res.status}`),
        );
      }
      aplicarArchivos(j.archivos);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error lab TXT");
      setArchivos([]);
    } finally {
      setBusy(false);
    }
  }, [aplicarArchivos]);

  useEffect(() => {
    if (archivos.length === 0 && !busy) void cargarLabHector();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- carga lab al entrar

  const lineasDep = useMemo(() => {
    const out = archivos.flatMap((a) => {
      if (!a.depositoSlot || !depositosSel.has(a.depositoSlot)) return [];
      return a.lineas;
    });
    return agregarPorCodigo(out);
  }, [archivos, depositosSel]);

  const lineasFiltradas = useMemo(
    () => applyCostosSiameseFiltros(lineasDep, filtros).sort(cmpCostosTxtLineaAsc),
    [lineasDep, filtros],
  );

  const filasMargen = useMemo(
    () => lineasFiltradas.map((l) => calcFilaMargen(l, sim)),
    [lineasFiltradas, sim],
  );

  const tot = useMemo(() => totalesMargen(filasMargen), [filasMargen]);
  const opcionesSiamese = useMemo(
    () => opcionesSiameseCostos(lineasDep, filtros),
    [lineasDep, filtros],
  );
  const listaLabel = LISTA_COSTOS_TIERS.find((t) => t.id === sim.listaTier)?.label ?? sim.listaTier;

  const toggleDep = (d: CostosDepositoSlot) => {
    setDepositosSel((prev) => {
      const n = new Set(prev);
      if (n.has(d)) n.delete(d);
      else n.add(d);
      return n;
    });
  };

  return (
    <div className="space-y-4 pb-8">
      <div className="rounded-2xl border-2 border-emerald-700/25 bg-emerald-50 px-4 py-3">
        <h2 className="text-base font-bold text-emerald-950">COSTOS · isla TXT Carlos</h2>
        <p className="mt-1 text-xs leading-relaxed text-emerald-950/85">
          Caso Graciela: cliente pide descuento sobre LPC03/LPC04 — ¿queda por encima del costo?
          Fuente <strong>solo TXT lento ifstgp4</strong> · el CSV SDRM rápido no entra acá.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".txt"
          multiple
          className="hidden"
          onChange={(e) => void onPick(e.target.files)}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60"
        >
          {busy ? "Leyendo…" : "Importar TXT ifstgp4 (2–4)"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void cargarLabHector()}
          className="rounded-xl border-2 border-emerald-700 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50 disabled:opacity-60"
        >
          {busy ? "Leyendo ~11k artículos…" : "Lab Héctor · D1+D3"}
        </button>
        {archivos.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              setArchivos([]);
              setErr(null);
            }}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-600"
          >
            Vaciar
          </button>
        ) : null}
      </div>

      {err ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {err}
        </div>
      ) : null}

      {archivos.length > 0 ? (
        <>
          <CostosIslaControles
            sim={sim}
            onSimChange={(p) => setSim((s) => ({ ...s, ...p }))}
            depositosSel={depositosSel}
            onDepositoToggle={toggleDep}
          />

          <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-start">
            <div className="w-full shrink-0 self-start lg:sticky lg:top-2 lg:w-auto">
              <CostosSiameseSidebar
                filtros={filtros}
                onChange={setFiltros}
                opciones={opcionesSiamese}
              />
            </div>

            <div className="min-w-0 flex-1 space-y-3">
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 sm:grid-cols-4">
            <div>
              <p className="text-[9px] font-bold uppercase text-emerald-800">SKUs filtrados</p>
              <p className="text-lg font-black tabular-nums">{filasMargen.length}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase text-emerald-800">Pares</p>
              <p className="text-lg font-black tabular-nums">
                {Math.round(tot.pares).toLocaleString("es-PY")}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase text-emerald-800">Prom. desc. extra máx.</p>
              <p
                className={`text-lg font-black tabular-nums ${
                  tot.promedioDescExtraMax >= 0 ? "text-amber-900" : "text-red-700"
                }`}
                title="Promedio del colchón de descuento extra sobre LP c/desc"
              >
                {tot.promedioDescExtraMax >= 0 ? "hasta −" : ""}
                {Math.abs(tot.promedioDescExtraMax).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase text-emerald-800">
                Prom. Gs/par ÷ {listaLabel}
              </p>
              <p
                className={`text-lg font-black tabular-nums ${
                  tot.promedioGsParSobreLista >= 0 ? "text-rimec-azul" : "text-red-700"
                }`}
              >
                {tot.promedioGsParSobreLista >= 0 ? "+" : ""}
                {tot.promedioGsParSobreLista.toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {filasMargen.slice(0, 200).map((f) => (
              <CostosFilaMargen key={f.linea.codigo} fila={f} listaLabel={listaLabel} />
            ))}
            {filasMargen.length > 200 ? (
              <p className="text-center text-xs text-slate-500">
                Mostrando 200 / {filasMargen.length} — acotá filtros siameses (ej. Marca BEIRA RIO).
              </p>
            ) : null}
            {filasMargen.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500">
                Sin filas · ajustá depósitos o filtros siameses.
              </p>
            ) : null}
          </div>
            </div>
          </div>
        </>
      ) : busy ? (
        <div className="rounded-2xl border-2 border-dashed border-emerald-300 py-14 text-center text-sm text-emerald-800">
          <p>Cargando lab COSTOS · D1+D3…</p>
          <p className="mt-2 text-xs text-emerald-700">~8.6k SKUs · snapshot empaquetado</p>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 py-14 text-center text-sm text-slate-600">
          <p>Cargá TXT Carlos o botón <strong>Lab Héctor · D1+D3</strong></p>
          <p className="mt-2 text-xs text-slate-500">
            23980722.txt (S00_D1) · 23956181.txt (S00_D3)
          </p>
        </div>
      )}
    </div>
  );
}
