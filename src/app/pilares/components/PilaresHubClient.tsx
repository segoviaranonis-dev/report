"use client";

import Link from "next/link";
import { useState } from "react";
import { TIPO_V2_LABELS } from "@/lib/pilares/constants";
import type { TipoV2Id } from "@/lib/pilares/types";

export function PilaresHubClient() {
  const [tipoV2Id, setTipoV2Id] = useState<TipoV2Id>(1);
  const qs = `?tipo_v2_id=${tipoV2Id}`;

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-rimec-azul-dark">Tipo catálogo:</span>
        {([1, 2] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTipoV2Id(id)}
            className={`rounded-lg border-2 px-4 py-2 text-sm font-semibold transition-all ${
              tipoV2Id === id
                ? "border-rimec-azul bg-rimec-azul text-white shadow-md"
                : "border-rimec-azul/25 bg-card-bg text-rimec-azul hover:border-rimec-azul/50"
            }`}
          >
            {TIPO_V2_LABELS[id]}
          </button>
        ))}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Link
          href={`/pilares/lineas${qs}`}
          className="group block rounded-2xl border-2 border-rimec-azul/20 bg-card-bg p-8 shadow-sm transition-all hover:-translate-y-1 hover:border-rimec-azul hover:shadow-lg"
        >
          <div className="mb-4 text-4xl">📋</div>
          <h2 className="font-serif text-2xl font-semibold text-rimec-azul-dark group-hover:text-rimec-azul">
            Administrador de Líneas
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-neutral-700">
            Tabla <code className="text-xs">linea</code> — marca y género por código de proveedor.
            Conexión directa a BD vía <code className="text-xs">DATABASE_URL</code>.
          </p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-rimec-azul/70">
            {TIPO_V2_LABELS[tipoV2Id]}
          </p>
        </Link>

        <Link
          href={`/pilares/linea-referencia${qs}`}
          className="group block rounded-2xl border-2 border-rimec-azul/20 bg-card-bg p-8 shadow-sm transition-all hover:-translate-y-1 hover:border-rimec-azul hover:shadow-lg"
        >
          <div className="mb-4 text-4xl">🔗</div>
          <h2 className="font-serif text-2xl font-semibold text-rimec-azul-dark group-hover:text-rimec-azul">
            Administrador de Línea × Referencia
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-neutral-700">
            Tabla <code className="text-xs">linea_referencia</code> — estilo y tipo 1 por par L×R.
            Confecciones: filas con ref <code className="text-xs">K</code>.
          </p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-rimec-azul/70">
            {TIPO_V2_LABELS[tipoV2Id]}
          </p>
        </Link>

        <Link
          href={`/pilares/color${qs}`}
          className="group block rounded-2xl border-2 border-orange-400/40 bg-card-bg p-8 shadow-sm transition-all hover:-translate-y-1 hover:border-orange-500 hover:shadow-lg sm:col-span-2"
        >
          <div className="mb-4 flex gap-2">
            <span className="inline-block h-8 w-8 rounded-full bg-neutral-900 shadow-inner" />
            <span className="inline-block h-8 w-8 rounded-full bg-white shadow-inner ring-1 ring-neutral-200" />
            <span className="inline-block h-8 w-8 rounded-full bg-sky-500 shadow-inner" />
            <span className="inline-block h-8 w-8 rounded-full bg-amber-200 shadow-inner" />
          </div>
          <h2 className="font-serif text-2xl font-semibold text-rimec-azul-dark group-hover:text-rimec-azul">
            Administrador de Color · tono_canon
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-neutral-700">
            Pilar <code className="text-xs">color</code> — etiqueta + tono hex/paleta. Única verdad para filtros
            (círculos catálogo). Predominante desde <code className="text-xs">nombre</code> antes de / o -.
          </p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-orange-600">
            Etapa 2.3.5.3 · 🟢 abierta
          </p>
        </Link>
      </div>
    </>
  );
}
