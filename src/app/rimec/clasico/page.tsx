import Link from "next/link";
import {
  RIMEC_INFORME_VENTAS_OCHO_TABLAS,
  RIMEC_VISTA_PIVOT,
} from "@/modules/sales-report/constants";
import { ReportFooter } from "@/components/report/ReportFooter";
import { RimecClient } from "../RimecClient";

export default function RimecClasicoPage() {
  return (
    <div className="min-h-screen bg-exec-canvas text-exec-ink">
      <header className="border-b border-exec-line bg-exec-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-6 px-4 py-8 sm:px-6">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-exec-subtle">RIMEC</p>
            <h1 className="font-serif text-2xl font-light tracking-tight sm:text-3xl">Informe de ventas (clásico)</h1>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-medium uppercase tracking-[0.12em] text-exec-muted">
            <Link href="/" className="border-b border-transparent pb-0.5 transition hover:border-exec-ink hover:text-exec-ink">
              Portada
            </Link>
            <Link
              href="/rimec"
              className="border-b border-transparent pb-0.5 transition hover:border-exec-ink hover:text-exec-ink"
            >
              Inmersivo
            </Link>
            <Link
              href="/retail"
              className="border-b border-transparent pb-0.5 transition hover:border-exec-ink hover:text-exec-ink"
            >
              Stock / Retail
            </Link>
            <Link
              href="/informes"
              className="border-b border-transparent pb-0.5 transition hover:border-exec-ink hover:text-exec-ink"
            >
              Anexo PE
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-4 py-10 font-sans sm:px-6">
        <div className="max-w-2xl space-y-4 print:hidden">
          <p className="text-[13px] font-light leading-relaxed text-exec-muted">
            <strong className="text-exec-ink">Sales Report web v1</strong> (snapshot + dashboard inmersivo) es la vista principal en{" "}
            <Link href="/rimec" className="font-medium text-exec-ink underline-offset-2 hover:underline">
              /rimec
            </Link>
            . Esta página conserva el layout clásico de <strong className="text-exec-ink">ocho tablas</strong> al estilo Streamlit, con PDF y ampliación de
            paneles.
          </p>
        </div>

        <RimecClient />

        <details className="group border border-exec-line bg-exec-surface print:hidden">
          <summary className="cursor-pointer px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-exec-subtle transition marker:text-exec-muted group-open:bg-exec-canvas">
            Referencia técnica — vista y tablas
          </summary>
          <div className="border-t border-exec-line px-5 py-5 text-[13px] leading-relaxed text-exec-muted">
            <p>
              Vista principal:{" "}
              <code className="font-mono text-[12px] text-exec-ink">{RIMEC_VISTA_PIVOT}</code>. Tablas físicas:
            </p>
            <ul className="mt-3 grid list-inside list-disc gap-1.5 sm:grid-cols-2">
              {RIMEC_INFORME_VENTAS_OCHO_TABLAS.map((name) => (
                <li key={name}>
                  <code className="font-mono text-[11px] text-exec-ink">{name}</code>
                </li>
              ))}
            </ul>
          </div>
        </details>
      </main>

      <ReportFooter
        variant="exec"
        note="RIMEC — Informe de ventas: lectura gerencial sobre datos corporativos; la conexión se configura solo en servidor."
      />
    </div>
  );
}
