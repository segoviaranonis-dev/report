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
    <header className="sticky top-0 z-50 w-full bg-white border-b border-neutral-200 shadow-sm">
      <div className={`mx-auto ${maxWidthClass}`}>
        {/* Top Bar: Marca + Logout - Zen minimalista */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-100">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="font-serif text-xl tracking-wide text-neutral-800 group-hover:text-neutral-600 transition-colors">
              NEXUS
            </span>
            <span className="text-neutral-300">·</span>
            <span className="font-sans text-sm font-light text-neutral-500 tracking-wide uppercase">
              Report
            </span>
          </Link>

          {rolId != null && (
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="text-xs font-medium text-neutral-500 hover:text-neutral-800 transition-colors disabled:opacity-50"
            >
              {loggingOut ? "Saliendo..." : "× Cerrar Sesión"}
            </button>
          )}
        </div>

        {/* Navigation Bar: RIMEC (celeste) vs BAZZAR (borde naranja) - Estilo ZEN */}
        <div className="grid grid-cols-2 divide-x divide-neutral-100">
          {/* RIMEC Section - Fondo celeste pastel */}
          {visibleRimec.length > 0 && (
            <div className="bg-rimec-celeste px-6 py-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">🏢</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-rimec-azul">
                  RIMEC
                </span>
                <span className="text-xs text-rimec-azul/60">
                  ({visibleRimec.length})
                </span>
              </div>
              <nav className="flex flex-wrap gap-2">
                {visibleRimec.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`text-xs font-medium uppercase tracking-wide px-3 py-1.5 rounded-full transition-all ${
                      active === item.key
                        ? "bg-rimec-azul text-white shadow-sm"
                        : "text-rimec-azul-dark hover:bg-rimec-celeste-medium"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          )}

          {/* BAZZAR Section - Fondo claro con borde naranja */}
          {visibleBazzar.length > 0 && (
            <div className="bg-bazzar-fondo px-6 py-4 border-l-4 border-bazzar-naranja">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">🏪</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-bazzar-naranja">
                  BAZZAR
                </span>
                <span className="text-xs text-neutral-500">
                  ({visibleBazzar.length})
                </span>
              </div>
              <nav className="flex flex-wrap gap-2">
                {visibleBazzar.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`text-xs font-medium uppercase tracking-wide px-3 py-1.5 rounded-full transition-all ${
                      active === item.key
                        ? "bg-bazzar-naranja text-white shadow-sm"
                        : "text-neutral-700 hover:bg-bazzar-naranja/10 hover:text-bazzar-naranja"
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