"use client";

import { useState } from "react";
import { Button, Modal, LoadingSpinner, Skeleton, MoneyDisplay, FormField, TextArea } from "@/components/ui";

type Pedido = {
  id: number;
  nro_pedido: string;
  fecha: string;
  vendedor: string;
  cliente: string;
  total: number;
  items_count: number;
  estado: "PENDIENTE" | "APROBADO" | "RECHAZADO";
  descuento_porcentaje: number;
  plazo: string;
  lista_precio: string;
};

type Factura = {
  id: number;
  nro_factura: string;
  nro_factura_legacy?: string | null;
  pp_id: number;
  nro_pp: string;
  fecha_arribo_estimada: string | null;
  marca: string;
  caso: string;
  total_pares: number;
  total_monto: number;
  estado: string;
  lista_precio_id: number | null;
  descuento_1: number;
  descuento_2: number;
  descuento_3: number;
  descuento_4: number;
};

type Item = {
  id: number;
  pares: number;
  cajas: number;
  precio_neto: number;
  subtotal: number;
  linea_codigo: string;
  ref_codigo: string;
  color_nombre: string;
  material_nombre: string;
  gradas_fmt: string;
  imagen_url: string;
};

const ADMIN_ID = 1;

type Props = {
  pedidosIniciales: Pedido[];
};

