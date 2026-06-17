"use client";

import type { LineaReferenciaCascada, PilaresMaestras } from "@/lib/pilares/types";
import { cap, FiltroRow, Pill, PilaresFiltrosShell, TipoV2FiltroRow } from "./PilaresFiltrosUi";

interface Props {
  maestras: PilaresMaestras;
  filtroMarca: string;
  filtroEstilo: string;
  filtroTipo1: string;
  onMarca: (value: string) => void;
  onEstilo: (value: string) => void;
  onTipo1: (value: string) => void;
  cascada?: LineaReferenciaCascada | null;
  cascadaActiva?: boolean;
  loading?: boolean;
}

function normKey(s: string) {
  return s.trim().toLowerCase();
}

export function PilaresLineaReferenciaFiltrosBar({
  maestras,
  filtroMarca,
  filtroEstilo,
  filtroTipo1,
  onMarca,
  onEstilo,
  onTipo1,
  cascada,
  cascadaActiva,
  loading,
}: Props) {
  const marcaKeys = new Set(cascada?.marcas.map((m) => normKey(m.key)) ?? []);
  const marcaInvolved = (key: string) => !cascadaActiva || marcaKeys.has(normKey(key));

  const estiloKeys = new Set(cascada?.estilos.map((e) => e.key) ?? []);
  const estiloInvolved = (key: string) => !cascadaActiva || estiloKeys.has(key);

  const tipo1Keys = new Set(cascada?.tipos1.map((t) => t.key) ?? []);
  const tipo1Involved = (key: string) => !cascadaActiva || tipo1Keys.has(key);

  const marcaCount = (key: string) =>
    cascada?.marcas.find((m) => normKey(m.key) === normKey(key))?.count;

  return (
    <PilaresFiltrosShell loading={loading}>
      <TipoV2FiltroRow />

      <div className="h-px bg-report-rule" />

      {cascadaActiva ? (
        <p className="text-xs text-rimec-azul">
          Marcas atenuadas no tienen filas con el filtro actual — solo podés elegir las activas.
        </p>
      ) : null}

      <FiltroRow label="Marca">
        <Pill active={!filtroMarca} involved onClick={() => onMarca("")}>
          Todas
        </Pill>
        <Pill
          active={filtroMarca === "__null__"}
          involved={marcaInvolved("__null__")}
          onClick={() => onMarca(filtroMarca === "__null__" ? "" : "__null__")}
        >
          Sin marca
          {cascadaActiva && marcaCount("__null__") != null ? ` (${marcaCount("__null__")})` : ""}
        </Pill>
        {maestras.marcas.map((m) => (
          <Pill
            key={m.id}
            active={filtroMarca === m.label}
            involved={marcaInvolved(m.label)}
            onClick={() => onMarca(filtroMarca === m.label ? "" : m.label)}
          >
            {cap(m.label)}
            {cascadaActiva && marcaCount(m.label) != null ? ` (${marcaCount(m.label)})` : ""}
          </Pill>
        ))}
      </FiltroRow>

      <FiltroRow label="Estilo">
        <Pill active={!filtroEstilo} involved onClick={() => onEstilo("")}>
          Todos
        </Pill>
        <Pill
          active={filtroEstilo === "__null__"}
          involved={estiloInvolved("__null__")}
          onClick={() => onEstilo(filtroEstilo === "__null__" ? "" : "__null__")}
        >
          Sin estilo
        </Pill>
        {maestras.estilos.map((e) => (
          <Pill
            key={e.id}
            active={filtroEstilo === String(e.id)}
            involved={estiloInvolved(String(e.id))}
            onClick={() => onEstilo(filtroEstilo === String(e.id) ? "" : String(e.id))}
          >
            {cap(e.label)}
          </Pill>
        ))}
      </FiltroRow>

      <FiltroRow label="Tipo 1">
        <Pill active={!filtroTipo1} involved onClick={() => onTipo1("")}>
          Todos
        </Pill>
        <Pill
          active={filtroTipo1 === "__null__"}
          involved={tipo1Involved("__null__")}
          onClick={() => onTipo1(filtroTipo1 === "__null__" ? "" : "__null__")}
        >
          Sin tipo
        </Pill>
        {maestras.tipos1.map((t) => (
          <Pill
            key={t.id}
            active={filtroTipo1 === String(t.id)}
            involved={tipo1Involved(String(t.id))}
            onClick={() => onTipo1(filtroTipo1 === String(t.id) ? "" : String(t.id))}
          >
            {cap(t.label)}
          </Pill>
        ))}
      </FiltroRow>
    </PilaresFiltrosShell>
  );
}
