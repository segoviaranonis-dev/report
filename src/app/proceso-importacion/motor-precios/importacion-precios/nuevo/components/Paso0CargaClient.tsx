"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import { Skeleton } from "@/components/ui/LoadingState";
import { MOTOR_PROVEEDOR_DEFAULT } from "@/lib/motor-precios/constants";
import { getMotorProveedorMeta } from "@/lib/motor-precios/proveedores-meta";
import { LEY_GENERO_RESUMEN } from "@/lib/motor-precios/ley-genero";
import { nombreEventoSugerido } from "@/lib/motor-precios/excel-proveedor";
import { IMPORTACION_PRECIOS, MOTOR_PRECIOS } from "@/lib/report/routes";
import { ImportacionPreciosStepNav } from "../../components/ImportacionPreciosStepNav";
import { importacionPasoPath } from "@/lib/motor-precios/importacion-pasos";
import { Paso0ExitoBanner } from "./Paso0ExitoBanner";
import { Paso0ProcessingOverlay } from "./Paso0ProcessingOverlay";
import { Paso0ProveedorSelector, type ProveedorOption } from "./Paso0ProveedorSelector";

type CargaOk = {
  ok: true;
  evento_id: number;
  skus_count: number;
  marcas_count: number;
  asignaciones_genero: Record<string, string>;
  marcas: string[];
};

