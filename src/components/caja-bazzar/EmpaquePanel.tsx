"use client";

import { useCallback, useEffect, useState } from "react";
import type { EmpaqueFactura, EmpaqueLinea } from "@/lib/caja-bazzar/empaque-db";
import { ordenarLineasEmpaque } from "@/lib/caja-bazzar/empaque-sort";

function aplicarControlLocal(facturas: EmpaqueFactura[], codigo: string): EmpaqueFactura[] {
  return facturas.map((f) => {
    const hit = f.lineas.find((l) => l.codigo_oro === codigo);
    if (!hit || hit.controlado) return f;
    return {
      ...f,
      controlados: f.controlados + 1,
      lineas: ordenarLineasEmpaque(
        f.lineas.map((l) => (l.codigo_oro === codigo ? { ...l, controlado: true } : l)),
      ),
    };
  });
}

function fmtElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function useCronometro(inicioIso: string | null): string | null {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!inicioIso) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [inicioIso]);
  if (!inicioIso) return null;
  void tick;
  return fmtElapsed(Date.now() - new Date(inicioIso).getTime());
}

type Props = { clienteId: number; modoCronometro?: boolean };

export function EmpaquePanel({ clienteId, modoCronometro = true }: Props) {
  const [facturas, setFacturas] = useState<EmpaqueFactura[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [sellarKey, setSellarKey] = useState<string | null>(null);
  const [nombreSellar, setNombreSellar] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/tablet-bazzar/empaque/tickets?cliente_id=${clienteId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) {
          setError(data.error ?? "Error al cargar Empaque");
          setFacturas([]);
          return;
        }
        setFacturas(data.facturas ?? []);
      })
      .catch(() => setError("Error de red"))
      .finally(() => setLoading(false));
  }, [clienteId]);

  useEffect(() => {
    load();
  }, [load]);

  async function controlar(codigo: string) {
    setBusy(codigo);
    setMsg(null);
    setFacturas((prev) => aplicarControlLocal(prev, codigo));
    try {
      const r = await fetch("/api/tablet-bazzar/empaque/controlar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cliente_id: clienteId, codigo_oro: codigo }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setMsg(data.error ?? "No se pudo marcar controlado");
        load();
        return;
      }
    } catch {
      setMsg("Error de red");
      load();
    } finally {
      setBusy(null);
    }
  }

  async function sellar(f: EmpaqueFactura) {
    setBusy(f.key);
    setMsg(null);
    try {
      const r = await fetch("/api/tablet-bazzar/empaque/sellar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: clienteId,
          staging_id: f.staging_id,
          nombre_confirmado: nombreSellar.trim() || f.nombre_cliente,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setMsg(data.error ?? "No se pudo sellar factura");
        return;
      }
      setMsg(`Factura sellada · ${data.entregados} par(es) → Bóveda de oro (ENTREGADO)`);
      setSellarKey(null);
      setNombreSellar("");
      load();
    } catch {
      setMsg("Error de red");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold text-neutral-ink">Empaque · Bobeda pendiente</h2>
          <p className="text-sm text-neutral-muted">
            Control artículo por artículo · sellar factura al entregar mercadería
            {modoCronometro ? " · cronómetro de entrega activo" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-lg bg-bazzar-naranja px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {loading ? "…" : "Actualizar"}
        </button>
      </div>

      {msg && <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{msg}</p>}
      {error && <p className="mb-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="text-neutral-muted">Consultando Bobeda…</p>
      ) : facturas.length === 0 ? (
        <p className="text-neutral-muted">Sin facturas PENDIENTE_ENTREGA en Empaque.</p>
      ) : (
        <ul className="space-y-3">
          {facturas.map((f) => (
            <EmpaqueFacturaCard
              key={f.key}
              factura={f}
              busy={busy}
              sellarKey={sellarKey}
              nombreSellar={nombreSellar}
              modoCronometro={modoCronometro}
              onControlar={(c) => void controlar(c)}
              onOpenSellar={() => {
                setSellarKey(f.key);
                setNombreSellar(f.nombre_cliente);
              }}
              onCancelSellar={() => {
                setSellarKey(null);
                setNombreSellar("");
              }}
              onChangeNombreSellar={setNombreSellar}
              onSellar={() => void sellar(f)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function EmpaqueFacturaCard({
  factura: f,
  busy,
  sellarKey,
  nombreSellar,
  modoCronometro,
  onControlar,
  onOpenSellar,
  onCancelSellar,
  onChangeNombreSellar,
  onSellar,
}: {
  factura: EmpaqueFactura;
  busy: string | null;
  sellarKey: string | null;
  nombreSellar: string;
  modoCronometro: boolean;
  onControlar: (codigo: string) => void;
  onOpenSellar: () => void;
  onCancelSellar: () => void;
  onChangeNombreSellar: (v: string) => void;
  onSellar: () => void;
}) {
  const elapsed = useCronometro(modoCronometro ? f.created_at : null);
  const listo = f.controlados >= f.pares && f.pares > 0;
  const sellando = sellarKey === f.key;

  return (
    <li className="overflow-hidden rounded-xl border-2 border-slate-200 bg-white shadow-sm">
      <details open className="group">
        <summary className="cursor-pointer list-none px-4 py-4 [&::-webkit-details-marker]:hidden">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-serif text-2xl font-bold leading-tight text-rimec-azul-dark sm:text-3xl">
                {f.nombre_cliente}
              </p>
              {f.marca && (
                <p className="mt-1 text-xs font-bold uppercase tracking-widest text-bazzar-naranja">{f.marca}</p>
              )}
              <p className="mt-1 text-xs text-neutral-muted">
                {f.controlados}/{f.pares} controlados · FI_FA {f.numero_fi_fa ?? f.staging_id ?? "—"}
              </p>
            </div>
            <div className="flex flex-wrap items-start gap-3">
              <div className="rounded-xl border-2 border-slate-300 bg-slate-50 px-3 py-2 text-right">
                <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-muted">Factura legal</p>
                <p className="font-mono text-base font-black tabular-nums text-neutral-ink">
                  {f.numero_factura_legal?.trim() || "— pendiente —"}
                </p>
              </div>
              {modoCronometro && elapsed && (
                <div className="rounded-xl border-2 border-bazzar-naranja bg-bazzar-naranja/10 px-4 py-2 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-bazzar-naranja">Tiempo entrega</p>
                  <p className="font-mono text-3xl font-black tabular-nums text-bazzar-naranja">{elapsed}</p>
                </div>
              )}
            </div>
          </div>
        </summary>

        <div className="border-t border-slate-100 bg-neutral-50/80 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {f.lineas.map((linea, idx) => (
              <EmpaqueItemTile
                key={linea.codigo_oro}
                linea={linea}
                marca={linea.marca ?? f.marca}
                esSiguiente={!linea.controlado && f.lineas.findIndex((l) => !l.controlado) === idx}
                busy={busy === linea.codigo_oro}
                onControlar={() => onControlar(linea.codigo_oro)}
              />
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-200 pt-4">
            {!sellando ? (
              <button
                type="button"
                disabled={!listo || busy === f.key}
                onClick={onOpenSellar}
                className="rounded-lg bg-rimec-azul px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                Sellar y entregar · Bóveda de oro
              </button>
            ) : (
              <>
                <label className="block min-w-[220px] flex-1">
                  <span className="text-[10px] font-bold uppercase text-neutral-muted">
                    Confirmá nombre en copia factura
                  </span>
                  <input
                    type="text"
                    value={nombreSellar}
                    onChange={(e) => onChangeNombreSellar(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
                  />
                </label>
                <button
                  type="button"
                  disabled={busy === f.key}
                  onClick={onSellar}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  Confirmar entrega
                </button>
                <button
                  type="button"
                  onClick={onCancelSellar}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
                >
                  Cancelar
                </button>
              </>
            )}
            {!listo && (
              <p className="text-xs font-medium text-amber-800">
                Marcá controlado cada artículo antes de sellar.
              </p>
            )}
          </div>
        </div>
      </details>
    </li>
  );
}

function EmpaqueItemTile({
  linea,
  marca,
  esSiguiente,
  busy,
  onControlar,
}: {
  linea: EmpaqueLinea;
  marca: string | null;
  esSiguiente: boolean;
  busy: boolean;
  onControlar: () => void;
}) {
  const lc = linea.linea_codigo ?? "?";
  const rc = linea.referencia_codigo ?? "?";
  const img = linea.imagen_url?.trim();

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border-2 bg-white shadow-sm transition-all ${
        linea.controlado
          ? "border-emerald-400 opacity-75 ring-2 ring-emerald-100"
          : esSiguiente
            ? "border-bazzar-naranja ring-2 ring-bazzar-naranja/30"
            : "border-slate-200"
      }`}
    >
      <div className="relative aspect-square w-full bg-neutral-50">
        {img ? (
          <img src={img} alt={`${lc}.${rc}`} className="h-full w-full object-contain p-2" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center font-mono text-xs text-slate-400">
            {lc}.{rc}
          </div>
        )}
        {esSiguiente && !linea.controlado && (
          <span className="absolute left-2 top-2 rounded-full bg-bazzar-naranja px-2 py-0.5 text-[9px] font-bold text-white">
            SIGUIENTE
          </span>
        )}
        {linea.controlado && (
          <span className="absolute right-2 top-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
            OK
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {marca && (
          <p className="text-[9px] font-bold uppercase tracking-widest text-bazzar-naranja">{marca}</p>
        )}
        <p className="text-sm font-bold text-rimec-azul-dark">
          L{lc} · R{rc}
        </p>
        <p className="text-xs text-neutral-600">
          {linea.descp_color || linea.color_code || "—"}
          {linea.descp_material ? ` · ${linea.descp_material}` : ""}
        </p>
        <div className="rounded-lg border-2 border-bazzar-naranja bg-gradient-to-b from-orange-50 to-white px-2 py-1.5 text-center">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-bazzar-naranja">Nº</p>
          <p className="font-mono text-2xl font-black leading-none tabular-nums text-bazzar-naranja-dark">
            {linea.grada}
          </p>
        </div>
        {!linea.controlado && (
          <button
            type="button"
            disabled={busy}
            onClick={onControlar}
            className="mt-auto rounded-lg border-2 border-bazzar-naranja bg-bazzar-naranja/10 px-2 py-2 text-[10px] font-bold uppercase text-bazzar-naranja disabled:opacity-50"
          >
            {busy ? "…" : "Marcar controlado"}
          </button>
        )}
      </div>
    </div>
  );
}
