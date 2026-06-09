"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { NexusHeaderZen } from "@/components/report/NexusHeaderZen";
import { ReportFooter } from "@/components/report/ReportFooter";

type ModuleCard = {
  href: string;
  title: string;
  description: string;
  icon: string;
  roles: number[]; // Roles permitidos
};

const MODULES: ModuleCard[] = [
  {
    href: "/rimec",
    title: "RIMEC — Ventas",
    description: "Sales Report · Análisis multidimensional de ventas (Clientes, Marcas, Vendedores) con drill-down, jerarquías y KPIs ejecutivos.",
    icon: "📊",
    roles: [1],
  },
  {
    href: "/retail",
    title: "Stock / Retail",
    description: "Dashboard multi-tienda · Seguimiento de stock y ventas por línea, referencia, color. Ranking top productos con imágenes.",
    icon: "👟",
    roles: [1, 2],
  },
  {
    href: "/ventas-fotos",
    title: "Ventas + Fotos",
    description: "Catálogo con ventas · Productos con imagen, venta por período, filtros por marca/estilo/género, PDF ejecutivo descargable.",
    icon: "🖼️",
    roles: [1, 3],
  },
  {
    href: "/aprobaciones",
    title: "Aprobaciones",
    description: "Workflow de aprobación · Pedidos pendientes de confirmación, detalle de facturas, validación operativa interna.",
    icon: "✅",
    roles: [1],
  },
  {
    href: "/depositos-bazzar",
    title: "Depósitos Bazzar",
    description: "Administrador de depósitos · Gestión de stock para 6 tiendas (Fernando/San Martin/Palma × Adultos/Niños). Sincronización diaria para POS tablet.",
    icon: "🏪",
    roles: [1, 2],
  },
  {
    href: "/tablet-bazzar",
    title: "Tablet Bazzar",
    description: "Punto de venta en tienda · Sistema tablet para vendedores. Registro de clientes, generación de tickets, gestión de ventas retail con pilares y agrupaciones.",
    icon: "📱",
    roles: [1, 2],
  },
  {
    href: "/informes",
    title: "Anexo Documental",
    description: "Repositorio de reportes · Documentación técnica, guías de uso, mapas de paridad, procedimientos operativos.",
    icon: "📄",
    roles: [1],
  },
];

