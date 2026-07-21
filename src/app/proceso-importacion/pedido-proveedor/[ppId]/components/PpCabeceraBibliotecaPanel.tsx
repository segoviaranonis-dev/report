"use client";

import { useCallback, useEffect, useState } from "react";
import { CATEGORIA_PROGRAMADO_ID } from "@/lib/intencion-compra/categoria-ic";

type BibliotecaOpt = { id: number; nombre: string; casos_count: number };

type Props = {
  ppId: number;
  cabeceraEditable: boolean;
  categoriaId: number | null;
  bibliotecaPrecioId: number | null;
  bibliotecaNombre: string | null;
  proveedorMotorId: number;
  onChanged: (msg: string, redirectTab?: string, adminIc?: { ics: unknown[]; prefacturas: unknown[] }) => void;
};

export function PpCabeceraBibliotecaPanel({
  ppId,
  cabeceraEditable,
  categoriaId,
  bibliotecaPrecioId,
  bibliotecaNombre,
  proveedorMotorId,
  onChanged,
}: Props) {
  const [opciones, setOpciones] = useState<BibliotecaOpt[]>([]);
  const [selId, setSelId] = useState(bibliotecaPrecioId ?? 0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmStep, setConfirmStep] = useState<0 | 1>(0);

  useEffect(() => {
    setSelId(bibliotecaPrecioId ?? 0);
    setConfirmStep(0);
  }, [bibliotecaPrecioId]);

  const loadOpciones = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ proveedor_id: String(proveedorMotorId || 654) });
      const r = await fetch(`/api/motor-precios/biblioteca?${qs}`, { credentials: "same-origin" });
      const j = await r.json();
      const list = (j.bibliotecas ?? []) as BibliotecaOpt[];
      setOpciones(list.filter((b) => (b.casos_count ?? 0) > 0));
    } catch {
      setOpciones([]);
    } finally {
      setLoading(false);
    }
  }, [proveedorMotorId]);

  useEffect(() => {
    void loadOpciones();
  }, [loadOpciones]);

  async function ejecutarCambio(confirmarDestructivo: boolean) {
    if (!selId || selId === bibliotecaPrecioId) return;
    setBusy(true);
    try {
      const r = await fetch(
        `/api/proceso-importacion/pedido-proveedor/${ppId}/cambiar-biblioteca`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            biblioteca_precio_id: selId,
            confirmar_destructivo: confirmarDestructivo,
          }),
        },
      );
      const j = await r.json();
      if (j.requiere_confirmacion) {
        setConfirmStep(1);
        onChanged(
          j.error ??
            `Hay ${j.n_fi ?? "?"} FI — confirmá el cambio total para continuar.`,
        );
        return;
      }
      if (!r.ok || !j.ok) {
        onChanged(j.error ?? "Error al cambiar biblioteca.");
        return;
      }
      setConfirmStep(0);
      const tab =
        categoriaId === CATEGORIA_PROGRAMADO_ID ? "admin-ic" : "ics";
      const casos = (j.casos_pf as string[] | undefined)?.join(", ") ?? "—";
      onChanged(
        `Biblioteca «${j.biblioteca_nombre}» · ${j.n_fi_borradas ?? 0} FI eliminada(s) · ${j.n_pf ?? 0} pre-facturas (BCL) · snapshot ${j.proforma_snapshot ? "OK" : "PPD"} · casos: ${casos}`,
        tab,
        j.admin_ic,
      );
    } catch {
      onChanged("Error de red al cambiar biblioteca.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border-2 border-amber-200 bg-amber-50/70 p-4 shadow-sm">
      <dt className="text-xs font-black uppercase tracking-wider text-amber-900">
        Biblioteca de casos · política
      </dt>
      <dd className="mt-1 space-y-2">
        <p className="min-h-8 text-lg font-black leading-tight text-slate-950">
          {bibliotecaNombre ? (
            <>
              {bibliotecaNombre}
              {bibliotecaPrecioId ? (
                <span className="ml-1 font-normal text-slate-500">#{bibliotecaPrecioId}</span>
              ) : null}
            </>
          ) : (
            <span className="font-normal text-amber-800">Sin biblioteca en cabecera — elegí una</span>
          )}
        </p>
        {cabeceraEditable ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
            <select
              className="min-w-0 flex-1 rounded-lg border-2 border-amber-300 bg-white px-3 py-2 text-sm font-bold"
              value={selId}
              disabled={loading || busy}
              onChange={(e) => {
                setSelId(Number(e.target.value));
                setConfirmStep(0);
              }}
            >
              <option value={0}>— Elegir biblioteca —</option>
              {opciones.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre} · {b.casos_count} casos
                </option>
              ))}
            </select>
            {confirmStep === 0 ? (
              <button
                type="button"
                disabled={busy || !selId || selId === bibliotecaPrecioId}
                onClick={() => void ejecutarCambio(false)}
                className="rounded-lg border-2 border-violet-600 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-950 hover:bg-violet-100 disabled:opacity-50"
              >
                {busy ? "Procesando…" : "Cambiar biblioteca"}
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void ejecutarCambio(true)}
                className="rounded-lg border-2 border-red-600 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-900 hover:bg-red-100 disabled:opacity-50"
              >
                {busy ? "Borrando FI…" : "Confirmar · borrar FI y recalcular proforma"}
              </button>
            )}
          </div>
        ) : null}
        {confirmStep === 1 ? (
          <p className="rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-[10px] font-bold text-red-900">
            La biblioteca aún no cambió — confirmá para borrar todas las FI y recalcular pre-facturas con la BCL nueva.
          </p>
        ) : null}
        <p className="text-[10px] leading-snug text-slate-500">
          Política (Corazón 1). El listado de precios se asigna manualmente por IC / pre-factura / FI — no en cabecera.
        </p>
      </dd>
    </div>
  );
}
