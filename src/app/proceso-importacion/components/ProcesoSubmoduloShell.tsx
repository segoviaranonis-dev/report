"use client";

import Link from "next/link";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import { PROCESO_IMPORTACION } from "@/lib/report/routes";

type Props = {
  code: string;
  codeProceso: string;
  title: string;
  description: string;
  streamlitRef: string;
  footerNote: string;
};

export function ProcesoSubmoduloShell({
  code,
  codeProceso,
  title,
  description,
  streamlitRef,
  footerNote,
}: Props) {
  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusGlobalHeader active="proceso-importacion" />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link href={PROCESO_IMPORTACION} className="text-sm font-semibold text-rimec-azul hover:underline">
          ← Proceso de importación
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-rimec-azul/70">
          {code} · {codeProceso}
        </p>
        <h1 className="mt-2 font-serif text-3xl text-rimec-azul-dark">{title}</h1>
        <p className="mt-3 text-neutral-700">{description}</p>

        <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
          <strong>En construcción.</strong> Paridad Streamlit:{" "}
          <code className="text-xs">{streamlitRef}</code>
        </div>
      </main>
      <ReportFooter note={footerNote} />
    </div>
  );
}