export function AprobacionesClient({ pedidosIniciales }: Props) {
  const [pedidos, setPedidos] = useState<Pedido[]>(pedidosIniciales);
  const [procesando, setProcesando] = useState<number | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "success" | "error"; texto: string } | null>(null);
  const [filtro, setFiltro] = useState<"TODOS" | "PENDIENTE" | "APROBADO" | "RECHAZADO">("PENDIENTE");
  const [pedidoExpandido, setPedidoExpandido] = useState<number | null>(null);
  const [facturas, setFacturas] = useState<Record<number, Factura[]>>({});
  const [items, setItems] = useState<Record<number, Item[]>>({});
  const [loadingFacturas, setLoadingFacturas] = useState<number | null>(null);

  // Estados para editar facturas
  const [descuentosFactura, setDescuentosFactura] = useState<
    Record<number, { d1: number; d2: number; d3: number; d4: number }>
  >({});
  const [listasFactura, setListasFactura] = useState<Record<number, number>>({});

  // Estado para controlar qué imágenes se han cargado (lazy loading)
  const [imagenesVisibles, setImagenesVisibles] = useState<Set<number>>(new Set());

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const PEDIDOS_POR_PAGINA = 10;

  async function cargarPedidos() {
    const t0 = performance.now();
    try {
      const res = await fetch("/api/aprobaciones");
      if (res.ok) {
        const data = await res.json();
        setPedidos(data);
        const t1 = performance.now();
        console.log(`✓ Pedidos recargados en ${(t1 - t0).toFixed(0)}ms`);
      }
    } catch (error) {
      console.error("Error cargando pedidos:", error);
    }
  }

  async function aprobarPedido(pedidoId: number) {
    setProcesando(pedidoId);
    setMensaje(null);

    try {
      const res = await fetch("/api/aprobaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "aprobar",
          pedido_id: pedidoId,
          admin_id: ADMIN_ID,
        }),
      });

      const result = await res.json();

      if (result.success) {
        setMensaje({ tipo: "success", texto: `Pedido ${pedidoId} aprobado` });
        await cargarPedidos();
      } else {
        setMensaje({ tipo: "error", texto: result.error || "Error al aprobar" });
      }
    } catch (error) {
      console.error("Error aprobando:", error);
      setMensaje({ tipo: "error", texto: "Error de conexión" });
    } finally {
      setProcesando(null);
      setTimeout(() => setMensaje(null), 4000);
    }
  }

  const [modalRechazo, setModalRechazo] = useState<{
    pedidoId: number;
    motivo: string;
  } | null>(null);

  async function rechazarPedido(pedidoId: number, motivo: string) {
    setProcesando(pedidoId);
    setMensaje(null);

    try {
      const res = await fetch("/api/aprobaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rechazar",
          pedido_id: pedidoId,
          admin_id: ADMIN_ID,
          motivo: motivo || undefined,
        }),
      });

      const result = await res.json();

      if (result.success) {
        setMensaje({ tipo: "success", texto: `Pedido ${pedidoId} rechazado` });
        setModalRechazo(null);
        await cargarPedidos();
      } else {
        setMensaje({ tipo: "error", texto: result.error || "Error al rechazar" });
      }
    } catch (error) {
      console.error("Error rechazando:", error);
      setMensaje({ tipo: "error", texto: "Error de conexión" });
    } finally {
      setProcesando(null);
      setTimeout(() => setMensaje(null), 4000);
    }
  }

  function abrirModalRechazo(pedidoId: number) {
    setModalRechazo({ pedidoId, motivo: "" });
  }

  function confirmarRechazo() {
    if (modalRechazo) {
      rechazarPedido(modalRechazo.pedidoId, modalRechazo.motivo);
    }
  }

  async function togglePedido(pedidoId: number) {
    if (pedidoExpandido === pedidoId) {
      setPedidoExpandido(null);
      return;
    }

    setPedidoExpandido(pedidoId);

    // Si ya tenemos las facturas cargadas, no volver a cargar
    if (facturas[pedidoId]) {
      return;
    }

    // Cargar facturas del pedido
    setLoadingFacturas(pedidoId);
    const t0 = performance.now();
    try {
      const res = await fetch(`/api/aprobaciones/${pedidoId}/facturas`);
      if (res.ok) {
        const data = await res.json();
        setFacturas((prev) => ({ ...prev, [pedidoId]: data }));

        // Cargar items de cada factura
        for (const factura of data) {
          const itemsRes = await fetch(`/api/aprobaciones/facturas/${factura.id}/items`);
          if (itemsRes.ok) {
            const itemsData = await itemsRes.json();
            setItems((prev) => ({ ...prev, [factura.id]: itemsData }));
          }
        }
        const t1 = performance.now();
        console.log(`✓ Facturas e items cargados en ${(t1 - t0).toFixed(0)}ms`);
      }
    } catch (error) {
      console.error("Error cargando facturas:", error);
    } finally {
      setLoadingFacturas(null);
    }
  }

  const pedidosFiltrados = filtro === "TODOS" ? pedidos : pedidos.filter((p) => p.estado === filtro);

  const stats = {
    pendientes: pedidos.filter((p) => p.estado === "PENDIENTE").length,
    aprobados: pedidos.filter((p) => p.estado === "APROBADO").length,
    rechazados: pedidos.filter((p) => p.estado === "RECHAZADO").length,
    total: pedidos.length,
  };

  return (
    <>
      {/* Métricas ejecutivas - Fondo celeste griseado NIIF */}
      <section className="border-b border-neutral-300 bg-app-bg py-6">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-lg border-2 border-neutral-300 bg-card-bg p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-neutral-ink-muted">
                Total Pedidos
              </div>
              <div className="mt-2 font-serif text-3xl font-semibold tabular-nums text-neutral-ink">
                {stats.total}
              </div>
            </div>
            <div className="rounded-lg border-2 border-semantic-warning/30 bg-semantic-warning/10 p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-semantic-warning">Pendientes</div>
              <div className="mt-2 font-serif text-3xl font-semibold tabular-nums text-semantic-warning">
                {stats.pendientes}
              </div>
            </div>
            <div className="rounded-lg border-2 border-semantic-success/30 bg-semantic-success/10 p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-semantic-success">Aprobados</div>
              <div className="mt-2 font-serif text-3xl font-semibold tabular-nums text-semantic-success">
                {stats.aprobados}
              </div>
            </div>
            <div className="rounded-lg border-2 border-semantic-error/30 bg-semantic-error/10 p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-semantic-error">Rechazados</div>
              <div className="mt-2 font-serif text-3xl font-semibold tabular-nums text-semantic-error">
                {stats.rechazados}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Filtros - Azul institucional RIMEC */}
      <section className="border-b-2 border-rimec-azul/20 bg-app-bg-alt py-4">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-wrap gap-2">
            {(["TODOS", "PENDIENTE", "APROBADO", "RECHAZADO"] as const).map((f) => (
              <Button
                key={f}
                variant={filtro === f ? "primary" : "secondary"}
                size="sm"
                onClick={() => setFiltro(f)}
                className={filtro === f ? "bg-rimec-azul hover:bg-rimec-azul-light" : ""}
              >
                {f}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Mensaje feedback */}
      {mensaje && (
        <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
          <div
            className={`rounded-lg border-2 p-4 text-sm font-medium flex items-start gap-3 ${
              mensaje.tipo === "success"
                ? "border-semantic-success-light bg-semantic-success/10 text-semantic-success"
                : "border-semantic-error-light bg-semantic-error/10 text-semantic-error"
            }`}
          >
            <span className="text-xl flex-shrink-0">
              {mensaje.tipo === "success" ? "✓" : "✗"}
            </span>
            <span>{mensaje.texto}</span>
          </div>
        </div>
      )}

      {/* Lista de pedidos - Fondo celeste NIIF */}
      <article className="mx-auto max-w-6xl px-4 py-8 sm:px-6 bg-app-bg">
        {pedidosFiltrados.length === 0 ? (
          <div className="rounded-lg border-2 border-neutral-300 bg-card-bg p-6 text-center shadow-sm">
            <p className="text-sm text-neutral-700">
              No hay pedidos con el filtro: <strong className="text-rimec-azul">{filtro}</strong>
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pedidosFiltrados
              .slice((paginaActual - 1) * PEDIDOS_POR_PAGINA, paginaActual * PEDIDOS_POR_PAGINA)
              .map((pedido) => {
                const expandido = pedidoExpandido === pedido.id;
                const facturasDelPedido = facturas[pedido.id] || [];
                const cargandoFacturas = loadingFacturas === pedido.id;

                return (
                  <div key={pedido.id} className="border border-report-rule bg-white shadow-sm">
                    {/* Header del pedido */}
                    <div className="border-b border-report-rule bg-report-paper2 p-4">
                      <div className="flex items-start gap-4">
                        <button
                          onClick={() => togglePedido(pedido.id)}
                          className="flex-shrink-0 pt-1 text-report-navy2 hover:text-report-navy"
                        >
                          {expandido ? "▼" : "▶"}
                        </button>

                        <div className="flex-1">
                          {/* Header compacto */}
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h3 className="font-mono text-lg font-bold text-report-navy2">{pedido.nro_pedido}</h3>
                              <p className="text-sm font-semibold text-report-navy">{pedido.cliente}</p>
                              <div className="mt-1 flex gap-4 text-sm text-neutral-ink-medium">
                                <span className="tabular-nums">{pedido.items_count} pares</span>
                                <MoneyDisplay amount={pedido.total} size="sm" className="text-neutral-ink" />
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                                  pedido.estado === "PENDIENTE"
                                    ? "bg-semantic-warning/20 text-semantic-warning"
                                    : pedido.estado === "APROBADO"
                                    ? "bg-semantic-success/20 text-semantic-success"
                                    : "bg-semantic-error/20 text-semantic-error"
                                }`}
                              >
                                {pedido.estado}
                              </span>

                              {pedido.estado === "PENDIENTE" && (
                                <>
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => aprobarPedido(pedido.id)}
                                    loading={procesando === pedido.id}
                                    disabled={procesando === pedido.id}
                                  >
                                    Aprobar
                                  </Button>
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => abrirModalRechazo(pedido.id)}
                                    disabled={procesando === pedido.id}
                                  >
                                    Rechazar
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Detalle expandible: Facturas e Items */}
                    {expandido && (
                      <div className="p-4 bg-neutral-50">
                        {cargandoFacturas ? (
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 text-sm text-neutral-ink-medium">
                              <LoadingSpinner size="sm" />
                              <span>Cargando facturas e items...</span>
                            </div>
                            {/* Skeleton de facturas */}
                            <div className="space-y-3">
                              {[1, 2].map((i) => (
                                <div key={i} className="rounded-lg border border-neutral-300 bg-white p-4 space-y-3">
                                  <div className="flex gap-3">
                                    <Skeleton className="h-6 w-32" />
                                    <Skeleton className="h-6 w-24" />
                                  </div>
                                  <div className="flex gap-4">
                                    <Skeleton className="h-4 w-40" />
                                    <Skeleton className="h-4 w-32" />
                                  </div>
                                  {/* Skeleton de items */}
                                  <div className="space-y-2">
                                    {[1, 2, 3].map((j) => (
                                      <div key={j} className="flex gap-3">
                                        <Skeleton className="h-16 w-16" />
                                        <div className="flex-1 space-y-2">
                                          <Skeleton className="h-4 w-3/4" />
                                          <Skeleton className="h-3 w-1/2" />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : facturasDelPedido.length === 0 ? (
                          <p className="py-4 text-sm text-neutral-ink-muted">No hay facturas para este pedido.</p>
                        ) : (
                          <div className="space-y-6">
                            {facturasDelPedido.map((factura) => {
                              const itemsFactura = items[factura.id] || [];

                              // Estados editables
                              const descuentos = descuentosFactura[factura.id] || {
                                d1: factura.descuento_1,
                                d2: factura.descuento_2,
                                d3: factura.descuento_3,
                                d4: factura.descuento_4,
                              };
                              const listaId = listasFactura[factura.id] ?? factura.lista_precio_id ?? 1;

                              return (
                                <div
                                  key={factura.id}
                                  className="rounded border border-report-rule bg-report-paper p-4"
                                >
                                  {/* Header de la factura */}
                                  <div className="mb-4 border-b border-report-rule pb-3">
                                    <div className="flex items-start justify-between">
                                      <div>
                                        <h4 className="font-serif text-lg font-semibold text-report-navy">
                                          {factura.nro_factura}
                                        </h4>
                                        <p className="text-xs text-report-muted">
                                          {factura.nro_pp} · {factura.marca}
                                        </p>
                                        {factura.nro_factura_legacy && factura.nro_factura_legacy !== factura.nro_factura && (
                                          <p className="text-[11px] text-report-muted">
                                            Legacy: {factura.nro_factura_legacy}
                                          </p>
                                        )}
                                        <p className="text-sm font-semibold text-report-navy2">Caso: {factura.caso}</p>
                                        {factura.fecha_arribo_estimada && (
                                          <p className="text-xs text-report-muted">
                                            Flt prevista:{" "}
                                            {new Date(factura.fecha_arribo_estimada).toLocaleDateString("es-PY")}
                                          </p>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        <div className="text-sm font-semibold tabular-nums text-report-navy">
                                          {factura.total_pares} pares
                                        </div>
                                        <div className="text-sm tabular-nums text-report-muted">
                                          Gs. {factura.total_monto.toLocaleString("es-PY")}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Lista de precios y descuentos */}
                                    {pedido.estado === "PENDIENTE" && (
                                      <div className="mt-3 grid grid-cols-5 gap-3 rounded bg-white p-3 text-sm">
                                        <div>
                                          <label className="text-xs text-report-muted">Lista de precios</label>
                                          <select
                                            value={listaId}
                                            onChange={(e) =>
                                              setListasFactura((prev) => ({
                                                ...prev,
                                                [factura.id]: parseInt(e.target.value),
                                              }))
                                            }
                                            className="mt-1 w-full rounded border border-report-rule px-2 py-1 text-sm"
                                          >
                                            <option value={1}>LPN</option>
                                            <option value={2}>LP2</option>
                                            <option value={3}>LP3</option>
                                          </select>
                                        </div>
                                        {[1, 2, 3, 4].map((i) => (
                                          <div key={i}>
                                            <label className="text-xs text-report-muted">Descuento {i} (%)</label>
                                            <input
                                              type="number"
                                              min="0"
                                              max="100"
                                              step="0.1"
                                              value={descuentos[`d${i}` as keyof typeof descuentos]}
                                              onChange={(e) => {
                                                const val = parseFloat(e.target.value) || 0;
                                                setDescuentosFactura((prev) => ({
                                                  ...prev,
                                                  [factura.id]: {
                                                    ...descuentos,
                                                    [`d${i}`]: val,
                                                  },
                                                }));
                                              }}
                                              className="mt-1 w-full rounded border border-report-rule px-2 py-1 text-sm tabular-nums"
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {pedido.estado !== "PENDIENTE" && (
                                      <div className="mt-3 text-xs text-report-muted">
                                        Lista: LP{factura.lista_precio_id || 1} · Descuentos: {factura.descuento_1}% /{" "}
                                        {factura.descuento_2}% / {factura.descuento_3}% / {factura.descuento_4}%
                                      </div>
                                    )}
                                  </div>

                                  {/* Items de la factura */}
                                  {itemsFactura.length === 0 ? (
                                    <p className="text-xs text-report-muted">Sin items</p>
                                  ) : (
                                    <div className="space-y-2">
                                      {itemsFactura.map((item) => {
                                        const imagenCargada = imagenesVisibles.has(item.id);

                                        return (
                                          <div
                                            key={item.id}
                                            className="flex items-center gap-3 rounded border border-report-rule bg-white p-2"
                                          >
                                            {/* Imagen con lazy loading */}
                                            <div className="flex-shrink-0">
                                              {imagenCargada && item.imagen_url ? (
                                                <img
                                                  src={item.imagen_url}
                                                  alt={`${item.linea_codigo}-${item.ref_codigo}`}
                                                  className="h-16 w-16 object-contain"
                                                  loading="lazy"
                                                />
                                              ) : (
                                                <button
                                                  onClick={() => {
                                                    if (item.imagen_url) {
                                                      setImagenesVisibles((prev) => new Set(prev).add(item.id));
                                                    }
                                                  }}
                                                  disabled={!item.imagen_url}
                                                  className={`flex h-16 w-16 flex-col items-center justify-center rounded border border-report-rule text-xs ${
                                                    item.imagen_url
                                                      ? "cursor-pointer bg-report-paper2 text-report-navy2 hover:bg-report-paper hover:text-report-navy"
                                                      : "bg-gray-50 text-gray-400"
                                                  }`}
                                                  title={item.imagen_url ? "Clic para ver imagen" : "Sin imagen"}
                                                >
                                                  <span className="text-lg">📷</span>
                                                  {item.imagen_url && <span className="mt-0.5 text-[9px]">Ver</span>}
                                                </button>
                                              )}
                                            </div>

                                            {/* Descripción */}
                                            <div className="flex-1">
                                              <div className="text-sm font-semibold text-report-navy">
                                                L{item.linea_codigo} · R{item.ref_codigo}
                                              </div>
                                              <div className="text-xs text-report-muted">
                                                {item.color_nombre}
                                                {item.material_nombre && ` · ${item.material_nombre}`}
                                              </div>
                                              {item.gradas_fmt && (
                                                <div className="mt-1 text-[10px] font-mono text-report-muted">
                                                  {item.gradas_fmt}
                                                </div>
                                              )}
                                            </div>

                                            {/* Cantidades */}
                                            <div className="text-right">
                                              <div className="text-sm font-semibold tabular-nums">
                                                {item.cajas} caj · {item.pares} p
                                              </div>
                                              <div className="text-xs tabular-nums text-report-muted">
                                                Gs. {item.subtotal.toLocaleString("es-PY")}
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}

        {/* Paginación */}
        {pedidosFiltrados.length > PEDIDOS_POR_PAGINA && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
              disabled={paginaActual === 1}
              className="rounded border border-report-rule bg-white px-4 py-2 text-sm font-semibold text-report-navy disabled:opacity-30"
            >
              ← Anterior
            </button>
            <span className="px-4 text-sm text-report-muted">
              Página {paginaActual} de {Math.ceil(pedidosFiltrados.length / PEDIDOS_POR_PAGINA)}
            </span>
            <button
              onClick={() =>
                setPaginaActual((p) => Math.min(Math.ceil(pedidosFiltrados.length / PEDIDOS_POR_PAGINA), p + 1))
              }
              disabled={paginaActual >= Math.ceil(pedidosFiltrados.length / PEDIDOS_POR_PAGINA)}
              className="rounded border border-report-rule bg-white px-4 py-2 text-sm font-semibold text-report-navy disabled:opacity-30"
            >
              Siguiente →
            </button>
          </div>
        )}
      </article>

      {/* Modal de rechazo con fricción segura + validación inline */}
      <Modal
        isOpen={modalRechazo !== null}
        onClose={() => setModalRechazo(null)}
        onConfirm={confirmarRechazo}
        title="Rechazar Pedido"
        confirmText="Confirmar Rechazo"
        cancelText="Cancelar"
        variant="danger"
        confirmDisabled={!modalRechazo?.motivo.trim() || (modalRechazo?.motivo.trim().length || 0) < 10}
        loading={procesando === modalRechazo?.pedidoId}
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-ink-medium">
            ¿Está seguro que desea rechazar este pedido? Esta acción quedará registrada en el historial.
          </p>
          <FormField
            label="Motivo del rechazo"
            required
            error={
              modalRechazo?.motivo.trim() && modalRechazo.motivo.trim().length < 10
                ? "El motivo debe tener al menos 10 caracteres"
                : undefined
            }
            hint={
              !modalRechazo?.motivo.trim()
                ? "El botón de rechazo se habilitará cuando escriba un motivo válido (mínimo 10 caracteres)."
                : `${modalRechazo.motivo.trim().length}/10 caracteres mínimos`
            }
          >
            <TextArea
              value={modalRechazo?.motivo || ""}
              onChange={(e) =>
                setModalRechazo((prev) =>
                  prev ? { ...prev, motivo: e.target.value } : null
                )
              }
              placeholder="Ej: Stock insuficiente, cliente sin crédito disponible..."
              rows={4}
              disabled={procesando === modalRechazo?.pedidoId}
              error={modalRechazo != null && modalRechazo.motivo.trim() !== "" && modalRechazo.motivo.trim().length < 10}
            />
          </FormField>
        </div>
      </Modal>
    </>
  );
}
