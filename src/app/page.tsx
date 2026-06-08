"use client"

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
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
    <div className="min-h-screen bg-report-bg text-report-ink">
      <NexusGlobalHeader />

      <main className="mx-auto max-w-6xl px-6 py-12">
        <header className="mb-12 text-center">
          <h1 className="font-serif text-5xl font-light text-report-primary mb-4">
            Report · RIMEC Holding
          </h1>
          <p className="text-lg text-report-muted max-w-2xl mx-auto">
            Centro de mando comercial · Analítica, stock, aprobaciones y documentación para dirección y operaciones.
          </p>
        </header>

        {/* Acordeones de módulos */}
        <div className="space-y-6">
          {/* RIMEC */}
          {rimecModules.length > 0 && (
            <details open className="group rounded-2xl border-2 border-blue-200 bg-white shadow-sm">
              <summary className="cursor-pointer bg-gradient-to-r from-blue-50 to-white px-6 py-4 font-bold text-blue-900 hover:from-blue-100 hover:to-blue-50">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-3 text-xl">
                    <span>🏢</span>
                    <span>RIMEC</span>
                    <span className="text-sm font-normal text-blue-600">
                      ({rimecModules.length} módulos)
                    </span>
                  </span>
                  <span className="text-sm text-blue-600">
                    Roles: {rolId === 1 ? '1 (Admin)' : rolId === 3 ? '3 (Vendedor)' : rolId}
                  </span>
                </div>
              </summary>
              <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
                {rimecModules.map((mod) => (
                  <Link
                    key={mod.href}
                    href={mod.href}
                    className="group block rounded-xl border border-report-border bg-white p-5 shadow-sm transition hover:shadow-md hover:border-blue-400"
                  >
                    <div className="mb-3 text-3xl">{mod.icon}</div>
                    <h2 className="mb-2 font-serif text-lg font-semibold text-report-primary group-hover:text-blue-600">
                      {mod.title}
                    </h2>
                    <p className="text-xs leading-relaxed text-report-muted">
                      {mod.description}
                    </p>
                  </Link>
                ))}
              </div>
            </details>
          )}

          {/* BAZZAR */}
          {bazzarModules.length > 0 && (
            <details open className="group rounded-2xl border-2 border-green-200 bg-white shadow-sm">
              <summary className="cursor-pointer bg-gradient-to-r from-green-50 to-white px-6 py-4 font-bold text-green-900 hover:from-green-100 hover:to-green-50">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-3 text-xl">
                    <span>🏪</span>
                    <span>BAZZAR</span>
                    <span className="text-sm font-normal text-green-600">
                      ({bazzarModules.length} módulos)
                    </span>
                  </span>
                  <span className="text-sm text-green-600">
                    Roles: {rolId === 1 ? '1 (Admin)' : rolId === 2 ? '2 (Retail)' : rolId}
                  </span>
                </div>
              </summary>
              <div className="grid gap-4 p-6 sm:grid-cols-2">
                {bazzarModules.map((mod) => (
                  <Link
                    key={mod.href}
                    href={mod.href}
                    className="group block rounded-xl border border-report-border bg-white p-5 shadow-sm transition hover:shadow-md hover:border-green-400"
                  >
                    <div className="mb-3 text-3xl">{mod.icon}</div>
                    <h2 className="mb-2 font-serif text-lg font-semibold text-report-primary group-hover:text-green-600">
                      {mod.title}
                    </h2>
                    <p className="text-xs leading-relaxed text-report-muted">
                      {mod.description}
                    </p>
                  </Link>
                ))}
              </div>
            </details>
          )}

          {/* Otros módulos (sin acordeón) */}
          {otrosModules.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
                Recursos Adicionales
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {otrosModules.map((mod) => (
                  <Link
                    key={mod.href}
                    href={mod.href}
                    className="group block rounded-xl border border-report-border bg-white p-5 shadow-sm transition hover:shadow-md hover:border-report-primary/30"
                  >
                    <div className="mb-3 text-3xl">{mod.icon}</div>
                    <h2 className="mb-2 font-serif text-lg font-semibold text-report-primary group-hover:text-report-accent">
                      {mod.title}
                    </h2>
                    <p className="text-xs leading-relaxed text-report-muted">
                      {mod.description}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <footer className="mt-16 text-center text-xs text-report-muted">
          Acceso restringido · Solo usuarios autorizados
        </footer>
      </main>

      <ReportFooter />
    </div>
  );
}
