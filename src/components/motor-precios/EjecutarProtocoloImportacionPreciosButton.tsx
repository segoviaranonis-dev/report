"use client";



import Link from "next/link";

import { useEffect, useState } from "react";

import {

  NIVEL_DIOS_CATEGORIA,

  NIVEL_DIOS_ROL_ID,

  UI_NIVEL_SUPERIOR,

  UI_NIVEL_SUPERIOR_CORTO,

} from "@/lib/auth/nivel-dios";

import { IMPORTACION_PRECIOS_NUEVO } from "@/lib/report/routes";



type Props = {

  className?: string;

  /** compact = barra tools · hero = CTA principal */

  variant?: "hero" | "compact";

};



/**

 * Ejecutar protocolo Importación de precios (2.3.1.7.2 · Pasos 0–5).

 * Solo habilitado Nivel Superior (rol_id=1 + categoria interna DIOS).

 */

export function EjecutarProtocoloImportacionPreciosButton({

  className = "",

  variant = "hero",

}: Props) {

  const [autorizado, setAutorizado] = useState<boolean | null>(null);



  useEffect(() => {

    fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" })

      .then((r) => r.json())

      .then((data) => {

        const rol = Number(data?.user?.rol_id);

        const cat = String(data?.user?.categoria || data?.user?.role || "")

          .toUpperCase()

          .trim();

        setAutorizado(rol === NIVEL_DIOS_ROL_ID && cat === NIVEL_DIOS_CATEGORIA);

      })

      .catch(() => setAutorizado(false));

  }, []);



  const base =

    variant === "hero"

      ? "inline-flex min-h-[48px] items-center justify-center rounded-xl px-6 py-3 text-sm font-bold shadow-md transition"

      : "inline-flex min-h-[40px] items-center justify-center rounded-xl px-4 py-2 text-xs font-bold transition";



  if (autorizado === null) {

    return (

      <span

        className={`${base} border border-slate-200 bg-slate-50 text-slate-400 ${className}`}

        aria-busy

      >

        Verificando acceso…

      </span>

    );

  }



  if (!autorizado) {

    return (

      <button

        type="button"

        disabled

        title={`Solo ${UI_NIVEL_SUPERIOR} · acceso restringido`}

        className={`${base} cursor-not-allowed border-2 border-slate-200 bg-slate-100 text-slate-400 ${className}`}

      >

        🔒 Ejecutar protocolo de importación de precios

        <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide opacity-80">

          Solo {UI_NIVEL_SUPERIOR_CORTO}

        </span>

      </button>

    );

  }



  return (

    <Link

      href={IMPORTACION_PRECIOS_NUEVO}

      title={`${UI_NIVEL_SUPERIOR} · inicia Pasos 0–5 (Excel → evento → cierre)`}

      className={`${base} bg-rimec-azul text-white hover:bg-rimec-azul-dark ${className}`}

    >

      ⚡ Ejecutar protocolo de importación de precios

      <span className="ml-2 rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">

        {UI_NIVEL_SUPERIOR}

      </span>

    </Link>

  );

}

