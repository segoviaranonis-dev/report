import Image from "next/image";
import Link from "next/link";
import { ReportAppNav } from "@/components/report/ReportAppNav";
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
  const today = new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(new Date());

  return (
    <div className="min-h-screen">
      <ReportAppNav active="home" />

      <ReportCover
        title="Misión, visión y políticas de desarrollo"
        subtitle="Esta herramienta es una pieza del paquete completo del holding: hablamos un solo idioma — el de los pilares (proveedor, línea, referencia, material, color y distribución / grada). El pedido original es un reporte de venta diario ligado al stock y a la disponibilidad de la importadora; hoy usamos columnas y orígenes de ejemplo (Tienda_1, Tienda_2, Tienda_3) hasta normalizar en nuestras propias tablas de stock y movimiento, absorber la empresa importadora RIMEC y sustituir su sistema operativo actual."
        meta={
          <p>
            <span className="font-semibold text-report-navy">Actualización:</span> {today}
            <span className="mx-2 text-report-rule">|</span>
            <span className="font-semibold text-report-navy">Clasificación:</span> Uso interno — holding
          </p>
        }
      />

      <main className="mx-auto max-w-5xl space-y-10 px-6 py-12 font-sans text-[15px] leading-relaxed text-report-ink">
        <section className="space-y-4">
          <h2 className="font-serif text-xl font-bold text-report-navy">1. Prioridad de producto</h2>
          <p>
            <strong>RIMEC</strong> — informe de ventas en <strong>Sales Report web v1.0.0</strong>: vista principal inmersiva en{" "}
            <Link className="font-semibold underline decoration-report-navy/30 underline-offset-4" href="/rimec">
              /rimec
            </Link>{" "}
            (snapshot único, KPIs, evolución, clientes, marcas, vendedores). La vista clásica de ocho tablas + PDF vive en{" "}
            <Link className="underline decoration-report-navy/30 underline-offset-4" href="/rimec/clasico">
              /rimec/clasico
            </Link>
            . Misma lógica de negocio que Streamlit sobre <code className="rounded bg-report-paper2 px-1 text-xs">v_ventas_pivot</code>.
          </p>
          <p>
            <strong>Secundario:</strong> gestión de <strong>stock</strong> (retail multi-tienda / importadora).
            Aún <strong>no</strong> hacemos el informe de ventas desglosado por tienda hasta tener esos datos con la
            misma calidad; cuando los tengamos, fusionamos empresas del holding <strong>a través de los
            pilares</strong>, sin depender del nombre de columna en cada Excel heredado.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-xl font-bold text-report-navy">2. Grada y distribución</h2>
          <p>
            Identificamos <strong>caja cerrada</strong> (ej. <code className="rounded bg-report-paper2 px-1 text-xs">34(1 2 3 3 2 1)</code>) y{" "}
            <strong>curva abierta</strong> mapeada a pares por talla, por ejemplo: 34→1, 35→2, 36→3, 37→3,
            38→2, 39→1. Es la misma semántica que pedís en operación y en informes.
          </p>
        </section>

        <section className="flex flex-wrap gap-3 border-t border-report-rule pt-8">
          <Link
            href="/rimec"
            className="inline-flex border border-report-navy bg-report-navy px-6 py-3 text-sm font-semibold text-report-paper shadow-sm transition hover:bg-report-navy2"
          >
            Ir a RIMEC
          </Link>
          <Link
            href="/retail"
            className="inline-flex border border-report-rule bg-white px-6 py-3 text-sm font-semibold text-report-navy shadow-sm transition hover:bg-report-paper2"
          >
            Stock / Retail
          </Link>
          <Link
            href="/informes"
            className="inline-flex border border-report-rule bg-report-paper2 px-6 py-3 text-sm font-semibold text-report-navy transition hover:bg-white"
          >
            Anexo documental (PE)
          </Link>
        </section>

        <section className="grid gap-8 border-t border-report-rule pt-10 lg:grid-cols-[1fr_260px]">
          <div className="space-y-3 text-report-muted">
            <h3 className="font-serif text-lg font-semibold text-report-navy">Figura de apoyo</h3>
            <p className="text-sm">
              Imagen de producto vía Storage público (opcional). La estrella sigue siendo la analítica de
              ventas.
            </p>
          </div>
          <aside className="border border-report-rule bg-white p-4 shadow-sm">
            <div className="relative aspect-square w-full overflow-hidden border border-report-rule bg-report-paper2">
              {demoImage ? (
                <Image
                  src={demoImage}
                  alt="Producto — Supabase Storage"
                  fill
                  className="object-contain p-3"
                  sizes="260px"
                />
              ) : (
                <div className="flex h-full min-h-[160px] flex-col items-center justify-center p-4 text-center text-xs text-report-muted">
                  <p>Sin imagen.</p>
                  <p>{supabaseConfigured ? "NEXT_PUBLIC_SAMPLE_PRODUCT_PATH" : "NEXT_PUBLIC_SUPABASE_URL"}</p>
                </div>
              )}
            </div>
          </aside>
        </section>
      </main>

      <ReportFooter
        note="Política de pilares: si el elemento no existe en el maestro correspondiente, se inserta en importación; si existe, no se actualiza por importación — la corrección fina es por editores (rango de línea, linea_referencia, motor de precios)."
      />
    </div>
  );
}
