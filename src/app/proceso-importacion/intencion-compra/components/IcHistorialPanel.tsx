"use client";

import { useCallback, useEffect, useState } from "react";
import type { IcHistorialRow } from "@/lib/intencion-compra/pendientes-query";
import { FECHA_DE_EMBARQUE_LABEL } from "@/lib/intencion-compra/quincena-arribo";

export function IcHistorialPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ics, setIcs] = useState<IcHistorialRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/proceso-importacion/intencion-compra/historial", { credentials: "same-origin" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setIcs(data.ics ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="py-8 text-center text-sm text-slate-500">Cargando historial…</p>;
  if (error) return <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>;

  if (ics.length === 0) {
    return (
      <p className="mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-12 text-center text-slate-500">
        Aún no hay intenciones autorizadas.
      </p>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/90">
            <tr>
              {["IC Nro.", "Tipo", "Categoría", "Marca", "Cliente", "Vendedor", FECHA_DE_EMBARQUE_LABEL, "Pares", "Neto (Gs.)", "Evento", "Estado"].map(
                (h) => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ics.map((r) => (
              <tr key={r.numero_registro} className="hover:bg-slate-50/80">
                <td className="whitespace-nowrap px-3 py-2 font-mono font-bold text-rimec-azul-dark">{r.numero_registro}</td>
                <td className="px-3 py-2">{r.tipo}</td>
                <td className="px-3 py-2">{r.categoria}</td>
                <td className="px-3 py-2 font-medium">{r.marca}</td>
                <td className="max-w-[120px] truncate px-3 py-2 text-slate-600">{r.cliente}</td>
                <td className="px-3 py-2 text-slate-600">{r.vendedor}</td>
                <td className="px-3 py-2 text-xs">{r.fecha_embarque ?? "—"}</td>
                <td className="px-3 py-2 text-right font-mono">{r.pares.toLocaleString("es-PY")}</td>
                <td className="px-3 py-2 text-right font-mono">{r.monto_neto.toLocaleString("es-PY")}</td>
                <td className="max-w-[140px] truncate px-3 py-2 text-xs">{r.evento_precio ?? "—"}</td>
                <td className="px-3 py-2 text-xs font-semibold">{r.estado.replace(/_/g, " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
