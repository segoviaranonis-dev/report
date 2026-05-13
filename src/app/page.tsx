import Image from "next/image";
import Link from "next/link";
import { ReportCover } from "@/components/report/ReportCover";
import { ReportFooter } from "@/components/report/ReportFooter";
import { publicStorageObjectUrl } from "@/lib/storage-public-url";

function resolveDemoImageUrl(): string {
  const direct = process.env.NEXT_PUBLIC_DEMO_IMAGE_URL?.trim();
  if (direct) return direct;
  const rel = process.env.NEXT_PUBLIC_SAMPLE_PRODUCT_PATH?.trim();
  if (rel) return publicStorageObjectUrl("productos", rel);
  return "";
}

export default function HomePage() {
  const demoImage = resolveDemoImageUrl();
  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const today = new Intl.DateTimeFormat("es-AR", {
    dateStyle: "long",
  }).format(new Date());

  return (
    <div className="min-h-screen">
      <div className="bg-report-navy text-report-paper">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-2.5 text-xs font-sans tracking-wide">
          <span className="opacity-90">RIMEC Nexus — capa ejecutiva (Vercel)</span>
          <nav className="flex gap-4">
            <Link className="underline decoration-report-paper/40 underline-offset-4 hover:opacity-90" href="/">
              Portada
            </Link>
            <Link className="underline decoration-report-paper/40 underline-offset-4 hover:opacity-90" href="/informes">
              Informe principal
            </Link>
            <Link className="underline decoration-report-paper/40 underline-offset-4 hover:opacity-90" href="/sales-report">
              Sales Report (port)
            </Link>
          </nav>
        </div>
      </div>

      <ReportCover
        title="Informe operativo de stock y ventas"
        subtitle="Síntesis para dirección: posición de inventario, desempeño comercial por pilares y focos de riesgo. Versión demostración con datos de ejemplo hasta conectar la capa analítica final."
        meta={
          <p>
            <span className="font-semibold text-report-navy">Fecha de referencia:</span> {today}
            <span className="mx-2 text-report-rule">|</span>
            <span className="font-semibold text-report-navy">Clasificación:</span> Uso interno — no distribuir
          </p>
        }
      />

      <main className="mx-auto max-w-5xl space-y-12 px-6 py-12">
        <section className="grid gap-10 lg:grid-cols-[1fr_280px] lg:items-start">
          <div className="space-y-5 font-sans text-[15px] leading-relaxed text-report-ink">
            <p>
              Este documento digital replica la lectura de un{" "}
              <strong>informe de desarrollo institucional</strong>: tipografía sobria, secciones numeradas y tablas
              legibles. La importación y el control de proceso continúan en Streamlit; esta vista es la que verá
              dirección en la reunión de demostración.
            </p>
            <p className="text-report-muted">
              Imágenes de producto: mismo bucket público <code className="rounded bg-report-paper2 px-1.5 py-0.5 text-xs text-report-navy">productos</code> en Supabase Storage. Configurá la ruta de ejemplo en{" "}
              <code className="rounded bg-report-paper2 px-1.5 py-0.5 text-xs text-report-navy">.env.local</code> según{" "}
              <code className="rounded bg-report-paper2 px-1.5 py-0.5 text-xs text-report-navy">.env.example</code>.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/informes"
                className="inline-flex items-center justify-center border border-report-navy bg-report-navy px-5 py-2.5 font-sans text-sm font-semibold text-report-paper transition hover:bg-report-navy2"
              >
                Abrir informe completo
              </Link>
              <a
                className="inline-flex items-center justify-center border border-report-rule bg-white px-5 py-2.5 font-sans text-sm font-semibold text-report-navy shadow-sm transition hover:bg-report-paper2"
                href="https://vercel.com/new"
                target="_blank"
                rel="noreferrer"
              >
                Desplegar en Vercel
              </a>
            </div>
          </div>

          <aside className="border border-report-rule bg-white p-4 shadow-sm">
            <p className="font-serif text-xs font-bold uppercase tracking-wider text-report-gold">
              Figura 0
            </p>
            <p className="mt-1 font-sans text-xs font-semibold text-report-navy">Ilustración de producto (demo)</p>
            <div className="relative mt-3 aspect-square w-full overflow-hidden border border-report-rule bg-report-paper2">
              {demoImage ? (
                <Image
                  src={demoImage}
                  alt="Producto — almacenamiento Supabase"
                  fill
                  className="object-contain p-3"
                  sizes="280px"
                  priority
                />
              ) : (
                <div className="flex h-full min-h-[180px] flex-col items-center justify-center gap-1 p-4 text-center font-sans text-xs text-report-muted">
                  <p>Sin imagen configurada.</p>
                  <p>
                    {supabaseConfigured
                      ? "Definí NEXT_PUBLIC_SAMPLE_PRODUCT_PATH."
                      : "Completá NEXT_PUBLIC_SUPABASE_URL en .env.local."}
                  </p>
                </div>
              )}
            </div>
          </aside>
        </section>
      </main>

      <ReportFooter />
    </div>
  );
}
