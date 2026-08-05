"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { PdfCandyAccordions, type Adjunto } from "./PdfCandyAccordions";

type Carpeta = {
  id: number;
  codigo: string;
  nombre: string;
  no_leidos: number;
};

type Mensaje = {
  id: number;
  asunto: string;
  cuerpo: string;
  origen: string;
  created_at: string;
  leido: boolean;
  adjuntos: number;
};

type Detalle = Mensaje & {
  carpeta_nombre: string;
  adjuntos_detalle: Adjunto[];
};

function fmtFecha(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-PY", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function AccordionRoot({
  title,
  subtitle,
  badge,
  open,
  onToggle,
  children,
  dark,
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center gap-3 px-4 py-3.5 text-left ${
          dark
            ? "bg-[#e8f1f8] text-rimec-azul hover:bg-[#dceaf5]"
            : "bg-slate-50 text-slate-900 hover:bg-slate-100"
        }`}
      >
        <span
          className={`text-sm transition ${open ? "rotate-90" : ""} ${
            dark ? "text-rimec-azul/70" : ""
          }`}
        >
          ▶
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold uppercase tracking-wide">{title}</span>
          {subtitle ? (
            <span className={`block text-xs ${dark ? "text-slate-600" : "text-slate-500"}`}>
              {subtitle}
            </span>
          ) : null}
        </span>
        {badge}
      </button>
      {open ? <div className="border-t border-slate-100">{children}</div> : null}
    </div>
  );
}

export function BandejaMensajesInternos() {
  const [carpetas, setCarpetas] = useState<Carpeta[]>([]);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<{ nombre: string; role?: string } | null>(
    null,
  );

  const [openMsgs, setOpenMsgs] = useState(true);
  const [openDetalleCocina, setOpenDetalleCocina] = useState(false);
  const [openPdfsLogistica, setOpenPdfsLogistica] = useState(true);
  const [openPdfs, setOpenPdfs] = useState(true);
  const [openSalida, setOpenSalida] = useState(false);

  const carpetaEntrada = "STOCK_PRONTA_ENTREGA";
  const carpetaLogistica = "LOGISTICA_CONFIRMACION_ENTREGAS";

  const [mensajesLogistica, setMensajesLogistica] = useState<Mensaje[]>([]);
  const [selLogistica, setSelLogistica] = useState<number | null>(null);
  const [detalleLogistica, setDetalleLogistica] = useState<Detalle | null>(null);
  const [openListaLogistica, setOpenListaLogistica] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [resPe, resLog] = await Promise.all([
        fetch(
          `/api/mensajes-internos?carpeta=${encodeURIComponent(carpetaEntrada)}`,
          { cache: "no-store" },
        ),
        fetch(
          `/api/mensajes-internos?carpeta=${encodeURIComponent(carpetaLogistica)}`,
          { cache: "no-store" },
        ),
      ]);
      const j = (await resPe.json()) as {
        ok?: boolean;
        error?: string;
        carpetas?: Carpeta[];
        mensajes?: Mensaje[];
        usuario?: { nombre: string; role?: string };
      };
      const jLog = (await resLog.json()) as {
        ok?: boolean;
        error?: string;
        mensajes?: Mensaje[];
      };
      if (!resPe.ok || !j.ok) throw new Error(j.error ?? "No se cargó la bandeja");
      // Carpeta logística puede no existir aún en entornos sin mig 197
      const listLog =
        resLog.ok && jLog.ok ? (jLog.mensajes ?? []) : [];
      const list = j.mensajes ?? [];
      setCarpetas(j.carpetas ?? []);
      setMensajes(list);
      setMensajesLogistica(listLog);
      setUsuario(j.usuario ?? null);
      // Regeneración / depósito nuevo: si el id ya no está → limpiar (useEffect abre el 1º).
      // Si sigue → reabrir para refrescar adjuntos (evita LPC03 en 0 con mensaje viejo en memoria).
      setSel((prev) => {
        if (prev != null && list.some((m) => m.id === prev)) {
          queueMicrotask(() => {
            void (async () => {
              setDetalle(null);
              setOpenPdfs(true);
              try {
                const r2 = await fetch(`/api/mensajes-internos/${prev}`, {
                  cache: "no-store",
                });
                const j2 = (await r2.json()) as {
                  ok?: boolean;
                  mensaje?: Detalle;
                };
                if (r2.ok && j2.ok && j2.mensaje) setDetalle(j2.mensaje);
              } catch {
                /* load ya pintó lista; detalle se reabre al click */
              }
            })();
          });
          return prev;
        }
        setDetalle(null);
        return null;
      });
      setSelLogistica((prev) => {
        if (prev != null && listLog.some((m) => m.id === prev)) return prev;
        setDetalleLogistica(null);
        return null;
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!mensajes.length || sel != null) return;
    // Preferir el mensaje con más PDF (cocina unificada), no pruebas sueltas.
    const best = [...mensajes].sort((a, b) => (b.adjuntos || 0) - (a.adjuntos || 0))[0]!;
    void abrir(best.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensajes, sel]);

  async function abrir(id: number) {
    setSel(id);
    setDetalle(null);
    setOpenPdfs(true);
    try {
      const res = await fetch(`/api/mensajes-internos/${id}`, { cache: "no-store" });
      const j = (await res.json()) as { ok?: boolean; error?: string; mensaje?: Detalle };
      if (!res.ok || !j.ok || !j.mensaje) throw new Error(j.error ?? "Sin detalle");
      setDetalle(j.mensaje);
      setMensajes((prev) =>
        prev.map((m) => (m.id === id ? { ...m, leido: true } : m)),
      );
      setCarpetas((prev) =>
        prev.map((c) =>
          c.codigo === carpetaEntrada && c.no_leidos > 0
            ? { ...c, no_leidos: Math.max(0, c.no_leidos - 1) }
            : c,
        ),
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error detalle");
    }
  }

  async function abrirLogistica(id: number) {
    setSelLogistica(id);
    setDetalleLogistica(null);
    setOpenPdfsLogistica(true);
    setOpenListaLogistica(true);
    try {
      const res = await fetch(`/api/mensajes-internos/${id}`, { cache: "no-store" });
      const j = (await res.json()) as { ok?: boolean; error?: string; mensaje?: Detalle };
      if (!res.ok || !j.ok || !j.mensaje) throw new Error(j.error ?? "Sin detalle");
      setDetalleLogistica(j.mensaje);
      setMensajesLogistica((prev) =>
        prev.map((m) => (m.id === id ? { ...m, leido: true } : m)),
      );
      setCarpetas((prev) =>
        prev.map((c) =>
          c.codigo === carpetaLogistica && c.no_leidos > 0
            ? { ...c, no_leidos: Math.max(0, c.no_leidos - 1) }
            : c,
        ),
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error detalle logística");
    }
  }

  /** Un solo aviso de cocina: el de más PDF (ignora pruebas sueltas en UI). */
  const mensajeCocina = useMemo(() => {
    if (!mensajes.length) return null;
    return [...mensajes].sort((a, b) => (b.adjuntos || 0) - (a.adjuntos || 0))[0]!;
  }, [mensajes]);

  const noLeidos =
    mensajeCocina && !mensajeCocina.leido ? 1 : 0;
  const noLeidosLog =
    carpetas.find((c) => c.codigo === carpetaLogistica)?.no_leidos ?? 0;
  const pdfCountLogistica = useMemo(() => {
    if (detalleLogistica?.adjuntos_detalle?.length) {
      return detalleLogistica.adjuntos_detalle.length;
    }
    return mensajesLogistica.reduce((n, m) => n + (m.adjuntos || 0), 0);
  }, [detalleLogistica, mensajesLogistica]);
  const pdfCount = detalle?.adjuntos_detalle?.length ?? 0;
  const pdfPares = useMemo(() => {
    let t = 0;
    for (const a of detalle?.adjuntos_detalle ?? []) {
      const n = Number(a.total_pares);
      if (Number.isFinite(n)) t += n;
    }
    return t;
  }, [detalle]);
  const adjuntosLogistica = detalleLogistica?.adjuntos_detalle ?? [];

  return (
    <div className="mt-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm">
          {usuario ? (
            <>
              Bandeja de <strong>{usuario.nombre}</strong>
              {" · "}solo informes dirigidos a este usuario
            </>
          ) : (
            "Cargando sesión…"
          )}
          <button
            type="button"
            onClick={() => void load()}
            className="ml-3 text-xs font-bold uppercase text-rimec-azul hover:underline"
          >
            Actualizar
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled
            title="Lo programamos más adelante"
            className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white opacity-60"
          >
            Enviar stock
          </button>
          <button
            type="button"
            disabled
            title="Lo programamos más adelante"
            className="rounded-xl border-2 border-slate-300 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-500 opacity-70"
          >
            Compra previa
          </button>
        </div>
      </div>

      {err && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {err}
        </p>
      )}

      {/* Acordeón 1 · Un solo aviso de cocina (móvil-first) */}
      <AccordionRoot
        title="Mensajes · textos"
        subtitle="Stock pronta entrega"
        open={openMsgs}
        onToggle={() => setOpenMsgs((v) => !v)}
        dark
        badge={
          noLeidos > 0 ? (
            <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
              1
            </span>
          ) : mensajeCocina ? (
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold text-rimec-azul">
              1
            </span>
          ) : (
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold text-slate-200">
              0
            </span>
          )
        }
      >
        {loading && <p className="px-4 py-6 text-xs text-slate-400">Cargando…</p>}
        {!loading && !mensajeCocina && (
          <p className="px-4 py-8 text-center text-sm text-slate-400">
            Vacío. Cuando se cocine el stock PE, aparece un solo aviso acá.
          </p>
        )}
        {mensajeCocina && (
          <div className="p-3">
            <button
              type="button"
              onClick={() => {
                void abrir(mensajeCocina.id);
                setOpenDetalleCocina((v) => !v);
                setOpenPdfs(true);
              }}
              className="flex w-full items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left active:bg-slate-50"
            >
              <span className="mt-0.5 text-xs text-slate-400">
                {openDetalleCocina ? "▼" : "▶"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-snug text-slate-900">
                  Stock pronta entrega actualizado
                </span>
                <span className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                  <span>{fmtFecha(mensajeCocina.created_at)}</span>
                  <span className="font-bold text-rimec-azul">
                    {mensajeCocina.adjuntos || pdfCount || 0} PDF
                  </span>
                </span>
              </span>
            </button>
            {openDetalleCocina && (
              <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Detalle
                </p>
                <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-700">
                  {(detalle?.id === mensajeCocina.id && detalle.cuerpo) ||
                    mensajeCocina.cuerpo ||
                    mensajeCocina.asunto}
                </pre>
                <p className="mt-2 text-[11px] text-slate-400">
                  Los PDF están en el acordeón <strong>PDFs · pronta entrega</strong>{" "}
                  (Calzado / Confecciones).
                </p>
              </div>
            )}
          </div>
        )}
      </AccordionRoot>

      {/* Acordeón · PDFs Logística (arriba de Pronta Entrega) */}
      <AccordionRoot
        title="PDFs · confirmación de entregas"
        subtitle="Factura interna · recordatorios Logística → vendedor"
        open={openPdfsLogistica}
        onToggle={() => setOpenPdfsLogistica((v) => !v)}
        dark
        badge={
          <span className="flex items-center gap-1.5">
            {noLeidosLog > 0 ? (
              <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
                {noLeidosLog}
              </span>
            ) : null}
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold text-rimec-azul">
              {pdfCountLogistica} PDF
            </span>
          </span>
        }
      >
        <div className="space-y-2 p-3">
          {!mensajesLogistica.length && (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
              Vacío. Cuando Graciela envíe un recordatorio desde Logística, acá
              aparece el PDF de factura interna.
            </p>
          )}
          {mensajesLogistica.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setOpenListaLogistica((v) => !v)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <span>
                  {openListaLogistica ? "▼" : "▶"} Mensajes ·{" "}
                  {mensajesLogistica.length}
                </span>
                <span className="font-normal text-slate-400">
                  nombres PDF al abrir
                </span>
              </button>
              {openListaLogistica ? (
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                  {mensajesLogistica.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => void abrirLogistica(m.id)}
                        className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left text-xs hover:bg-slate-50 ${
                          selLogistica === m.id ? "bg-blue-50" : ""
                        } ${!m.leido ? "font-semibold" : ""}`}
                      >
                        <span className="truncate text-slate-900">{m.asunto}</span>
                        <span className="text-[10px] font-normal text-slate-400">
                          {fmtFecha(m.created_at)}
                          {m.adjuntos > 0 ? ` · PDF ×${m.adjuntos}` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {detalleLogistica?.cuerpo ? (
                <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 font-sans text-[11px] leading-relaxed text-slate-700">
                  {detalleLogistica.cuerpo}
                </pre>
              ) : null}
              {adjuntosLogistica.length > 0 ? (
                <ul className="space-y-1">
                  {adjuntosLogistica.map((a) => (
                    <li key={a.id}>
                      <a
                        href={`/api/mensajes-internos/adjunto/${a.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between gap-2 rounded-lg border border-rimec-azul/20 bg-white px-3 py-1.5 text-xs font-medium text-rimec-azul hover:bg-blue-50"
                      >
                        <span className="truncate font-mono text-[11px]">
                          {a.nombre_archivo.split("/").pop()}
                        </span>
                        <span className="shrink-0 text-[10px] font-bold uppercase">
                          Abrir
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : mensajesLogistica.length > 0 && !detalleLogistica ? (
                <p className="px-1 text-[11px] text-slate-400">
                  Tocá un mensaje para ver los PDF.
                </p>
              ) : null}
            </>
          )}
        </div>
      </AccordionRoot>

      {/* Acordeón · PDFs Pronta entrega → LPN / LPC03 / LPC04 */}
      <AccordionRoot
        title="PDFs · pronta entrega"
        subtitle={
          detalle
            ? detalle.asunto
            : "Elegí un mensaje arriba para ver los PDF"
        }
        open={openPdfs}
        onToggle={() => setOpenPdfs((v) => !v)}
        badge={
          <span className="flex items-center gap-1.5">
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
              {pdfCount} PDF
            </span>
            {pdfCount > 0 ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-900">
                {Math.round(pdfPares).toLocaleString("es-PY")} pares
              </span>
            ) : null}
          </span>
        }
      >
        <div className="space-y-3 p-3">
          {!detalle && (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
              Abrí un mensaje del acordeón de textos
            </p>
          )}
          {detalle && (
            <>
              <PdfCandyAccordions adjuntos={detalle.adjuntos_detalle} />
              <p className="px-1 text-[11px] text-slate-400">
                Acordeón tipo_v2 (Calzado · Confecciones) → LP → Marca · Abrir = pestaña nueva.
              </p>
            </>
          )}
        </div>
      </AccordionRoot>

      {/* Acordeón 3 · Salida (stub) */}
      <AccordionRoot
        title="Bandeja de salida"
        subtitle="Enviados (próximo paso)"
        open={openSalida}
        onToggle={() => setOpenSalida((v) => !v)}
      >
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-slate-400">
            Acá van los PDF que mandes con{" "}
            <strong className="text-slate-600">Enviar stock</strong> o{" "}
            <strong className="text-slate-600">Compra previa</strong>.
          </p>
        </div>
      </AccordionRoot>
    </div>
  );
}
