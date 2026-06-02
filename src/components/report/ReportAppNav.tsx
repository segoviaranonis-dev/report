"use client"

import Link from "next/link";
import { useEffect, useState } from "react";

export type ReportNavKey = "home" | "rimec" | "retail" | "ventas-fotos" | "aprobaciones" | "informes";

const base = "underline decoration-report-paper/40 underline-offset-4 hover:opacity-90";
const active = "font-semibold underline decoration-report-paper underline-offset-4";

type Props = {
  active: ReportNavKey;
  title?: string;
  maxWidthClass?: string;
};

type NavItem = {
  key: ReportNavKey;
  href: string;
  label: string;
  roles: number[]; // Roles permitidos
};

const ALL_NAV_ITEMS: NavItem[] = [
  { key: "home", href: "/", label: "Portada", roles: [1] },
  { key: "rimec", href: "/rimec", label: "RIMEC — ventas", roles: [1] },
  { key: "retail", href: "/retail", label: "Stock / Retail", roles: [1, 2] },
  { key: "ventas-fotos", href: "/ventas-fotos", label: "Ventas + fotos", roles: [1, 3] },
  { key: "aprobaciones", href: "/aprobaciones", label: "Aprobaciones", roles: [1] },
  { key: "informes", href: "/informes", label: "Anexo documental", roles: [1] },
];

export function ReportAppNav({ active, title, maxWidthClass = "max-w-5xl" }: Props) {
  const [rolId, setRolId] = useState<number>(1);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.authenticated) {
          setRolId(data.user.rol_id || 1);
        }
      })
      .catch(() => setRolId(1));
  }, []);

  const navItems = ALL_NAV_ITEMS.filter(item => item.roles.includes(rolId));

  return (
    <div className="bg-report-nav text-report-paper">
      <div className={`mx-auto flex flex-wrap items-center justify-between gap-3 px-6 py-2.5 text-xs font-sans tracking-wide ${maxWidthClass}`}>
        <span className="opacity-90">{title ?? "Report · RIMEC Holding"}</span>
        <nav className="flex flex-wrap gap-x-4 gap-y-1">
          {navItems.map(item => (
            <Link
              key={item.key}
              href={item.href}
              className={active === item.key ? active : base}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
