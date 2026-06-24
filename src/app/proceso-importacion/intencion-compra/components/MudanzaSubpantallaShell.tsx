import Link from "next/link";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import { INTENCION_COMPRA } from "@/lib/report/routes";

type Props = { code: string; title: string; streamlit: string };

export function MudanzaSubpantallaShell({ code, title, streamlit }: Props) {
  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusGlobalHeader active="proceso-importacion" />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link href={INTENCION_COMPRA} className="text-sm font-semibold text-rimec-azul hover:underline">
          ← Intención de compra
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-rimec-azul/70">{code}</p>
        <h1 className="mt-2 font-serif text-3xl text-rimec-azul-dark">{title}</h1>
        <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
          <strong>Mudanza en curso.</strong> Implementar paridad <code>{streamlit}</code> — ver CHUSAR 2.3.1.7.3.
        </div>
      </main>
      <ReportFooter note={`${title} · ${code}`} />
    </div>
  );
}
