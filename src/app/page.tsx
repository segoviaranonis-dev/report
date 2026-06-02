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
          setRolId(1); // Default si no hay sesión
        }
      })
      .catch(() => setRolId(1));
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

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visibleModules.map((mod) => (
            <Link
              key={mod.href}
              href={mod.href}
              className="group block rounded-2xl border border-report-border bg-white p-6 shadow-sm transition hover:shadow-md hover:border-report-primary/30"
            >
              <div className="mb-4 text-4xl">{mod.icon}</div>
              <h2 className="mb-2 font-serif text-xl font-semibold text-report-primary group-hover:text-report-accent">
                {mod.title}
              </h2>
              <p className="text-sm leading-relaxed text-report-muted">
                {mod.description}
              </p>
            </Link>
          ))}
        </div>

        <footer className="mt-16 text-center text-xs text-report-muted">
          Acceso restringido · Solo usuarios autorizados
        </footer>
      </main>

      <ReportFooter />
    </div>
  );
}
