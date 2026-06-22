"use client";



import Link from "next/link";

import { useCallback, useEffect, useState } from "react";

import { useSearchParams } from "next/navigation";

import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ProcesoImportacionWaitOverlay } from "@/components/report/ProcesoImportacionWaitOverlay";
import { ReportFooter } from "@/components/report/ReportFooter";

import type { PrecioEventoDetalle } from "@/lib/motor-precios/evento-queries";

import { importacionPasoPath } from "@/lib/motor-precios/importacion-pasos";

import type { BibliotecaRow } from "@/lib/motor-precios/queries";

import {

  IMPORTACION_PRECIOS,

  MOTOR_PRECIOS,

  motorBibliotecaEditor,

} from "@/lib/report/routes";

import { ImportacionPreciosStepNav } from "../../components/ImportacionPreciosStepNav";

import { AsignarBibliotecaPanel } from "./AsignarBibliotecaPanel";



export function Paso1MemoriaClient() {

  const sp = useSearchParams();

  const eventoId = Number(sp.get("evento_id") ?? "") || null;



  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [evento, setEvento] = useState<PrecioEventoDetalle | null>(null);

  const [bibliotecas, setBibliotecas] = useState<BibliotecaRow[]>([]);

  const [bibSeleccionada, setBibSeleccionada] = useState<number | "">("");



  const load = useCallback(async () => {

    if (!eventoId) {

      setLoading(false);

      return;

    }

    setLoading(true);

    setError(null);

    try {

      const evRes = await fetch(`/api/motor-precios/eventos/${eventoId}`, { credentials: "same-origin" });

      const evData = await evRes.json();

      if (!evRes.ok) throw new Error(evData.error || "Error al cargar evento");

      setEvento(evData.evento);



      const proveedorId = evData.evento?.proveedor_id ?? 654;

      const bibRes = await fetch(`/api/motor-precios/biblioteca?proveedor_id=${proveedorId}`, {

        credentials: "same-origin",

      });

      const bibData = await bibRes.json();

      if (bibRes.ok && bibData.bibliotecas) {

        setBibliotecas(bibData.bibliotecas);

      }



      const bibId = evData.evento?.biblioteca_precio_id;

      if (bibId) setBibSeleccionada(bibId);

      else {

        const conCasos = (bibData.bibliotecas ?? []).filter((b: BibliotecaRow) => b.casos_count > 0);

        const canon = conCasos.find((b: BibliotecaRow) => b.canonica);

        if (canon?.id) setBibSeleccionada(canon.id);

        else if (conCasos[0]?.id) setBibSeleccionada(conCasos[0].id);

      }

    } catch (e) {

      setError(e instanceof Error ? e.message : "Error de red");

    } finally {

      setLoading(false);

    }

  }, [eventoId]);



  useEffect(() => {

    load();

  }, [load]);



  const bibliotecaAsignada = Boolean(evento?.biblioteca_precio_id);

  const bibActual = evento?.biblioteca;



  return (

    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <ProcesoImportacionWaitOverlay
        open={loading && Boolean(eventoId)}
        title="Cargando memoria…"
        detail={eventoId ? `Evento #${eventoId}` : undefined}
        hint="Bibliotecas del proveedor"
      />

      <NexusGlobalHeader active="proceso-importacion" />

      <main className="mx-auto max-w-4xl px-6 py-10">

        <Link href={IMPORTACION_PRECIOS} className="text-sm font-semibold text-rimec-azul hover:underline">

          ← Importación de precios

        </Link>

        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-rimec-azul/70">

          2.3.1.7.2.1 · Memoria

        </p>

        <h1 className="mt-2 font-serif text-3xl text-rimec-azul-dark">Memoria</h1>

        <p className="mt-2 text-sm text-slate-600">

          Solo asigná qué biblioteca de casos acompaña este listado. Sin copiar casos acá.

        </p>



        <div className="mt-6">

          <ImportacionPreciosStepNav

            pasoActivo={1}

            eventoId={eventoId}

            bloquearSiguiente={!bibliotecaAsignada}

            mensajeSiguiente={

              !bibliotecaAsignada

                ? "Asigná una biblioteca antes del Preview"

                : undefined

            }

          />

        </div>



        {!eventoId ? (

          <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 px-5 py-6 text-sm text-amber-950">

            <p className="font-bold">Falta evento_id</p>

            <p className="mt-2">

              Volvé al{" "}

              <Link href={importacionPasoPath(0)} className="font-semibold text-rimec-azul underline">

                Paso 0 · Carga

              </Link>{" "}

              y creá el listado.

            </p>

          </div>

        ) : loading ? (

          <p className="mt-8 text-center text-sm text-slate-500">Cargando evento y bibliotecas…</p>

        ) : error ? (

          <div className="mt-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>

        ) : evento ? (

          <div className="mt-8 space-y-6">

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">

              <h2 className="font-serif text-lg text-rimec-azul-dark">Evento #{evento.id}</h2>

              <p className="mt-1 text-sm text-slate-700">

                <strong>{evento.nombre_evento}</strong> · vigente desde {evento.fecha_vigencia_desde} · estado{" "}

                <span className="font-mono uppercase">{evento.estado}</span>

              </p>

              <p className="mt-1 text-xs text-slate-500">

                proveedor_id={evento.proveedor_id} · archivo: {evento.nombre_archivo}

              </p>

            </div>



            {bibActual ? (

              <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 shadow-sm">

                <h2 className="font-serif text-lg text-emerald-950">Biblioteca asignada</h2>

                <p className="mt-2 text-sm text-emerald-950">

                  <strong>#{bibActual.id} · {bibActual.nombre}</strong>

                  {bibActual.canonica && (

                    <span className="ml-2 rounded bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">

                      CANÓNICA

                    </span>

                  )}

                </p>

                <p className="mt-1 text-xs text-emerald-900/80">

                  FK <code className="font-mono">biblioteca_precio_id={bibActual.id}</code> · {bibActual.casos_count}{" "}

                  casos en maestro · {bibActual.lineas_count} líneas BCL

                </p>

                <Link

                  href={motorBibliotecaEditor(bibActual.id)}

                  className="mt-3 inline-block text-xs font-semibold text-rimec-azul underline"

                >

                  Abrir editor biblioteca (casos / clonar) →

                </Link>

              </div>

            ) : null}



            <AsignarBibliotecaPanel

              evento={evento}

              bibliotecas={bibliotecas}

              bibSeleccionada={bibSeleccionada}

              onBibChange={setBibSeleccionada}

              onAsignada={(ev) => setEvento(ev)}

            />

          </div>

        ) : null}



        <Link href={MOTOR_PRECIOS} className="mt-8 inline-block text-sm font-semibold text-rimec-azul hover:underline">

          ← Motor de precios

        </Link>

      </main>

      <ReportFooter note="Importación precios · Paso 1 Memoria · asignar biblioteca FK" />

    </div>

  );

}

