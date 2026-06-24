"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import { calcularNeto } from "@/lib/intencion-compra/calcular-neto";
import type { IcCatalogos, LineaConCaso } from "@/lib/intencion-compra/catalogos-query";
import { FECHA_DE_EMBARQUE_LABEL } from "@/lib/intencion-compra/quincena-arribo";
import { INTENCION_COMPRA, INTENCION_COMPRA_BANDEJA, PROCESO_IMPORTACION } from "@/lib/report/routes";
import { FechaEmbarqueSlider } from "./FechaEmbarqueSlider";
import { IntencionCompraSubNav } from "./IntencionCompraSubNav";
import { useMarcasPorTipo } from "./useMarcasPorTipo";

const ID_COMPRA_PREVIA = 2;
const ID_PROGRAMADO = 3;

const CAT_INFO: Record<string, { title: string; desc: string }> = {
  "PRE VENTA": {
    title: "COMPRA PREVIA",
    desc: "Mercadería para la importadora.\nSe ofrece por catálogo durante los 90 días de tránsito.",
  },
  PROGRAMADO: {
    title: "PROGRAMADO",
    desc: "Intermediación directa fábrica → cliente.\nLa importadora gestiona el puente.",
  },
};

type Paso = "paso_a" | "form";

export function IntencionCompraNuevaClient() {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>("paso_a");
  const [catalogos, setCatalogos] = useState<IcCatalogos | null>(null);
  const [quincenaLookup, setQuincenaLookup] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [tipoId, setTipoId] = useState<number | null>(null);
  const [categoriaId, setCategoriaId] = useState<number | null>(null);

  const [idProveedor, setIdProveedor] = useState<number | "">("");
  const [idMarca, setIdMarca] = useState<number | "">("");
  const [codCliente, setCodCliente] = useState(276);
  const [clienteNombre, setClienteNombre] = useState<string | null>(null);
  const [clienteErr, setClienteErr] = useState(false);
  const [idVendedor, setIdVendedor] = useState<number | "">("");
  const [idPlazo, setIdPlazo] = useState<number | null>(null);
  const [pares, setPares] = useState(0);
  const [fechaReg, setFechaReg] = useState(() => new Date().toISOString().slice(0, 10));
  const [quincenaId, setQuincenaId] = useState(0);
  const [nota, setNota] = useState("");
  const [bruto, setBruto] = useState(0);
  const [d1, setD1] = useState(0);
  const [d2, setD2] = useState(0);
  const [d3, setD3] = useState(0);
  const [d4, setD4] = useState(0);
  const [obs, setObs] = useState("");
  const [precioEventoId, setPrecioEventoId] = useState<number | null>(null);
  const [listadoPrecioId, setListadoPrecioId] = useState<number | null>(null);
  const [comisionId, setComisionId] = useState<number | null>(null);
  const [lineas, setLineas] = useState<LineaConCaso[]>([]);
  const [lineaSel, setLineaSel] = useState<number | "">("");
  const [listadosNeg, setListadosNeg] = useState<{ id: number; nombre: string }[]>([]);

  const neto = useMemo(() => calcularNeto(bruto, d1, d2, d3, d4), [bruto, d1, d2, d3, d4]);
  const { marcas: marcasFiltradas } = useMarcasPorTipo(tipoId, idProveedor);

  useEffect(() => {
    if (idMarca && marcasFiltradas.length && !marcasFiltradas.some((m) => m.id === idMarca)) {
      setIdMarca("");
    }
  }, [marcasFiltradas, idMarca]);

  const tipoLabel = catalogos?.tipos.find((t) => t.id === tipoId)?.label ?? "—";
  const catLabel = catalogos?.categorias.find((c) => c.id === categoriaId)?.label ?? "—";
  const lineaData = lineas.find((l) => l.id === lineaSel);
  const casoNombre = lineaData?.caso_nombre ?? null;

  const loadCatalogos = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, qRes] = await Promise.all([
        fetch("/api/proceso-importacion/intencion-compra/catalogos", { credentials: "same-origin" }),
        fetch("/api/proceso-importacion/intencion-compra/pendientes", { credentials: "same-origin" }),
      ]);
      const catData = await catRes.json();
      const qData = await qRes.json();
      if (!catRes.ok) throw new Error(catData.error);
      setCatalogos(catData.catalogos);
      setQuincenaLookup(qData.quincena_lookup ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar catálogos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalogos();
  }, [loadCatalogos]);

  useEffect(() => {
    if (!codCliente || codCliente < 1) {
      setClienteNombre(null);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/proceso-importacion/intencion-compra/cliente/${codCliente}`, {
        credentials: "same-origin",
      });
      if (res.ok) {
        const data = await res.json();
        setClienteNombre(data.descp_cliente);
        setClienteErr(false);
      } else {
        setClienteNombre(null);
        setClienteErr(true);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [codCliente]);

  useEffect(() => {
    if (!idProveedor || categoriaId !== ID_PROGRAMADO) {
      setLineas([]);
      return;
    }
    fetch(`/api/proceso-importacion/intencion-compra/negociacion?proveedor_id=${idProveedor}`, {
      credentials: "same-origin",
    })
      .then((r) => r.json())
      .then((d) => setLineas(d.lineas ?? []))
      .catch(() => setLineas([]));
  }, [idProveedor, categoriaId]);

  useEffect(() => {
    if (!precioEventoId || !casoNombre) {
      setListadosNeg([]);
      return;
    }
    fetch(
      `/api/proceso-importacion/intencion-compra/negociacion?evento_id=${precioEventoId}&caso=${encodeURIComponent(casoNombre)}`,
      { credentials: "same-origin" },
    )
      .then((r) => r.json())
      .then((d) => setListadosNeg(d.listados ?? []))
      .catch(() => setListadosNeg([]));
  }, [precioEventoId, casoNombre]);

  async function handleRegistrar() {
    setError(null);
    setSubmitting(true);
    try {
      const comision = catalogos?.comisiones.find((c) => c.id === comisionId);
      const res = await fetch("/api/proceso-importacion/intencion-compra", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_proveedor: idProveedor,
          id_cliente: codCliente,
          id_vendedor: idVendedor,
          id_marca: idMarca,
          id_plazo: idPlazo,
          tipo_id: tipoId,
          categoria_id: categoriaId,
          cantidad_total_pares: pares,
          monto_bruto: bruto,
          descuento_1: d1,
          descuento_2: d2,
          descuento_3: d3,
          descuento_4: d4,
          fecha_registro: fechaReg,
          quincena_arribo_id: quincenaId,
          nota_pedido: nota || null,
          observaciones: obs || null,
          precio_evento_id: precioEventoId,
          listado_precio_id: listadoPrecioId,
          comision_vendedor_id: comisionId && comisionId > 0 ? comisionId : null,
          comision_porcentaje_snap: comision && comision.id > 0 ? comision.porcentaje : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al registrar");
      setSuccess(data.numero_registro);
      setTimeout(() => router.push(INTENCION_COMPRA_BANDEJA), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-app-bg">
        <NexusGlobalHeader active="proceso-importacion" />
        <main className="mx-auto max-w-3xl px-6 py-16 text-center text-slate-500">Cargando…</main>
      </div>
    );
  }

  if (error || !catalogos) {
    return (
      <div className="min-h-screen bg-app-bg">
        <NexusGlobalHeader active="proceso-importacion" />
        <main className="mx-auto max-w-3xl px-6 py-16">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {error ?? "No se pudieron cargar los catálogos"}
          </div>
          <button
            type="button"
            onClick={loadCatalogos}
            className="mt-4 rounded-lg bg-rimec-azul px-4 py-2 text-sm font-bold text-white hover:bg-rimec-azul-dark"
          >
            Reintentar
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusGlobalHeader active="proceso-importacion" />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Link href={PROCESO_IMPORTACION} className="text-sm font-semibold text-rimec-azul hover:underline">
          ← Ciclo de importación
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-rimec-azul/70">2.3.1.7.3.1 · Registro</p>
        <h1 className="mt-2 font-serif text-3xl text-rimec-azul-dark">Nueva intención de compra</h1>

        <IntencionCompraSubNav activo="registro" />

        {paso === "paso_a" ? (
          <div className="mt-8 space-y-8">
            <div>
              <h2 className="font-serif text-xl font-semibold text-rimec-azul-dark">Paso 1 — Definición estratégica</h2>
              <p className="mt-1 text-sm text-slate-600">
                Clasificá esta IC. Tipo y categoría conectan la compra con Sales Report.
              </p>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">¿Qué división?</h3>
              <div className="flex flex-wrap gap-2">
                {catalogos.tipos.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTipoId(t.id)}
                    className={`rounded-lg border-2 px-4 py-3 text-sm font-semibold transition ${
                      tipoId === t.id
                        ? "border-rimec-azul bg-rimec-azul text-white"
                        : "border-slate-200 bg-white hover:border-rimec-azul/40"
                    }`}
                  >
                    {tipoId === t.id ? "✅ " : ""}
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">¿Qué estrategia de compra?</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {catalogos.categorias.map((c) => {
                  const info = CAT_INFO[c.raw] ?? { title: c.label, desc: "" };
                  const sel = categoriaId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategoriaId(c.id)}
                      className={`rounded-xl border-2 p-4 text-left transition ${
                        sel ? "border-amber-500 bg-amber-50/50" : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <p className="font-bold text-rimec-azul-dark">
                        {sel ? "✅ " : ""}
                        {info.title}
                      </p>
                      <p className="mt-2 whitespace-pre-line text-xs text-slate-600">{info.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between gap-4 border-t border-slate-200 pt-6">
              <Link
                href={INTENCION_COMPRA_BANDEJA}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                ← Bandeja
              </Link>
              <button
                type="button"
                disabled={!tipoId || !categoriaId}
                onClick={() => setPaso("form")}
                className="rounded-lg bg-rimec-azul px-6 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                Continuar →
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            <div className="rounded-xl border-l-4 border-amber-500 bg-slate-900 px-4 py-3 text-sm text-white">
              <span className="text-xs uppercase text-slate-400">Clasificación estratégica</span>
              <p className="mt-1">
                <strong>División:</strong> {tipoLabel} · <strong>Estrategia:</strong> {catLabel}
              </p>
            </div>

            <button type="button" onClick={() => setPaso("paso_a")} className="text-sm font-semibold text-rimec-azul hover:underline">
              ← Cambiar clasificación
            </button>

            <p className="text-sm text-slate-600">
              El número <code className="text-xs">IC-YYYY-XXXX</code> se asigna al guardar.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Proveedor">
                <select
                  value={idProveedor}
                  onChange={(e) => setIdProveedor(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">— Elegir —</option>
                  {catalogos.proveedores.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Marca">
                <select value={idMarca} onChange={(e) => setIdMarca(Number(e.target.value))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="">— Elegir —</option>
                  {marcasFiltradas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                {tipoId && marcasFiltradas.length === 0 && (
                  <p className="mt-1 text-xs text-amber-700">Sin marcas para {tipoLabel} en marca_tipo_v2</p>
                )}
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cliente — código del papel/email">
                <input
                  type="number"
                  min={1}
                  value={codCliente}
                  onChange={(e) => setCodCliente(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                {clienteNombre && <p className="mt-1 text-xs text-emerald-700">✔ {codCliente} — {clienteNombre}</p>}
                {clienteErr && <p className="mt-1 text-xs text-red-700">✗ Código no encontrado</p>}
              </Field>
              <Field label="Vendedor responsable">
                <select value={idVendedor} onChange={(e) => setIdVendedor(Number(e.target.value))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="">— Elegir —</option>
                  {catalogos.vendedores.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Plazo de pago">
                <select
                  value={idPlazo ?? ""}
                  onChange={(e) => setIdPlazo(e.target.value === "" ? null : Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {catalogos.plazos.map((p) => (
                    <option key={String(p.id)} value={p.id ?? ""}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Total pares">
                <input type="number" min={0} step={1} value={pares} onChange={(e) => setPares(Number(e.target.value))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </Field>
              <Field label="Fecha registro">
                <input type="date" value={fechaReg} onChange={(e) => setFechaReg(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </Field>
              <FechaEmbarqueSlider value={quincenaId} lookup={quincenaLookup} onChange={setQuincenaId} />
            </div>

            <Field label="Nota / referencia del pedido">
              <input type="text" value={nota} onChange={(e) => setNota(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </Field>

            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">Condiciones financieras</p>
              <Field label="Monto bruto total (Gs.)">
                <input type="number" min={0} step={1000000} value={bruto} onChange={(e) => setBruto(Number(e.target.value))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </Field>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[["Desc. 1 (%)", d1, setD1], ["Desc. 2 (%)", d2, setD2], ["Desc. 3 (%)", d3, setD3], ["Desc. 4 (%)", d4, setD4]].map(
                  ([lbl, val, set]) => (
                    <Field key={String(lbl)} label={String(lbl)}>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={val as number}
                        onChange={(e) => (set as (n: number) => void)(Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </Field>
                  ),
                )}
              </div>
              <div className="mt-3 rounded-xl border-l-4 border-amber-500 bg-slate-900 px-4 py-3">
                <p className="text-xs uppercase text-slate-400">Monto neto calculado</p>
                <p className="font-serif text-2xl font-bold text-amber-300">Gs. {neto.toLocaleString("es-PY")}</p>
              </div>
            </div>

            <Field label="Observaciones">
              <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </Field>

            <Field label="Listado de precios — evento cerrado">
              <select
                value={precioEventoId ?? ""}
                onChange={(e) => setPrecioEventoId(e.target.value === "" ? null : Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {catalogos.eventos.map((ev) => (
                  <option key={String(ev.id)} value={ev.id ?? ""}>
                    {ev.label}
                  </option>
                ))}
              </select>
            </Field>

            {categoriaId === ID_PROGRAMADO && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <p className="text-sm font-bold text-rimec-azul-dark">Negociación PROGRAMADO</p>
                {lineas.length === 0 ? (
                  <p className="text-xs text-amber-800">No hay líneas para este proveedor.</p>
                ) : (
                  <>
                    <Field label="Línea del pedido">
                      <select value={lineaSel} onChange={(e) => setLineaSel(Number(e.target.value))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                        <option value="">— Elegir —</option>
                        {lineas.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.codigo_proveedor} — {l.descripcion ?? "—"}
                            {l.caso_nombre ? ` · [${l.caso_nombre}]` : " · ⚠ sin caso"}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {casoNombre && precioEventoId && listadosNeg.length > 0 && (
                      <Field label="Listado aplicable">
                        <select
                          value={listadoPrecioId ?? ""}
                          onChange={(e) => setListadoPrecioId(Number(e.target.value))}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        >
                          <option value="">— Elegir —</option>
                          {listadosNeg.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.nombre}
                            </option>
                          ))}
                        </select>
                      </Field>
                    )}
                    <Field label="Comisión vendedor">
                      <select
                        value={comisionId ?? 0}
                        onChange={(e) => setComisionId(Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        {catalogos.comisiones.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </>
                )}
              </div>
            )}

            {categoriaId === ID_COMPRA_PREVIA && (
              <Field label="Listado referencia — COMPRA PREVIA">
                <select
                  value={listadoPrecioId ?? ""}
                  onChange={(e) => setListadoPrecioId(e.target.value === "" ? null : Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Sin definir — se determina en ventas</option>
                  <option value={1}>LPN — referencia base</option>
                </select>
              </Field>
            )}

            {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>}
            {success && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                Registrado: <strong>{success}</strong> — redirigiendo a bandeja…
              </div>
            )}

            <button
              type="button"
              disabled={submitting || !clienteNombre || !idProveedor || !idMarca || !idVendedor}
              onClick={handleRegistrar}
              className="w-full rounded-xl bg-rimec-azul py-3 text-sm font-bold text-white hover:bg-rimec-azul-dark disabled:opacity-40"
            >
              {submitting ? "Guardando…" : "🔒 REGISTRAR"}
            </button>
          </div>
        )}

        <Link href={INTENCION_COMPRA} className="mt-8 inline-block text-sm font-semibold text-rimec-azul hover:underline">
          ← Hub intención de compra
        </Link>
      </main>
      <ReportFooter note="Nueva IC · paridad Streamlit paso A + form" />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</label>
      {children}
    </div>
  );
}
