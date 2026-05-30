import Image from "next/image";
import Link from "next/link";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
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

  return (
    <div className="min-h-screen bg-[#070b12] text-[#f8fafc] font-sans selection:bg-[#D4AF37]/30 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#070b12] to-black">
      {/* Header global unificado */}
      <NexusGlobalHeader active="home" title="Catálogo de Herramientas Financieras y Stock" />

      <main className="mx-auto max-w-5xl px-6 py-16 space-y-12">
        {/* Banner de Bienvenida Premium */}
        <section className="space-y-4 rounded-2xl border border-slate-800/80 bg-[#0f172a]/40 p-8 backdrop-blur-md relative overflow-hidden">
          <div className="absolute right-0 top-0 w-32 h-32 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />
          <span className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold">
            Consolidado Corporativo
          </span>
          <h2 className="font-serif text-3xl font-light tracking-wide text-white">
            Centro de Mando Comercial y Financiero
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-[#94a3b8]">
            Portal de control estratégico y auditoría analítica de RIMEC. Acceso unificado a herramientas 
            de facturación, rendimiento de marcas y conciliación de stock bajo el estándar molecular de pilares.
          </p>
        </section>

        {/* Grid de Cards ejecutivas */}
        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Inteligencia de Ventas */}
          <div className="group flex flex-col justify-between rounded-xl border border-slate-800 bg-[#0f172a]/30 p-6 transition-all duration-300 hover:border-[#D4AF37]/40 hover:bg-[#0f172a]/60">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-[#D4AF37]">
                  Ventas
                </span>
                <span className="text-[10px] bg-[#D4AF37]/10 text-[#D4AF37] px-2 py-0.5 rounded font-bold uppercase tracking-wide">
                  BI ACTIVO
                </span>
              </div>
              <h3 className="font-serif text-xl text-white font-medium">
                Inteligencia de Ventas
              </h3>
              <p className="text-xs leading-relaxed text-[#94a3b8]">
                Visualización inmersiva de facturación por mes, desempeño de marcas, 
                análisis de clientes mayoristas, KPIs y efectividad comercial.
              </p>
            </div>
            <Link 
              href="/rimec"
              className="mt-6 inline-flex w-full justify-center items-center rounded-lg bg-[#D4AF37] py-2.5 text-xs font-semibold text-[#070b12] hover:bg-[#B89329] transition-colors duration-300"
            >
              Ingresar al Dashboard
            </Link>
          </div>

          {/* Card 2: Stock & Retail */}
          <div className="group flex flex-col justify-between rounded-xl border border-slate-800 bg-[#0f172a]/30 p-6 transition-all duration-300 hover:border-[#D4AF37]/40 hover:bg-[#0f172a]/60">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-[#D4AF37]">
                  Inventario
                </span>
                <span className="text-[10px] bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded font-medium uppercase tracking-wide">
                  Multi-Tienda
                </span>
              </div>
              <h3 className="font-serif text-xl text-white font-medium">
                Stock & Retail
              </h3>
              <p className="text-xs leading-relaxed text-[#94a3b8]">
                Monitoreo integrado de stock. Control de curvas de tallas por marca y distribución 
                de cajas cerradas a través de los pilares del holding.
              </p>
            </div>
            <Link 
              href="/retail"
              className="mt-6 inline-flex w-full justify-center items-center rounded-lg border border-[#D4AF37]/40 py-2.5 text-xs font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-colors duration-300"
            >
              Ver Inventario
            </Link>
          </div>

          {/* Card 3: Ventas con fotos */}
          <div className="group flex flex-col justify-between rounded-xl border border-slate-800 bg-[#0f172a]/30 p-6 transition-all duration-300 hover:border-[#D4AF37]/40 hover:bg-[#0f172a]/60">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-[#D4AF37]">
                  Fotos
                </span>
                <span className="text-[10px] bg-[#D4AF37]/10 text-[#D4AF37] px-2 py-0.5 rounded font-bold uppercase tracking-wide">
                  Nuevo
                </span>
              </div>
              <h3 className="font-serif text-xl text-white font-medium">
                Ventas con Fotos
              </h3>
              <p className="text-xs leading-relaxed text-[#94a3b8]">
                Absorción del informe legacy de compras y tránsito por cliente, marca, período y referencia con miniaturas.
              </p>
            </div>
            <Link
              href="/ventas-fotos"
              className="mt-6 inline-flex w-full justify-center items-center rounded-lg border border-[#D4AF37]/40 py-2.5 text-xs font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-colors duration-300"
            >
              Abrir Informe
            </Link>
          </div>

          {/* Card 4: Anexo Documental */}
          <div className="group flex flex-col justify-between rounded-xl border border-slate-800 bg-[#0f172a]/30 p-6 transition-all duration-300 hover:border-slate-700 hover:bg-[#0f172a]/60">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-slate-400">
                  Documentos
                </span>
              </div>
              <h3 className="font-serif text-xl text-white font-medium">
                Anexo Documental
              </h3>
              <p className="text-xs leading-relaxed text-[#94a3b8]">
                Resguardo documental e institucional de Nexus Core. Acceso a políticas operativas, 
                actas y balances del holding.
              </p>
            </div>
            <Link 
              href="/informes"
              className="mt-6 inline-flex w-full justify-center items-center rounded-lg bg-slate-800 py-2.5 text-xs font-semibold text-white hover:bg-slate-700 transition-colors duration-300"
            >
              Acceder al Historial
            </Link>
          </div>
        </section>

        {/* Sección de Apoyo con Imagen */}
        <section className="grid gap-8 border-t border-slate-800/80 pt-10 lg:grid-cols-[1fr_260px] items-center">
          <div className="space-y-3">
            <h3 className="font-serif text-lg font-semibold text-[#D4AF37]">
              Sincronización Maestra de Productos
            </h3>
            <p className="text-xs leading-relaxed text-[#94a3b8] max-w-xl">
              Nuestra política de pilares asegura la consistencia molecular en toda la base de datos de producción: 
              línea, referencia, material y color. Las imágenes de stock se consultan en tiempo real vía Supabase Storage.
            </p>
          </div>
          <div className="border border-slate-800 bg-[#0f172a]/30 p-4 rounded-xl backdrop-blur-sm">
            <div className="relative aspect-square w-full overflow-hidden border border-slate-800 bg-black/40 rounded-lg">
              {demoImage ? (
                <Image
                  src={demoImage}
                  alt="Producto en Storage"
                  fill
                  className="object-contain p-3"
                  sizes="260px"
                />
              ) : (
                <div className="flex h-full min-h-[160px] flex-col items-center justify-center p-4 text-center text-xs text-slate-500">
                  <p className="font-medium text-slate-400">Sin imagen de apoyo</p>
                  <p className="text-[10px] mt-1">NEXT_PUBLIC_SAMPLE_PRODUCT_PATH</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Footer ejecutivo */}
      <footer className="border-t border-slate-900 bg-black/60 py-8 text-center text-[10px] text-[#94a3b8]/40">
        Uso Exclusivo Interno - Nexus Core · Privacidad de Alta Gestión · © {new Date().getFullYear()} holding
      </footer>
    </div>
  );
}
