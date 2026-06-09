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

export function NexusHeaderDivided({ active = "home", maxWidthClass = "max-w-6xl" }: Props) {
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
    <header className="sticky top-0 z-50 w-full bg-neutral-950 border-b border-neutral-800 shadow-lg">
      <div className={`mx-auto ${maxWidthClass}`}>
        {/* Top Bar: Marca + Logout */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-800">
          <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <span className="font-serif text-xl tracking-widest text-neutral-light">
              NEXUS
            </span>
            <span className="text-brand-gold">·</span>
            <span className="font-sans text-sm font-light text-neutral-light-55 tracking-widest uppercase">
              Report
            </span>
          </Link>

          {rolId != null && (
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="rounded-lg border-2 border-neutral-700 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-neutral-light-88 transition-all hover:border-brand-gold hover:text-brand-gold hover:bg-brand-gold/5 disabled:opacity-50"
            >
              {loggingOut ? "Saliendo..." : "× Cerrar Sesión"}
            </button>
          )}
        </div>

        {/* Navigation Bar: RIMEC vs BAZZAR */}
        <div className="grid grid-cols-2 divide-x divide-neutral-800">
          {/* RIMEC Section */}
          {visibleRimec.length > 0 && (
            <div className="bg-gradient-to-br from-rimec-petroleo to-neutral-950 px-6 py-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🏢</span>
                <span className="text-xs font-bold uppercase tracking-wider text-rimec-celeste">
                  RIMEC
                </span>
                <span className="text-xs text-rimec-light/60">
                  ({visibleRimec.length} módulos)
                </span>
              </div>
              <nav className="flex flex-wrap gap-3">
                {visibleRimec.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded transition-all ${
                      active === item.key
                        ? "bg-rimec-celeste text-rimec-petroleo"
                        : "text-rimec-light hover:text-rimec-celeste hover:bg-rimec-celeste/10"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          )}

          {/* BAZZAR Section */}
          {visibleBazzar.length > 0 && (
            <div className="bg-gradient-to-br from-bazzar-azul/20 to-neutral-950 px-6 py-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🏪</span>
                <span className="text-xs font-bold uppercase tracking-wider text-bazzar-naranja">
                  BAZZAR
                </span>
                <span className="text-xs text-bazzar-naranja-light/60">
                  ({visibleBazzar.length} módulos)
                </span>
              </div>
              <nav className="flex flex-wrap gap-3">
                {visibleBazzar.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded transition-all ${
                      active === item.key
                        ? "bg-bazzar-naranja text-white"
                        : "text-bazzar-azul-light hover:text-bazzar-naranja hover:bg-bazzar-naranja/10"
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