export default function HomePage() {
  const router = useRouter();
  const [rolId, setRolId] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.authenticated) {
          const userRolId = data.user.rol_id || 1;
          setRolId(userRolId);

          // Redirect según rol
          if (userRolId === 2) {
            router.replace('/retail');
          } else if (userRolId === 3) {
            router.replace('/ventas-fotos');
          }
        } else {
          router.replace('/login');
        }
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  // Mientras carga, no mostrar nada (evita flash de contenido)
  if (rolId === null) {
    return null;
  }

  // Si rol 2 o 3, el redirect ya ocurrió, no mostrar nada
  if (rolId === 2 || rolId === 3) {
    return null;
  }

  const visibleModules = MODULES.filter(m => m.roles.includes(rolId));

  // Agrupar módulos por sección
  const rimecModules = visibleModules.filter(m =>
    ['/rimec', '/ventas-fotos', '/aprobaciones'].includes(m.href)
  );
  const bazzarModules = visibleModules.filter(m =>
    ['/retail', '/depositos-bazzar', '/tablet-bazzar'].includes(m.href)
  );
  const otrosModules = visibleModules.filter(m =>
    !['/rimec', '/ventas-fotos', '/aprobaciones', '/retail', '/depositos-bazzar', '/tablet-bazzar'].includes(m.href)
  );

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-ink">
      <NexusHeaderZen />

      <main className="mx-auto max-w-6xl px-6 py-12">
        <header className="mb-12 text-center">
          <h1 className="font-serif text-5xl font-light text-neutral-ink mb-4">
            Report · RIMEC Holding
          </h1>
          <p className="text-lg text-neutral-ink-medium max-w-2xl mx-auto">
            Centro de mando comercial · Analítica, stock, aprobaciones y documentación para dirección y operaciones.
          </p>
        </header>

        {/* Acordeones de módulos */}
        <div className="space-y-6">
          {/* RIMEC */}
          {rimecModules.length > 0 && (
            <details open className="group rounded-2xl border-2 border-rimec-light/30 bg-white shadow-lg">
              <summary className="cursor-pointer bg-gradient-to-r from-rimec-petroleo/5 to-white px-6 py-4 font-bold text-rimec-azul hover:from-rimec-celeste/10 hover:to-neutral-50 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-3 text-xl">
                    <span>🏢</span>
                    <span>RIMEC</span>
                    <span className="text-sm font-normal text-rimec-azul/70">
                      ({rimecModules.length} módulos)
                    </span>
                  </span>
                  <span className="text-sm text-rimec-celeste">
                    Roles: {rolId === 1 ? '1 (Admin)' : rolId === 3 ? '3 (Vendedor)' : rolId}
                  </span>
                </div>
              </summary>
              <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
                {rimecModules.map((mod) => (
                  <Link
                    key={mod.href}
                    href={mod.href}
                    className="group block rounded-xl border-2 border-neutral-300 bg-neutral-50 p-5 shadow-sm transition-all hover:shadow-lg hover:border-rimec-celeste hover:-translate-y-0.5"
                  >
                    <div className="mb-3 text-3xl">{mod.icon}</div>
                    <h2 className="mb-2 font-serif text-lg font-semibold text-neutral-ink group-hover:text-rimec-azul transition-colors">
                      {mod.title}
                    </h2>
                    <p className="text-sm leading-relaxed text-neutral-ink-muted">
                      {mod.description}
                    </p>
                  </Link>
                ))}
              </div>
            </details>
          )}

          {/* BAZZAR */}
          {bazzarModules.length > 0 && (
            <details open className="group rounded-2xl border-2 border-bazzar-naranja-light/30 bg-white shadow-lg">
              <summary className="cursor-pointer bg-gradient-to-r from-bazzar-azul/5 to-white px-6 py-4 font-bold text-bazzar-azul hover:from-bazzar-naranja/10 hover:to-neutral-50 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-3 text-xl">
                    <span>🏪</span>
                    <span>BAZZAR</span>
                    <span className="text-sm font-normal text-bazzar-azul/70">
                      ({bazzarModules.length} módulos)
                    </span>
                  </span>
                  <span className="text-sm text-bazzar-naranja">
                    Roles: {rolId === 1 ? '1 (Admin)' : rolId === 2 ? '2 (Retail)' : rolId}
                  </span>
                </div>
              </summary>
              <div className="grid gap-4 p-6 sm:grid-cols-2">
                {bazzarModules.map((mod) => (
                  <Link
                    key={mod.href}
                    href={mod.href}
                    className="group block rounded-xl border-2 border-neutral-300 bg-neutral-50 p-5 shadow-sm transition-all hover:shadow-lg hover:border-bazzar-naranja hover:-translate-y-0.5"
                  >
                    <div className="mb-3 text-3xl">{mod.icon}</div>
                    <h2 className="mb-2 font-serif text-lg font-semibold text-neutral-ink group-hover:text-bazzar-azul transition-colors">
                      {mod.title}
                    </h2>
                    <p className="text-sm leading-relaxed text-neutral-ink-muted">
                      {mod.description}
                    </p>
                  </Link>
                ))}
              </div>
            </details>
          )}

          {/* Otros módulos (sin acordeón) */}
          {otrosModules.length > 0 && (
            <div className="rounded-2xl border-2 border-neutral-300 bg-white p-6 shadow-lg">
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-neutral-ink-muted">
                Recursos Adicionales
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {otrosModules.map((mod) => (
                  <Link
                    key={mod.href}
                    href={mod.href}
                    className="group block rounded-xl border-2 border-neutral-300 bg-neutral-50 p-5 shadow-sm transition-all hover:shadow-lg hover:border-brand-gold hover:-translate-y-0.5"
                  >
                    <div className="mb-3 text-3xl">{mod.icon}</div>
                    <h2 className="mb-2 font-serif text-lg font-semibold text-neutral-ink group-hover:text-brand-gold transition-colors">
                      {mod.title}
                    </h2>
                    <p className="text-sm leading-relaxed text-neutral-ink-muted">
                      {mod.description}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <footer className="mt-16 text-center text-xs text-neutral-ink-muted">
          Acceso restringido · Solo usuarios autorizados
        </footer>
      </main>

      <ReportFooter />
    </div>
  );
}