"use client";

import type { PilaresMaestras } from "@/lib/pilares/types";
import { cap, FiltroRow, Pill, PilaresFiltrosShell, TipoV2FiltroRow } from "./PilaresFiltrosUi";

interface PilaresLineasFiltrosBarProps {
  maestras: PilaresMaestras;
  filtroMarca: string;
  filtroGenero: string;
  onMarca: (value: string) => void;
  onGenero: (value: string) => void;
  loading?: boolean;
}

export function PilaresLineasFiltrosBar({
  maestras,
  filtroMarca,
  filtroGenero,
  onMarca,
  onGenero,
  loading,
}: PilaresLineasFiltrosBarProps) {
  return (
    <PilaresFiltrosShell loading={loading}>
      <TipoV2FiltroRow />

      <div className="h-px bg-report-rule" />

      <FiltroRow label="Marca">
        <Pill active={!filtroMarca} onClick={() => onMarca("")}>
          Todas
        </Pill>
        <Pill
          active={filtroMarca === "__null__"}
          onClick={() => onMarca(filtroMarca === "__null__" ? "" : "__null__")}
        >
          Sin marca
        </Pill>
        {maestras.marcas.map((m) => (
          <Pill
            key={m.id}
            active={filtroMarca === m.label}
            onClick={() => onMarca(filtroMarca === m.label ? "" : m.label)}
          >
            {cap(m.label)}
          </Pill>
        ))}
      </FiltroRow>

      <FiltroRow label="Género">
        <Pill active={!filtroGenero} onClick={() => onGenero("")}>
          Todos
        </Pill>
        <Pill
          active={filtroGenero === "__null__"}
          onClick={() => onGenero(filtroGenero === "__null__" ? "" : "__null__")}
        >
          Sin género
        </Pill>
        {maestras.generos.map((g) => (
          <Pill
            key={g.id}
            active={filtroGenero === g.label}
            onClick={() => onGenero(filtroGenero === g.label ? "" : g.label)}
          >
            {cap(g.label)}
          </Pill>
        ))}
      </FiltroRow>
    </PilaresFiltrosShell>
  );
}
