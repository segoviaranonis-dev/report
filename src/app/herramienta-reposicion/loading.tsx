import { RimecCargandoPantalla } from "@/components/report/RimecCargandoPantalla";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";

/** NIIF-NAV-LAT-500 · entrada Alejandro Magno */
export default function HerramientaReposicionLoading() {
  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusGlobalHeader active="home" />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rimec-azul">
          Alejandro Magno · culminación · 2.3.1.20
        </p>
        <h1 className="mt-1 font-serif text-3xl font-bold text-rimec-azul-dark sm:text-4xl">
          Herramienta de reposición!!!
        </h1>
        <RimecCargandoPantalla
          className="mt-8"
          mensaje="Abriendo Alejandro Magno…"
          subtitulo="Aguarde unos segundos, por favor."
          etapas={[
            "Leyendo stock Pronta Entrega…",
            "Combinando CP y programado…",
            "Calculando niveles N1 · N2 · N3…",
            "Preparando tarjetas de reposición…",
          ]}
        />
      </main>
      <ReportFooter note="Herramienta de reposición · Alejandro Magno" />
    </div>
  );
}
