"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TIPO_V2_LABELS, parseTipoV2Id } from "@/lib/pilares/constants";
import type { TipoV2Id } from "@/lib/pilares/types";

interface TipoV2SelectorProps {
  /** Si true, persiste en query string ?tipo_v2_id= */
  syncUrl?: boolean;
  className?: string;
}

export function TipoV2Selector({ syncUrl = false, className = "" }: TipoV2SelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tipoV2Id = parseTipoV2Id(searchParams.get("tipo_v2_id")) as TipoV2Id;

  const setTipo = (next: TipoV2Id) => {
    if (!syncUrl) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("tipo_v2_id", String(next));
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <span className="text-sm font-semibold text-rimec-azul-dark">Tipo catálogo:</span>
      {([1, 2] as const).map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => setTipo(id)}
          className={`rounded-lg border-2 px-4 py-2 text-sm font-semibold transition-all ${
            tipoV2Id === id
              ? "border-rimec-azul bg-rimec-azul text-white shadow-md"
              : "border-rimec-azul/25 bg-card-bg text-rimec-azul hover:border-rimec-azul/50"
          }`}
        >
          {TIPO_V2_LABELS[id]}
        </button>
      ))}
    </div>
  );
}

export function useTipoV2FromUrl(): TipoV2Id {
  const searchParams = useSearchParams();
  return parseTipoV2Id(searchParams.get("tipo_v2_id")) as TipoV2Id;
}
