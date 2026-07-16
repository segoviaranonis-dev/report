"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IMPORTACION_PRECIOS_NUEVO } from "@/lib/report/routes";

type Props = {
  className?: string;
  /** compact = barra tools · hero = CTA principal */
  variant?: "hero" | "compact";
};

/**
 * Ejecutar protocolo Importación de precios (2.3.1.7.2 · Pasos 0–5).
 * Solo habilitado Nivel Dios (rol_id=1 + categoria=DIOS).
 */
export function EjecutarProtocoloImportacionPreciosButton({
  className = "",
  variant = "hero",
}: Props) {
  const [dios, setDios] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const rol = Number(data?.user?.rol_id);
        const cat = String(data?.user?.categoria || data?.user?.role || "")
          .toUpperCase()
          .trim();
        setDios(rol === 1 && cat === "DIOS");
      })
      .catch(() => setDios(false));
  }, []);

  const base =
    variant === "hero"
      ? "inline-flex min-h-[48px] items-center justify-center rounded-xl px-6 py-3 text-sm font-bold shadow-md transition"
      : "inline-flex min-h-[40px] items-center justify-center rounded-xl px-4 py-2 text-xs font-bold transition";

  if (dios === null) {
    return (
      <span
        className={`${base} border border-slate-200 bg-slate-50 text-slate-400 ${className}`}
        aria-busy
      >
        Verificando acceso…
      </span>
    );
  }

  if (!dios) {
    return (
      <button
        type="button"
        disabled
        title="Solo Nivel Dios · rol_id=1 y categoria=DIOS"
        className={`${base} cursor-not-allowed border-2 border-slate-200 bg-slate-100 text-slate-400 ${className}`}
      >
        🔒 Ejecutar protocolo de importación de precios
        <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide opacity-80">
          Solo DIOS
        </span>
      </button>
    );
  }

  return (
    <Link
      href={IMPORTACION_PRECIOS_NUEVO}
      title="Nivel Dios · inicia Pasos 0–5 (Excel → evento → cierre)"
      className={`${base} bg-rimec-azul text-white hover:bg-rimec-azul-dark ${className}`}
    >
      ⚡ Ejecutar protocolo de importación de precios
      <span className="ml-2 rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
        Nivel Dios
      </span>
    </Link>
  );
}
