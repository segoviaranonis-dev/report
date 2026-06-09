"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type NexusNavKey = "home" | "rimec" | "retail" | "ventas-fotos" | "aprobaciones" | "depositos-bazzar" | "tablet-bazzar" | "informes";

type Props = {
  active?: NexusNavKey;
  maxWidthClass?: string;
};

const rimecModules = [
  { key: "rimec", href: "/rimec", label: "Ventas", roles: [1] },
  { key: "ventas-fotos", href: "/ventas-fotos", label: "Ventas + Fotos", roles: [1, 3] },
  { key: "aprobaciones", href: "/aprobaciones", label: "Aprobaciones", roles: [1] },
];

const bazzarModules = [
  { key: "retail", href: "/retail", label: "Stock / Retail", roles: [1, 2] },
  { key: "depositos-bazzar", href: "/depositos-bazzar", label: "Depósitos", roles: [1, 2] },
  { key: "tablet-bazzar", href: "/tablet-bazzar", label: "Tablet", roles: [1, 2] },
];

export function NexusHeaderZen({ active = "home", maxWidthClass = "max-w-6xl" }: Props) {
  const router = useRouter();
  const [rolId, setRolId] = useState<number | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setRolId(data?.authenticated ? Number(data.user?.rol_id) || 0 : null))
      .catch(() => setRolId(null));
  }, []);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  const visibleRimec = rolId == null ? [] : rimecModules.filter((item) => item.roles.includes(rolId));
  const visibleBazzar = rolId == null ? [] : bazzarModules.filter((item) => item.roles.includes(rolId));

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b-4 border-rimec-azul shadow-lg">
      <div className={`mx-auto ${maxWidthClass}`}>
        {/* Top Bar: Marca + Logout - Con marco y animación */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-neutral-200 bg-gradient-to-r from-white to-rimec-celeste/20">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-lg bg-rimec-azul flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-md">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
              </svg>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-xl tracking-wide text-rimec-azul-dark group-hover:text-rimec-azul transition-colors font-bold">
                NEXUS
              </span>
              <span className="text-neutral-300 font-bold">·</span>
              <span className="font-sans text-sm font-light text-neutral-500 tracking-wide uppercase group-hover:text-neutral-700 transition-colors">
                Report
              </span>
            </div>
          </Link>

          {rolId != null && (
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-neutral-600 hover:bg-semantic-error/10 hover:text-semantic-error border-2 border-transparent hover:border-semantic-error-light transition-all disabled:opacity-50"
            >
              {loggingOut ? "Saliendo..." : "× Cerrar Sesión"}
            </button>
          )}
        </div>

        {/* Navigation Bar: RIMEC (celeste) vs BAZZAR (naranja) - Con sombra y hover */}
        <div className="grid grid-cols-2 divide-x-2 divide-neutral-300">
          {/* RIMEC Section - Con sombra de profundidad */}
          {visibleRimec.length > 0 && (
            <div className="bg-rimec-celeste px-6 py-5 border-l-4 border-rimec-azul shadow-md hover:shadow-2xl transition-all duration-500 hover:-translate-y-0.5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg animate-pulse">🏢</span>
                <span className="text-xs font-bold uppercase tracking-wider text-rimec-azul-dark">
                  RIMEC
                </span>
                <span className="text-xs text-rimec-azul/60 font-medium">
                  ({visibleRimec.length})
                </span>
              </div>
              <nav className="flex flex-wrap gap-2">
                {visibleRimec.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`text-xs font-semibold uppercase tracking-wide px-4 py-2 rounded-full transition-all duration-300 ${
                      active === item.key
                        ? "bg-rimec-azul text-white shadow-lg scale-105"
                        : "text-rimec-azul-dark bg-white border-2 border-rimec-celeste-medium hover:bg-rimec-celeste-medium hover:border-rimec-azul hover:scale-105 hover:shadow-md"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          )}

          {/* BAZZAR Section - Con sombra de profundidad */}
          {visibleBazzar.length > 0 && (
            <div className="bg-bazzar-fondo px-6 py-5 border-r-4 border-bazzar-naranja shadow-md hover:shadow-2xl transition-all duration-500 hover:-translate-y-0.5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg animate-pulse">🏪</span>
                <span className="text-xs font-bold uppercase tracking-wider text-bazzar-naranja">
                  BAZZAR
                </span>
                <span className="text-xs text-bazzar-naranja/60 font-medium">
                  ({visibleBazzar.length})
                </span>
              </div>
              <nav className="flex flex-wrap gap-2">
                {visibleBazzar.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`text-xs font-semibold uppercase tracking-wide px-4 py-2 rounded-full transition-all duration-300 ${
                      active === item.key
                        ? "bg-bazzar-naranja text-white shadow-lg scale-105"
                        : "text-neutral-700 bg-white border-2 border-bazzar-naranja-light hover:bg-bazzar-naranja/10 hover:text-bazzar-naranja hover:border-bazzar-naranja hover:scale-105 hover:shadow-md"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}