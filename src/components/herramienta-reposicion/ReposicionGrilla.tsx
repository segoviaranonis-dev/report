"use client";

import { memo } from "react";
import { ReposicionArticuloCard } from "@/components/herramienta-reposicion/ReposicionArticuloCard";
import type { ReposicionArticulo } from "@/lib/herramienta-reposicion/merge-reposicion";
import {
  esOrdenPorMetrica,
  type OrdenReposicionModo,
} from "@/lib/herramienta-reposicion/orden-compra-previa";
import type { NivelAm, NivelAmMap } from "@/lib/herramienta-reposicion/nivel-am";

type Props = {
  articulos: ReposicionArticulo[];
  expandAll: boolean;
  ordenModo: OrdenReposicionModo;
  nivelesPorKey: NivelAmMap;
  ranksPorKey: Map<string, number>;
};

/**
 * Grilla aislada: no recibe `ordenando` → setState del overlay no la re-renderiza.
 */
export const ReposicionGrilla = memo(function ReposicionGrilla({
  articulos,
  expandAll,
  ordenModo,
  nivelesPorKey,
  ranksPorKey,
}: Props) {
  return (
    <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {articulos.map((a) => (
        <ReposicionArticuloCard
          key={a.key}
          articulo={a}
          expanded={expandAll}
          nivelAm={(nivelesPorKey.get(a.key) ?? 0) as NivelAm}
          rankOrden={esOrdenPorMetrica(ordenModo) ? (ranksPorKey.get(a.key) ?? 0) : 0}
        />
      ))}
    </div>
  );
});
