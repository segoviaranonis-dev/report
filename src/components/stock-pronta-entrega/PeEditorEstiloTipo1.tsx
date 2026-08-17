"use client";

import { useRef, useState } from "react";
import type { DepositoFilterItem } from "@/app/api/depositos/[cliente_id]/filtros/route";

type Field = "estilo" | "tipo1";

type Props = {
  field: Field;
  lineaReferenciaId: number | null | undefined;
  tipoV2Id: number | null | undefined;
  currentId: number | null | undefined;
  currentLabel: string | null | undefined;
  options: DepositoFilterItem[];
  onPatched: (lrId: number, patch: { id: number | null; label: string | null }) => void;
};

/**
 * Editor compacto Estilo / Tipo 1 en tarjeta PE → PATCH /api/pilares/linea-referencia.
 */
export function PeEditorEstiloTipo1({
  field,
  lineaReferenciaId,
  tipoV2Id,
  currentId,
  currentLabel,
  options,
  onPatched,
}: Props) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const label = (currentLabel ?? "").trim() || "—";
  const sin =
    !currentId ||
    label === "—" ||
    label.toUpperCase() === "(SIN ESTILO)" ||
    (field === "tipo1" && label.toUpperCase() === "OTROS" && !currentId);

  const title = field === "estilo" ? "Estilo" : "Tipo 1";
  const bodyKey = field === "estilo" ? "grupo_estilo_id" : "tipo_1_id";

  const patch = async (opt: DepositoFilterItem | null) => {
    if (!lineaReferenciaId) return;
    const tv2 = tipoV2Id === 2 ? 2 : 1;
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = {
        id: lineaReferenciaId,
        tipo_v2_id: tv2,
        [bodyKey]: opt?.id ?? null,
      };
      const res = await fetch("/api/pilares/linea-referencia", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (!res.ok || json?.ok === false) {
        setErr(json?.error ?? `HTTP ${res.status}`);
        return;
      }
      onPatched(lineaReferenciaId, {
        id: opt?.id ?? null,
        label: opt?.label ?? null,
      });
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error de red");
    } finally {
      setBusy(false);
    }
  };

  if (!lineaReferenciaId) {
    return (
      <span
        className="truncate rounded border border-dashed border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400"
        title={`Sin L×R — no se puede editar ${title}`}
      >
        {title}: —
      </span>
    );
  }

  return (
    <span className="relative inline-flex max-w-full min-w-0">
      <button
        ref={btnRef}
        type="button"
        disabled={busy}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setErr(null);
          setOpen((v) => !v);
        }}
        title={`${title}: ${label} — clic para cambiar`}
        className={`max-w-full truncate rounded border px-1.5 py-0.5 text-left text-[9px] font-bold leading-tight transition hover:border-rimec-azul disabled:opacity-50 ${
          sin
            ? "border-dashed border-amber-400 bg-amber-50 text-amber-900"
            : "border-slate-300 bg-white text-slate-800"
        }`}
      >
        <span className="font-semibold uppercase text-slate-500">{title}: </span>
        {label}
      </button>
      {err ? (
        <span className="absolute left-0 top-full z-[220] mt-0.5 max-w-[12rem] rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-semibold text-white shadow">
          {err}
        </span>
      ) : null}
      {open ? (
        <div
          className="absolute left-0 top-full z-[230] mt-1 max-h-48 w-44 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="block w-full px-2 py-1.5 text-left text-[10px] font-semibold text-amber-800 hover:bg-amber-50"
            onClick={() => void patch(null)}
          >
            Limpiar (NULL)
          </button>
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              className={`block w-full truncate px-2 py-1.5 text-left text-[10px] hover:bg-slate-50 ${
                o.id === currentId ? "bg-rimec-azul/10 font-bold text-rimec-azul" : "text-slate-800"
              }`}
              onClick={() => void patch(o)}
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : null}
    </span>
  );
}
