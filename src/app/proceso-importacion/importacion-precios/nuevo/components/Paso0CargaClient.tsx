"use client";

import Link from "next/link";
import { useState } from "react";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import { MOTOR_PROVEEDOR_DEFAULT } from "@/lib/motor-precios/constants";
import {
  IMPORTACION_PRECIOS,
  PROCESO_IMPORTACION,
} from "@/lib/report/routes";
import { ImportacionPreciosProgressBar } from "../../components/ImportacionPreciosProgressBar";

/** Texto resumido ley de género — paridad Streamlit expander */
const LEY_GENERO_RESUMEN = `Cada hoja/marca del Excel debe mapear a un género canónico (DAMAS, NIÑAS, NIÑOS, CABALLEROS).
BEIRA RIO, VIZZANO, MODARE, MOLECA → DAMAS · MOLEKINHA → NIÑAS · MOLEKINHO → NIÑOS · BR SPORT → CABALLEROS.
Si una marca no encaja, la importación se detiene antes de crear el evento.`;

export function Paso0CargaClient() {
  const [leyAbierta, setLeyAbierta] = useState(false);
  const [nombreEvento, setNombreEvento] = useState("");
  const [fechaDesde, setFechaDesde] = useState(() => new Date().toISOString().slice(0, 10));

  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusGlobalHeader active="proceso-importacion" />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link href={IMPORTACION_PRECIOS} className="text-sm font-semibold text-rimec-azul hover:underline">
          ← Importación de precios
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-rimec-azul/70">
          2.3.1.7.2.0 · Nuevo evento · Paso 0
        </p>
        <h1 className="mt-2 font-serif text-3xl text-rimec-azul-dark">Carga del archivo</h1>

        <div className="mt-6">
          <ImportacionPreciosProgressBar pasoActivo={0} />
        </div>

        <div className="mt-8 rounded-xl border border-slate-200 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setLeyAbierta((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-rimec-azul-dark hover:bg-slate-50"
          >
            Ley de género (obligatoria en cada importación)
            <span className="text-slate-400">{leyAbierta ? "▲" : "▼"}</span>
          </button>
          {leyAbierta && (
            <div className="border-t border-slate-100 px-4 py-3 text-sm text-slate-700">{LEY_GENERO_RESUMEN}</div>
          )}
        </div>

        <form
          className="mt-6 space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          onSubmit={(e) => e.preventDefault()}
        >
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Proveedor *</label>
            <select
              disabled
              className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600"
              defaultValue={String(MOTOR_PROVEEDOR_DEFAULT)}
            >
              <option value={MOTOR_PROVEEDOR_DEFAULT}>BEIRA RIO CALZADOS (carga proveedores — API mañana)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Archivo del proveedor *
            </label>
            <div className="mt-1 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
              <p className="text-sm font-medium text-slate-600">Arrastrá o elegí el Excel</p>
              <p className="mt-1 text-xs text-slate-500">Límite 200 MB · .xls, .xlsx</p>
              <input type="file" disabled accept=".xls,.xlsx" className="mt-4 text-xs text-slate-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Nombre del evento *</label>
            <input
              value={nombreEvento}
              onChange={(e) => setNombreEvento(e.target.value)}
              placeholder="Ej: TEMPORADA_INVIERNO_2026"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Precios vigentes desde *
            </label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <strong>Tránsito CHUSAR 2.3.1.7.2.</strong> UI alineada a Streamlit Paso 0. API{" "}
            <code className="text-xs">POST /api/motor-precios/eventos/carga</code> — implementación siguiente sesión.
            Doc: <code className="text-xs">PASO0_CARGA_EXCEL.md</code>
          </div>

          <button
            type="button"
            disabled
            className="w-full rounded-lg bg-rimec-azul/40 px-4 py-3 text-sm font-bold text-white cursor-not-allowed"
          >
            Iniciar carga (pendiente API)
          </button>
        </form>

        <Link href={PROCESO_IMPORTACION} className="mt-8 inline-block text-sm font-semibold text-rimec-azul hover:underline">
          ← Proceso de importación
        </Link>
      </main>
      <ReportFooter note="Importación precios · Paso 0 · 2.3.1.7.2" />
    </div>
  );
}
