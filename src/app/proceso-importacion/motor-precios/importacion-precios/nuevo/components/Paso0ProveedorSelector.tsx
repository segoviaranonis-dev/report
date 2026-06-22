"use client";

import type { MotorProveedorMeta } from "@/lib/motor-precios/proveedores-meta";

export type ProveedorOption = {
  id: number;
  codigo: string;
  nombre: string;
  meta: MotorProveedorMeta | null;
};

type Props = {
  proveedores: ProveedorOption[];
  proveedorId: string;
  disabled?: boolean;
  onChange: (id: string) => void;
};

export function Paso0ProveedorSelector({ proveedores, proveedorId, disabled, onChange }: Props) {
  const sel = proveedores.find((p) => p.id === Number(proveedorId));
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-semibold text-slate-700">Proveedor</span>
      <select
        className="w-full rounded-lg border border-slate-300 px-3 py-2"
        value={proveedorId}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {proveedores.map((p) => (
          <option key={p.id} value={p.id}>
            {p.id} · {p.nombre}
            {!p.meta?.paso0Report ? " (solo Streamlit)" : ""}
          </option>
        ))}
      </select>
      {sel?.meta ? (
        <p className="mt-2 text-xs text-slate-500">{sel.meta.listado}</p>
      ) : null}
    </label>
  );
}
