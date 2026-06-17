"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TIPO_V2_LABELS, parseTipoV2Id } from "@/lib/pilares/constants";
import type { TipoV2Id } from "@/lib/pilares/types";

export function cap(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function Pill({
  active,
  onClick,
  disabled,
  involved = true,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  /** Si false, la opción no aplica al subconjunto filtrado (atenuada). */
  involved?: boolean;
  children: React.ReactNode;
}) {
  const dimmed = !involved && !active;
  return (
    <button
      type="button"
      disabled={disabled || dimmed}
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "border-report-navy bg-report-navy text-white"
          : involved
            ? "border-report-rule bg-white text-report-ink hover:bg-report-paper2"
            : "cursor-not-allowed border-report-rule/50 bg-neutral-50 text-neutral-400 opacity-50"
      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
    >
      {children}
    </button>
  );
}

export function FiltroRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-report-muted">
        {label}
      </span>
      {children}
    </div>
  );
}

export function TipoV2FiltroRow() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tipoV2Id = parseTipoV2Id(searchParams.get("tipo_v2_id")) as TipoV2Id;

  const setTipoV2 = (next: TipoV2Id) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tipo_v2_id", String(next));
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <FiltroRow label="Tipo">
      {([1, 2] as const).map((id) => (
        <Pill key={id} active={tipoV2Id === id} onClick={() => setTipoV2(id)}>
          {TIPO_V2_LABELS[id]}
        </Pill>
      ))}
    </FiltroRow>
  );
}

export function PilaresFiltrosShell({
  children,
  loading,
}: {
  children: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="mb-4 space-y-4 rounded-2xl border border-report-rule bg-white p-4 shadow-sm">
      {children}
      {loading ? <p className="text-xs text-report-muted">Actualizando grilla…</p> : null}
    </div>
  );
}
