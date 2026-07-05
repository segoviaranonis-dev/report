"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { TicketPosRow } from "@/lib/caja-bazzar/tickets-db";
import {
  calcTotalesFacturaPos,
  facturaDisplayId,
  groupTicketsByFactura,
  titularFacturaPos,
  type FacturaPosHeader,
} from "@/lib/caja-bazzar/group-facturas";
import { formatPrecioGs } from "@/lib/depositos/precio-venta";
import { PosFiLineaRow } from "@/components/caja-bazzar/PosFiLineaRow";

function fmtHora(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

type Props = {
  clienteId: number;
  modo: "operativa" | "facturable" | "metricas";
};

type MetricasState = {
  pares_hoy: number;
  pendientes_caja: number;
  en_bobeda: number;
  movimientos: TicketPosRow[];
};

export function TicketsPanel({ clienteId, modo }: Props) {
  const estado = modo === "facturable" ? "FACTURADO" : modo === "operativa" ? "EMITIDO" : null;
  const [tickets, setTickets] = useState<TicketPosRow[]>([]);
  const [pares, setPares] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cedula, setCedula] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [metricas, setMetricas] = useState<MetricasState | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    if (modo === "metricas") {
      fetch(`/api/tablet-bazzar/metricas?cliente_id=${clienteId}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((data) => {
          if (!data.ok) {
            setError(data.error ?? "Error métricas");
            setMetricas(null);
            return;
          }
          setMetricas({
            pares_hoy: data.pares_hoy ?? 0,
            pendientes_caja: data.pendientes_caja ?? 0,
            en_bobeda: data.en_bobeda ?? 0,
            movimientos: data.movimientos ?? [],
          });
        })
        .catch(() => setError("Error de red"))
        .finally(() => setLoading(false));
      return;
    }

    const q = new URLSearchParams({
      cliente_id: String(clienteId),
      limit: "100",
    });
    if (estado) q.set("estado", estado);
    if (cedula.replace(/\D/g, "").length >= 5) q.set("cedula", cedula.replace(/\D/g, ""));

    fetch(`/api/tablet-bazzar/tickets?${q}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.error && !data.tickets) {
          setError(data.error);
          setTickets([]);
          setPares(0);
          return;
        }
        setTickets(data.tickets ?? []);
        setPares(data.pares ?? 0);
      })
      .catch(() => setError("Error de red"))
      .finally(() => {
        setLoading(false);
      });
  }, [clienteId, estado, cedula, modo]);

  /** Al entrar a la caja: consulta BD pendientes. Actualizar = otro cliente desde tablet. */
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarga solo al cambiar tienda/modo, no por cédula
  }, [clienteId, modo]);

  const facturas = useMemo(
    () => (modo === "operativa" ? groupTicketsByFactura(tickets) : []),
    [tickets, modo],
  );

  const pendientes = useMemo(
    () =>
      tickets.filter((t) => {
        const e = t.estado.toUpperCase();
        return e === "EMITIDO" || e === "PENDIENTE_CAJA" || e === "CSV_DESCARGADO";
      }).length,
    [tickets],
  );
  const enBobeda = useMemo(
    () =>
      tickets.filter((t) => {
        const e = t.estado.toUpperCase();
        return e === "FACTURADO" || e === "PENDIENTE_ENTREGA" || e === "ENTREGADO";
      }).length,
    [tickets],
  );

  async function descargarFactura(f: FacturaPosHeader) {
    setBusyKey(f.key);
    setMsg(null);
    const q = new URLSearchParams({
      cliente_id: String(clienteId),
      estado: "EMITIDO",
      codigos: f.codigos.join(","),
    });
    try {
      const r = await fetch(`/api/tablet-bazzar/tickets/csv?${q}`);
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setMsg(j.error ?? "Error al exportar factura");
        return;
      }
      const blob = await r.blob();
      const dispo = r.headers.get("Content-Disposition") || "";
      const match = /filename="([^"]+)"/.exec(dispo);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = match?.[1] || `${facturaDisplayId(f)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg(`Factura ${facturaDisplayId(f)} descargada · ${f.pares} par${f.pares === 1 ? "" : "es"}`);
    } catch {
      setMsg("Error de red al exportar");
    } finally {
      setBusyKey(null);
    }
  }

  async function guardarTitularFactura(
    f: FacturaPosHeader,
    payload: {
      cedula: string;
      nombre: string;
      apellido: string;
      ruc: string;
      telefono: string;
      email: string;
    },
  ) {
    setBusyKey(f.key);
    setMsg(null);
    try {
      const r = await fetch("/api/tablet-bazzar/tickets/titular", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: clienteId,
          staging_id: f.staging_id,
          codigos: f.codigos,
          cedula: payload.cedula,
          nombre: payload.nombre,
          apellido: payload.apellido || null,
          ruc: payload.ruc || null,
          telefono: payload.telefono || null,
          email: payload.email || null,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setMsg(data.error ?? "No se pudo actualizar titular");
        return;
      }
      setMsg(`Titular actualizado · CI ${payload.cedula.replace(/\D/g, "")}`);
      load();
    } catch {
      setMsg("Error de red");
    } finally {
      setBusyKey(null);
    }
  }

  async function eliminarLineaFactura(f: FacturaPosHeader, codigoTicket: string) {
    if (!window.confirm("¿Quitar este par de la factura? El stock vuelve al depósito.")) return;
    setBusyKey(`${f.key}:${codigoTicket}`);
    setMsg(null);
    try {
      const q = new URLSearchParams({
        cliente_id: String(clienteId),
        codigo_ticket: codigoTicket,
      });
      const r = await fetch(`/api/tablet-bazzar/tickets/linea?${q}`, { method: "DELETE" });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setMsg(data.error ?? "No se pudo quitar el par");
        return;
      }
      setMsg("Par eliminado · stock restaurado");
      load();
    } catch {
      setMsg("Error de red");
    } finally {
      setBusyKey(null);
    }
  }

  async function asignarSerialActiva(f: FacturaPosHeader) {
    setBusyKey(f.key);
    setMsg(null);
    try {
      const r = await fetch("/api/tablet-bazzar/factura-legal/asignar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: clienteId,
          codigos: f.codigos,
          staging_id: f.staging_id,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setMsg(data.error ?? "No se pudo asignar serial legal");
        return;
      }
      setMsg(`Serial legal ${data.serial} asignado · ${facturaDisplayId(f)}`);
      load();
    } catch {
      setMsg("Error de red");
    } finally {
      setBusyKey(null);
    }
  }

  async function enviarFacturaEmpaque(f: FacturaPosHeader) {
    const tot = calcTotalesFacturaPos(f);
    const montoTxt = formatPrecioGs(tot.monto);
    const ok = window.confirm(
      `¿Enviar a Bóveda ORO?\n\n${tot.articulos} par${tot.articulos === 1 ? "" : "es"} · ${montoTxt}\n\nCada artículo pasa a bobeda_venta_pos con pilares, snapshot y precio — base para análisis de ventas y Empaque.`,
    );
    if (!ok) return;
    setBusyKey(f.key);
    setMsg(null);
    try {
      const r = await fetch("/api/tablet-bazzar/tickets/enviar-empaque", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: clienteId,
          codigos: f.codigos,
          staging_id: f.staging_id,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setMsg(data.error ?? "No se pudo enviar a Empaque");
        return;
      }
      setMsg(
        `Factura ${facturaDisplayId(f)} → Bóveda ORO (${data.inserted} par${data.inserted === 1 ? "" : "es"} · análisis ventas)`,
      );
      load();
    } catch {
      setMsg("Error de red");
    } finally {
      setBusyKey(null);
    }
  }

  if (modo === "metricas") {
    const m = metricas ?? { pares_hoy: 0, pendientes_caja: 0, en_bobeda: 0, movimientos: [] };
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Pares hoy" value={m.pares_hoy} accent />
        <MetricCard label="Pendientes caja" value={m.pendientes_caja} />
        <MetricCard label="En Bobeda (vista)" value={m.en_bobeda} />
        <div className="sm:col-span-3 flex justify-end">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold hover:border-bazzar-naranja disabled:opacity-50"
          >
            {loading ? "…" : "Actualizar"}
          </button>
        </div>
        {error && <p className="sm:col-span-3 text-sm text-red-700">{error}</p>}
        <div className="sm:col-span-3 rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="mb-3 font-semibold text-neutral-ink">Últimos movimientos</h3>
          {loading ? (
            <p className="text-neutral-muted">Cargando…</p>
          ) : m.movimientos.length === 0 ? (
            <p className="text-neutral-muted">Sin movimientos hoy en Bobeda.</p>
          ) : (
            <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
              {m.movimientos.map((t) => (
                <li key={t.codigo_ticket} className="flex justify-between gap-2 border-b border-slate-100 py-2">
                  <span>
                    {fmtHora(t.created_at)} · {t.linea_codigo}.{t.referencia_codigo} G.{t.grada}
                  </span>
                  <span className="shrink-0 text-neutral-muted">{t.estado}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold text-neutral-ink">
            {modo === "operativa" ? "Bandeja · facturas internas POS" : "Archivo facturado"}
          </h2>
          <p className="text-sm text-neutral-muted">
            {modo === "operativa"
              ? "Consulta automática al entrar · Actualizar bandeja cuando llegue otro cliente desde tablet"
              : `${pares} par${pares === 1 ? "" : "es"} · ${tickets.length} línea${tickets.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            inputMode="numeric"
            placeholder="Cédula cliente"
            value={cedula}
            onChange={(e) => setCedula(e.target.value.replace(/\D/g, ""))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-lg bg-[#002B4E] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {loading ? "…" : "Actualizar bandeja"}
          </button>
        </div>
      </div>

      {msg && <p className="mb-3 rounded-lg bg-bazzar-naranja/10 px-3 py-2 text-sm text-bazzar-naranja">{msg}</p>}
      {error && <p className="mb-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="text-neutral-muted">Consultando bandeja en base de datos…</p>
      ) : modo === "operativa" ? (
        facturas.length === 0 ? (
          <p className="text-neutral-muted">Bandeja vacía — sin facturas pendientes en caja.</p>
        ) : (
          <ul className="space-y-4">
            {facturas.map((f) => (
              <FacturaPosCard
                key={f.key}
                factura={f}
                busy={busyKey === f.key}
                busyLineaPrefix={busyKey?.startsWith(`${f.key}:`) ? busyKey : null}
                onDescargar={() => void descargarFactura(f)}
                onFacturar={() => void enviarFacturaEmpaque(f)}
                onAsignarSerial={() => void asignarSerialActiva(f)}
                onGuardarTitular={(payload) => void guardarTitularFactura(f, payload)}
                onEliminarLinea={(codigo) => void eliminarLineaFactura(f, codigo)}
              />
            ))}
          </ul>
        )
      ) : tickets.length === 0 ? (
        <p className="text-neutral-muted">Sin pares en Bobeda pendientes de entrega hoy.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wide text-neutral-muted">
                <th className="py-2 pr-3">Hora</th>
                <th className="py-2 pr-3">Cédula</th>
                <th className="py-2 pr-3">Molécula</th>
                <th className="py-2 pr-3">Grada</th>
                <th className="py-2 pr-3">Vendedor</th>
                <th className="py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.codigo_ticket} className="border-b border-slate-100">
                  <td className="py-2.5 pr-3 tabular-nums text-neutral-muted">{fmtHora(t.created_at)}</td>
                  <td className="py-2.5 pr-3">{t.cedula_cliente ?? "—"}</td>
                  <td className="py-2.5 pr-3 font-medium">
                    {t.linea_codigo ?? "—"}
                    {t.referencia_codigo ? `.${t.referencia_codigo}` : ""}
                  </td>
                  <td className="py-2.5 pr-3">G.{t.grada}</td>
                  <td className="py-2.5 pr-3">{t.vendedor_nombre ?? "—"}</td>
                  <td className="py-2.5">{t.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Acordeón bandeja cajero — titular editable · quitar pares (sin agregar). */
function FacturaPosCard({
  factura: f,
  busy,
  busyLineaPrefix,
  onDescargar,
  onFacturar,
  onAsignarSerial,
  onGuardarTitular,
  onEliminarLinea,
}: {
  factura: FacturaPosHeader;
  busy: boolean;
  busyLineaPrefix: string | null;
  onDescargar: () => void;
  onFacturar: () => void;
  onAsignarSerial: () => void;
  onGuardarTitular: (payload: {
    cedula: string;
    nombre: string;
    apellido: string;
    ruc: string;
    telefono: string;
    email: string;
  }) => void;
  onEliminarLinea: (codigoTicket: string) => void;
}) {
  const id = facturaDisplayId(f);
  const titular = titularFacturaPos(f);
  const totales = calcTotalesFacturaPos(f);
  const montoParcial = totales.monto != null && totales.lineasConPrecio < totales.articulos;
  const sinNombre = !f.nombre_cliente?.trim() || f.nombre_cliente.startsWith("CI ");
  const partes = (f.nombre_cliente?.trim() && !f.nombre_cliente.startsWith("CI ")
    ? f.nombre_cliente
    : titular.replace(/^Cliente CI \d+$/, "").trim() || titular
  ).split(/\s+/);
  const [editTitular, setEditTitular] = useState(false);
  const [cedulaEdit, setCedulaEdit] = useState(f.cedula_cliente ?? "");
  const [rucEdit, setRucEdit] = useState(f.ruc_cliente ?? "");
  const [telefonoEdit, setTelefonoEdit] = useState(f.telefono_cliente ?? "");
  const [emailEdit, setEmailEdit] = useState(f.email_cliente ?? "");
  const [nombreEdit, setNombreEdit] = useState(partes[0] ?? "");
  const [apellidoEdit, setApellidoEdit] = useState(partes.slice(1).join(" "));

  useEffect(() => {
    setCedulaEdit(f.cedula_cliente ?? "");
    setRucEdit(f.ruc_cliente ?? "");
    setTelefonoEdit(f.telefono_cliente ?? "");
    setEmailEdit(f.email_cliente ?? "");
    setNombreEdit(partes[0] ?? "");
    setApellidoEdit(partes.slice(1).join(" "));
    setEditTitular(false);
  }, [f.key, f.cedula_cliente, f.ruc_cliente, f.telefono_cliente, f.email_cliente, f.nombre_cliente]);

  return (
    <li className="overflow-hidden rounded-xl border-2 border-neutral-300 bg-card-bg shadow-md">
      <details open className="group">
        <summary className="cursor-pointer list-none border-b-2 border-rimec-azul/15 bg-gradient-to-r from-rimec-azul/5 to-transparent px-4 py-4 sm:px-5 [&::-webkit-details-marker]:hidden">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-bold uppercase tracking-widest text-rimec-azul">Factura interna POS</p>
                <span className="font-mono text-xs font-bold text-rimec-azul-dark">{id}</span>
                <span className="text-xs text-neutral-muted group-open:hidden">· tocá para ver ítems</span>
              </div>
              <div className="mt-2 rounded-xl border-2 border-rimec-azul/40 bg-white px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-rimec-azul">
                  Factura legal · bóveda ORO
                </p>
                <p className="mt-1 font-mono text-xl font-black uppercase tracking-wide text-rimec-azul-dark">
                  {f.numero_factura_legal?.trim() || "— sin serial —"}
                </p>
                {!f.numero_factura_legal?.trim() && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={(e) => {
                      e.preventDefault();
                      onAsignarSerial();
                    }}
                    className="mt-2 rounded-lg border-2 border-rimec-azul bg-rimec-azul/10 px-3 py-1.5 text-xs font-bold text-rimec-azul disabled:opacity-50"
                  >
                    Usar serial Activa (barra superior)
                  </button>
                )}
              </div>

              <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-rimec-azul">
                Cliente · facturar a nombre de
              </p>
              <p className="mt-1 break-words font-serif text-3xl font-bold leading-tight text-rimec-azul-dark sm:text-4xl">
                {titular}
              </p>
              {f.cedula_cliente && !editTitular && (
                <p className="mt-1 text-sm font-semibold tabular-nums text-neutral-600">
                  CI {f.cedula_cliente}
                  {f.ruc_cliente ? (
                    <span className="ml-3 text-neutral-500">· RUC {f.ruc_cliente}</span>
                  ) : null}
                </p>
              )}
              {!editTitular && (
                <div className="mt-3 rounded-xl border-[3px] border-sky-400 bg-sky-50 px-3 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-sky-900">
                    Contacto · confirmá con el cliente
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div>
                      <p className="text-[9px] font-bold uppercase text-sky-800">Celular</p>
                      <p className="text-xl font-black tabular-nums text-sky-950">
                        {f.telefono_cliente?.trim() || "— sin celular —"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase text-sky-800">Correo</p>
                      <p className="break-all text-base font-bold text-sky-950">
                        {f.email_cliente?.trim() || "— sin correo —"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {editTitular && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase text-neutral-muted">Cédula factura</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={cedulaEdit}
                      onChange={(e) => setCedulaEdit(e.target.value.replace(/\D/g, ""))}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase text-neutral-muted">RUC</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={rucEdit}
                      onChange={(e) => setRucEdit(e.target.value.replace(/\D/g, ""))}
                      placeholder="Opcional"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase text-neutral-muted">Nombre</span>
                    <input
                      type="text"
                      value={nombreEdit}
                      onChange={(e) => setNombreEdit(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase text-neutral-muted">Apellido</span>
                    <input
                      type="text"
                      value={apellidoEdit}
                      onChange={(e) => setApellidoEdit(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase text-sky-800">Celular</span>
                    <input
                      type="tel"
                      inputMode="tel"
                      value={telefonoEdit}
                      onChange={(e) => setTelefonoEdit(e.target.value)}
                      className="mt-1 w-full rounded-lg border-2 border-sky-300 px-3 py-2 text-lg font-bold tabular-nums"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase text-sky-800">Correo</span>
                    <input
                      type="email"
                      inputMode="email"
                      value={emailEdit}
                      onChange={(e) => setEmailEdit(e.target.value)}
                      placeholder="Opcional"
                      className="mt-1 w-full rounded-lg border-2 border-sky-300 px-3 py-2 text-base font-semibold"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2 sm:col-span-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        onGuardarTitular({
                          cedula: cedulaEdit,
                          nombre: nombreEdit,
                          apellido: apellidoEdit,
                          ruc: rucEdit,
                          telefono: telefonoEdit,
                          email: emailEdit,
                        })
                      }
                      className="rounded-lg bg-rimec-azul px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                    >
                      Guardar titular
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditTitular(false)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-neutral-600"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              <p className="mt-2 text-sm text-neutral-muted">
                {f.marca} · {fmtHora(f.created_at)}
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-stretch gap-2 sm:w-[220px]">
              <span className="self-start rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase text-amber-900 sm:self-end">
                Pendiente caja
              </span>

              <div
                className="rounded-2xl border-[3px] border-bazzar-naranja bg-gradient-to-br from-orange-50 via-white to-orange-100/80 px-4 py-4 text-center shadow-lg ring-2 ring-bazzar-naranja/15"
                role="status"
                aria-label={`Total ${formatPrecioGs(totales.monto)}, ${totales.articulos} artículos`}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-bazzar-naranja-dark">
                  Total factura
                </p>
                <p className="mt-1 text-4xl font-black tabular-nums leading-none text-bazzar-naranja-dark sm:text-[2.75rem]">
                  {formatPrecioGs(totales.monto)}
                </p>
                {montoParcial && (
                  <p className="mt-1 text-[10px] font-semibold text-amber-800">
                    Parcial · {totales.lineasConPrecio}/{totales.articulos} con precio
                  </p>
                )}
                <div className="mt-3 border-t-2 border-bazzar-naranja/25 pt-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rimec-azul">
                    Artículos
                  </p>
                  <p className="mt-0.5 text-3xl font-black tabular-nums leading-none text-rimec-azul">
                    {totales.articulos}
                    <span className="ml-1 text-sm font-bold uppercase text-rimec-azul/70">
                      par{totales.articulos === 1 ? "" : "es"}
                    </span>
                  </p>
                </div>
              </div>

              <span
                className="hidden self-end text-lg leading-none text-neutral-400 transition group-open:rotate-180 sm:inline-block"
                aria-hidden
              >
                ▾
              </span>
            </div>
          </div>
        </summary>

        <div className="border-b border-rimec-azul/10 bg-gradient-to-r from-rimec-azul/5 to-transparent px-4 py-4 sm:px-5">
          {sinNombre && (
            <p className="mb-3 text-xs font-medium text-amber-800">
              Preguntá al cliente su nombre antes de facturar.
            </p>
          )}

          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-muted">Vendedor</p>
              <p className="font-semibold text-neutral-ink">{f.vendedor_nombre ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-muted">Marca · hora</p>
              <p className="font-semibold text-neutral-ink">
                {f.marca} · {fmtHora(f.created_at)}
              </p>
            </div>
          </div>

          <p className="mt-3 max-w-xl rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold leading-snug text-slate-700">
            1) Corregí titular/CI · 2) CSV → facturador · 3) Cobrá · 4){" "}
            <strong className="text-rimec-azul">Enviar a Empaque</strong> → Bóveda ORO (permanente).
            Podés quitar pares antes del paso 4. Agregar pares solo en tablet.
          </p>

          <div className="mt-4 space-y-3 border-t border-neutral-200/80 pt-4">
            <div className="rounded-xl border-2 border-emerald-600/40 bg-gradient-to-r from-emerald-50 to-white p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-800">
                Paso clave · Bóveda ORO
              </p>
              <p className="mt-1 text-sm text-emerald-950">
                Registro permanente en <span className="font-mono text-xs">bobeda_venta_pos</span> — cada par con
                L·R·material·color·grada, foto, precio y titular congelados para análisis de ventas.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={(e) => {
                  e.preventDefault();
                  onFacturar();
                }}
                className="mt-3 w-full rounded-xl bg-emerald-700 px-5 py-3.5 text-base font-black uppercase tracking-wide text-white shadow-md hover:bg-emerald-800 disabled:opacity-50 sm:w-auto"
              >
                {busy ? "Enviando…" : "Enviar a Empaque → Bóveda ORO"}
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
            {!editTitular && (
              <button
                type="button"
                disabled={busy}
                onClick={(e) => {
                  e.preventDefault();
                  setEditTitular(true);
                }}
                className="rounded-lg border-2 border-rimec-azul px-4 py-2 text-sm font-bold text-rimec-azul disabled:opacity-50"
              >
                Editar titular / CI
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                onDescargar();
              }}
              className="rounded-lg bg-bazzar-naranja px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              Descargar factura (CSV)
            </button>
            </div>
          </div>
        </div>

        <div className="space-y-2 bg-neutral-50/80 p-4 sm:p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-muted">
            Ítems · {f.lineas.length} línea{f.lineas.length === 1 ? "" : "s"} · quitar par permitido
          </p>
          {f.lineas.map((t) => (
            <PosFiLineaRow
              key={t.codigo_ticket}
              linea={t}
              eliminando={busyLineaPrefix === `${f.key}:${t.codigo_ticket}`}
              onEliminar={() => onEliminarLinea(t.codigo_ticket)}
            />
          ))}
        </div>
      </details>
    </li>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className={`rounded-2xl border-2 p-5 ${accent ? "border-bazzar-naranja bg-bazzar-naranja/5" : "border-slate-200 bg-white"}`}
    >
      <p className="text-xs font-bold uppercase tracking-wide text-neutral-muted">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${accent ? "text-bazzar-naranja" : "text-neutral-ink"}`}>
        {value.toLocaleString("es-PY")}
      </p>
    </div>
  );
}
