"use client";

import { useDepositoCalzado } from "@/app/depositos-bazzar/context/DepositoCalzadoContext";

export function DepositoCalzadoStatus() {
  const { loading, err } = useDepositoCalzado();

  if (loading) {
    return (
      <div className="rounded-xl border border-orange-100 bg-orange-50/60 px-4 py-3 text-sm text-bazzar-naranja-dark">
        Cargando stock y gráficos… (primera carga puede tardar ~10 s)
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {err}
      </div>
    );
  }

  return null;
}