export function Paso0CargaClient() {
  const exitoRef = useRef<HTMLDivElement>(null);
  const [leyAbierta, setLeyAbierta] = useState(false);
  const [proveedores, setProveedores] = useState<ProveedorOption[]>([]);
  const [loadingProveedores, setLoadingProveedores] = useState(true);
  const [proveedorError, setProveedorError] = useState<string | null>(null);
  const [proveedorId, setProveedorId] = useState(String(MOTOR_PROVEEDOR_DEFAULT));
  const [nombreEvento, setNombreEvento] = useState("");
  const [fechaDesde, setFechaDesde] = useState(() => new Date().toISOString().slice(0, 10));
  const [archivo, setArchivo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leyError, setLeyError] = useState<{ marcas?: string[]; generos?: string[] } | null>(null);
  const [exito, setExito] = useState<CargaOk | null>(null);

  useEffect(() => {
    setLoadingProveedores(true);
    setProveedorError(null);
    fetch("/api/motor-precios/proveedores", { credentials: "same-origin" })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "No autorizado o error al cargar proveedores");
        if (data.configured === false) throw new Error("DATABASE_URL no configurada — proveedores no disponibles");
        const list: ProveedorOption[] = (data.proveedores ?? []).map(
          (p: { id: number; codigo: string; nombre: string; meta: ProveedorOption["meta"] }) => ({
            id: p.id,
            codigo: p.codigo,
            nombre: p.nombre,
            meta: p.meta ?? getMotorProveedorMeta(p.id),
          }),
        );
        if (!list.length) throw new Error("Tabla proveedor_importacion vacía — contactá administración BD");
        setProveedores(list);
        const prefer654 = list.find((p) => p.id === MOTOR_PROVEEDOR_DEFAULT);
        const preferListo = list.find((p) => p.meta?.paso0Report);
        setProveedorId(String(prefer654?.id ?? preferListo?.id ?? list[0].id));
      })
      .catch((e) => setProveedorError(e instanceof Error ? e.message : "No se pudieron cargar proveedores"))
      .finally(() => setLoadingProveedores(false));
  }, []);

  useEffect(() => {
    if (exito && exitoRef.current) {
      exitoRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [exito]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLeyError(null);
    setExito(null);

    if (!archivo) {
      setError("Seleccioná el Excel del proveedor");
      return;
    }
    const meta = getMotorProveedorMeta(Number(proveedorId));
    if (!meta?.paso0Report) {
      setError(`Proveedor ${proveedorId}: Paso 0 Report no habilitado. Elegí 654 para calzado Beira Rio.`);
      return;
    }
    if (!proveedores.some((p) => p.id === Number(proveedorId))) {
      setError("Proveedor no cargado desde BD — recargá la página o verificá sesión admin.");
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("proveedor_id", proveedorId);
      fd.append("nombre_evento", nombreEvento.trim());
      fd.append("vigente_desde", fechaDesde);
      fd.append("archivo", archivo);

      const res = await fetch("/api/motor-precios/eventos/carga", {
        method: "POST",
        body: fd,
        credentials: "same-origin",
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.code === "LEY_GENERO") {
          setLeyError({
            marcas: data.marcas_rechazadas,
            generos: data.generos_faltantes_bd,
          });
        }
        setError(data.error || data.message || "Error en la carga");
        return;
      }

      setExito(data as CargaOk);
    } catch {
      setError("Error de red al cargar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <Paso0ProcessingOverlay open={loading} archivo={archivo?.name} />
      <NexusGlobalHeader active="proceso-importacion" />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link href={IMPORTACION_PRECIOS} className="text-sm font-semibold text-rimec-azul hover:underline">
          ← Importación de precios
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-rimec-azul/70">
          2.3.1.7.2.0 · Nuevo evento · Paso 0
        </p>
        <h1 className="mt-2 font-serif text-3xl text-rimec-azul-dark">Carga del archivo</h1>

        <div className="mt-6">
          <ImportacionPreciosStepNav
            pasoActivo={0}
            eventoId={exito?.evento_id ?? null}
            bloquearSiguiente={!exito}
            mensajeSiguiente={!exito ? "Completá la carga del Excel para continuar al Paso 1" : undefined}
          />
        </div>

        {exito && (
          <>
            <Paso0ExitoBanner
              bannerRef={exitoRef}
              eventoId={exito.evento_id}
              skusCount={exito.skus_count}
              marcasCount={exito.marcas_count}
              asignaciones={exito.asignaciones_genero}
            />
            <Link
              href={importacionPasoPath(1, exito.evento_id)}
              className="mt-4 flex min-h-[56px] items-center justify-center rounded-xl border-2 border-emerald-600 bg-emerald-600 px-6 py-4 text-base font-bold text-white shadow-lg transition hover:bg-emerald-700"
            >
              Paso 1 · Memoria (biblioteca) →
            </Link>
          </>
        )}

        <div className="mt-8 rounded-xl border border-slate-200 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setLeyAbierta((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-rimec-azul-dark hover:bg-slate-50"
          >
            Ley de género (obligatoria en cada importación)
            <span className="text-slate-400">{leyAbierta ? "▲" : "▼"}</span>
          </button>
          {leyAbierta && (
            <div className="border-t border-slate-100 px-4 py-3 text-sm text-slate-700">{LEY_GENERO_RESUMEN}</div>
          )}
        </div>

        <form
          className={`mt-6 space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-opacity duration-300 ${
            loading ? "pointer-events-none opacity-60" : ""
          }`}
          onSubmit={handleSubmit}
        >
          <div>
            {loadingProveedores ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Skeleton className="h-28 w-full" />
                  <Skeleton className="h-28 w-full" />
                </div>
              </div>
            ) : proveedorError ? (
              <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-4 text-sm text-red-900">
                <p className="font-bold">Proveedores no disponibles</p>
                <p className="mt-1">{proveedorError}</p>
                <p className="mt-2 text-xs">Requiere sesión RIMEC Admin (rol_id=1) y DATABASE_URL activa.</p>
              </div>
            ) : (
              <Paso0ProveedorSelector
                proveedores={proveedores}
                proveedorId={proveedorId}
                disabled={loading}
                onChange={setProveedorId}
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Archivo del proveedor *
            </label>
            <div className="mt-1 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
              <p className="text-sm font-medium text-slate-600">
                {archivo ? archivo.name : "Arrastrá o elegí el Excel"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Cualquier nombre de archivo · .xls, .xlsx · límite 200 MB
              </p>
              <input
                type="file"
                accept=".xls,.xlsx"
                disabled={loading}
                className="mt-4 text-xs"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setArchivo(f);
                  if (f && !nombreEvento.trim()) setNombreEvento(nombreEventoSugerido(f.name));
                }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Nombre del evento <span className="font-normal normal-case text-slate-400">(opcional — sugerido desde el archivo)</span>
            </label>
            <input
              value={nombreEvento}
              onChange={(e) => setNombreEvento(e.target.value)}
              placeholder={archivo ? nombreEventoSugerido(archivo.name) : "Se sugiere al elegir el Excel"}
              disabled={loading}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Precios vigentes desde *
            </label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              disabled={loading}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          {leyError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              {leyError.marcas?.length ? (
                <p>Marcas no reconocidas: {leyError.marcas.join(", ")}</p>
              ) : null}
              {leyError.generos?.length ? (
                <p className="mt-1">Faltan códigos en maestro género: {leyError.generos.join(", ")}</p>
              ) : null}
            </div>
          )}

          {error && !leyError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 whitespace-pre-wrap">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || loadingProveedores || !!proveedorError || !proveedores.length || !archivo || !getMotorProveedorMeta(Number(proveedorId))?.paso0Report}
            className="relative w-full overflow-hidden rounded-lg bg-rimec-azul px-4 py-3 text-sm font-bold text-white transition hover:bg-rimec-azul-dark disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Procesando…
              </span>
            ) : (
              "Iniciar carga →"
            )}
          </button>
        </form>

        <div className="mt-6">
          <ImportacionPreciosStepNav
            pasoActivo={0}
            eventoId={exito?.evento_id ?? null}
            bloquearSiguiente={!exito}
            mensajeSiguiente={!exito ? "Completá la carga del Excel para continuar" : undefined}
          />
        </div>

        <Link href={MOTOR_PRECIOS} className="mt-8 inline-block text-sm font-semibold text-rimec-azul hover:underline">
          ← Motor de precios
        </Link>
      </main>
      <ReportFooter note="Importación precios · Paso 0 · 2.3.1.7.2" />
    </div>
  );
}
