import Link from "next/link";
import { NexusHeaderZen } from "@/components/report/NexusHeaderZen";
import { ReportFooter } from "@/components/report/ReportFooter";

const WEB_NAVY = "#1E3A5F";
const WEB_ORANGE = "#F97316";

export type BazzarWebModuleDoc = {
  title: string;
  subtitle: string;
  streamlitKey: string;
  streamlitPath: string;
  docHref: string;
  bullets: string[];
};

export function BazzarWebModuleShell({
  module,
  children,
}: {
  module: BazzarWebModuleDoc;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusHeaderZen />

      <main className="mx-auto max-w-4xl px-6 py-10">
        <nav className="mb-8 text-sm text-neutral-ink-muted">
          <Link href="/" className="hover:text-neutral-ink">Inicio</Link>
          <span className="mx-2">/</span>
          <Link href="/informes/bazzar-web" className="hover:text-neutral-ink">BAZZAR WEB</Link>
          <span className="mx-2">/</span>
          <span className="font-medium text-neutral-ink">{module.title}</span>
        </nav>

        <header
          className="mb-8 rounded-2xl border-2 bg-card-bg p-8 shadow-sm"
          style={{ borderColor: WEB_NAVY }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: WEB_ORANGE }}>
            BAZZAR WEB · Panel operativo
          </p>
          <h1 className="font-serif text-3xl font-light" style={{ color: WEB_NAVY }}>
            {module.title}
          </h1>
          <p className="mt-3 text-neutral-ink-medium leading-relaxed">{module.subtitle}</p>
        </header>

        <section className="mb-8 rounded-xl border border-slate-200 bg-card-bg p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-ink-muted mb-4">
            Migración desde Streamlit
          </h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-neutral-ink-muted">Registry key</dt>
              <dd className="font-mono font-medium">{module.streamlitKey}</dd>
            </div>
            <div>
              <dt className="text-neutral-ink-muted">Paquete Nexus</dt>
              <dd className="font-mono text-xs break-all">{module.streamlitPath}</dd>
            </div>
          </dl>
          <ul className="mt-4 space-y-2 text-sm text-neutral-ink-medium list-disc pl-5">
            {module.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </section>

        {children ?? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-6 py-5 text-sm text-slate-800">
            <p className="font-semibold">UI en construcción</p>
            <p className="mt-1">
              Operación temporal vía Streamlit Nexus hasta completar la migración a Report.
              Documentación técnica en el Anexo Documental.
            </p>
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={module.docHref}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: WEB_NAVY }}
          >
            Ver documentación
          </Link>
          <Link
            href="/informes/bazzar-web"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-ink hover:bg-slate-50"
          >
            Índice BAZZAR WEB
          </Link>
        </div>
      </main>

      <ReportFooter />
    </div>
  );
}
