"use client";



import Link from "next/link";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui";

import { VitalesStockDeposito } from "@/app/depositos-bazzar/components/operativa/VitalesStockDeposito";

import { ReposicionFiltrosSidebar } from "@/components/herramienta-reposicion/ReposicionFiltrosSidebar";

import { SinImagenCabeceraChip } from "@/components/panel-control/SinImagenCabeceraChip";

import { GrillaPeImportadora } from "@/components/stock-pronta-entrega/GrillaPeImportadora";

import { DiccionarioPeBar } from "@/components/stock-pronta-entrega/DiccionarioPeBar";

import {

  DEPOSITO_WEB_TABS,

  type DepositoWebTab,

} from "@/lib/bazzar-web/deposito-web/constants";

import type { DepositoWebPayload } from "@/lib/bazzar-web/deposito-web/types";

import {

  EMPTY_OPERATIVA_FILTERS,

  type OperativaFilterState,

} from "@/lib/depositos/operativa-filters";

import { calcValorInventario } from "@/lib/depositos/precio-venta";

import {

  claveDiccionarioFromTipoIds,

  parsePeTipoSelected,

  tipoIdsFromClaveDiccionario,

} from "@/lib/stock-pronta-entrega/filtro-tipo-pe-diccionario";

import {

  applyStockPeFilters,

  buildStockPeOpciones,

  countPeCards,

} from "@/lib/stock-pronta-entrega/stock-pe-filters";



export function DepositoWebClient() {

  const [tab, setTab] = useState<DepositoWebTab>("ingreso");

  const [data, setData] = useState<DepositoWebPayload | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [filtros, setFiltros] = useState<OperativaFilterState>(EMPTY_OPERATIVA_FILTERS);

  const [soloSinImagen, setSoloSinImagen] = useState(false);

  const [faltantes, setFaltantes] = useState<Set<string>>(() => new Set());



  const load = useCallback(async () => {

    setLoading(true);

    setError(null);

    try {

      const res = await fetch(`/api/bazzar-web/deposito-web?t=${Date.now()}`, {

        cache: "no-store",

      });

      const json = (await res.json()) as DepositoWebPayload & { error?: string };

      if (!res.ok) throw new Error(json.error || "Error al cargar depósito");

      setData(json);

    } catch (e) {

      setError(e instanceof Error ? e.message : "Error de red");

    } finally {

      setLoading(false);

    }

  }, []);



  useEffect(() => {

    load();

  }, [load]);



  const rowsBase = useMemo(() => {

    if (!data) return [];

    return tab === "vendible" ? data.vendible : data.ingreso;

  }, [data, tab]);



  const filtrosDeferred = useDeferredValue(filtros);

  const filtradas = useMemo(

    () => applyStockPeFilters(rowsBase, filtrosDeferred, ""),

    [rowsBase, filtrosDeferred],

  );



  const filtradasGrid = useMemo(() => {

    if (!soloSinImagen || !faltantes.size) return filtradas;

    return filtradas.filter((p) =>

      faltantes.has(

        `${p.linea_codigo_proveedor}-${p.referencia_codigo_proveedor}-${p.material_code}-${p.color_code}`,

      ),

    );

  }, [filtradas, soloSinImagen, faltantes]);



  const opciones = useMemo(

    () => buildStockPeOpciones(rowsBase, filtrosDeferred, ""),

    [rowsBase, filtrosDeferred],

  );



  const cardsCount = useMemo(() => countPeCards(filtradasGrid), [filtradasGrid]);

  const totalPares = useMemo(

    () => filtradasGrid.reduce((s, r) => s + (Number(r.cantidad) || 0), 0),

    [filtradasGrid],

  );

  const valorInventario = useMemo(() => calcValorInventario(filtradasGrid), [filtradasGrid]);



  const tabCounts = useMemo(

    () => ({

      ingreso: data?.ingreso.reduce((s, r) => s + r.cantidad, 0) ?? 0,

      vendible: data?.vendible.reduce((s, r) => s + r.cantidad, 0) ?? 0,

    }),

    [data],

  );



  const peTipoSelected = useMemo(

    () => parsePeTipoSelected(filtros.tipoGrupos),

    [filtros.tipoGrupos],

  );

  const diccionarioActivo = useMemo(

    () => claveDiccionarioFromTipoIds(peTipoSelected),

    [peTipoSelected],

  );



  const onDiccionarioChange = useCallback((clave: string | null) => {

    setFiltros((prev) => ({

      ...prev,

      tipoGrupos: tipoIdsFromClaveDiccionario(clave) as typeof prev.tipoGrupos,

      cadenaComercial: null,

    }));

  }, []);



  const sidebar = (

    <ReposicionFiltrosSidebar

      variant="pe"

      filtros={filtros}

      onChange={setFiltros}

      opciones={opciones}

      emptyFilters={EMPTY_OPERATIVA_FILTERS}

    />

  );



  return (

    <>

      <section className="border-b border-neutral-300 bg-white py-4">

        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 lg:flex-row lg:items-start lg:justify-between">

          <div className="min-w-0 flex-1 space-y-2 text-sm text-neutral-700">

            <p>

              <strong className="text-rimec-azul-dark">Cadena:</strong>{" "}

              <Link href="/bazzar-web/compra" className="font-semibold text-rimec-azul hover:underline">

                Compra Web

              </Link>

              {" → "}

              <strong>Depósito Web</strong> →{" "}

              <Link href="/bazzar-web/stock-sano" className="font-semibold text-rimec-azul hover:underline">

                Stock Sano

              </Link>

              {" → "}

              <Link href="/bazzar-web/motor-precio" className="font-semibold text-rimec-azul hover:underline">

                Motor precio

              </Link>

              {" → tienda bazzar-web"}

            </p>

            <p className="text-xs text-neutral-600">

              Grilla y filtros siameses (PE / Alejandro Magno / RIMEC Web) · protocolo{' '}
              <strong>2.2.1.44</strong> · cascada dimensión→molécula <strong>2.2.1.42</strong>.
              Protocolo imagen 654 + 638.

            </p>

          </div>

          <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>

            {loading ? "Refrescando…" : "Refrescar"}

          </Button>

        </div>

      </section>



      <section className="border-b-2 border-rimec-azul bg-app-bg py-3">

        <div className="mx-auto flex max-w-7xl flex-wrap gap-2 px-6">

          {DEPOSITO_WEB_TABS.map((t) => (

            <button

              key={t.id}

              type="button"

              onClick={() => setTab(t.id)}

              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${

                tab === t.id

                  ? "bg-rimec-azul text-white shadow"

                  : "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"

              }`}

              title={t.hint}

            >

              {t.icon} {t.label}

              <span className="ml-1.5 tabular-nums opacity-80">

                ({tabCounts[t.id].toLocaleString("es-PY")} p)

              </span>

            </button>

          ))}

        </div>

      </section>



      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">

        {loading && <p className="text-sm text-slate-500">Cargando stock…</p>}



        {error && (

          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">

            {error}

          </div>

        )}



        {data && !loading && data.configured === false && (

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">

            DATABASE_URL no configurada.

          </div>

        )}



        {tab === "vendible" && data?.vendibleOk === false && (

          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">

            Vista <code>v_stock_web</code> no disponible en esta BD.

          </div>

        )}



        {data && !loading && data.configured !== false && rowsBase.length === 0 && (

          <div className="rounded-lg border-2 border-dashed border-neutral-300 bg-white px-6 py-10 text-center">

            <p className="font-serif text-lg text-rimec-azul-dark">Sin stock en esta vista</p>

            <p className="mt-2 text-sm text-neutral-600">

              Confirmá recepción en{" "}

              <Link href="/bazzar-web/compra" className="font-semibold text-rimec-azul hover:underline">

                Compra Web

              </Link>

              .

            </p>

          </div>

        )}



        {rowsBase.length > 0 && !loading && (

          <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-start lg:gap-2">

            <div className="w-full shrink-0 self-start pl-1 pr-1 lg:sticky lg:top-2 lg:w-auto lg:max-w-[32rem] lg:pl-1 lg:pr-0">

              <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm lg:hidden" open>

                <summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-rimec-azul [&::-webkit-details-marker]:hidden">

                  ▾ Filtros · dimensiones + molécula

                </summary>

                <div className="border-t border-slate-100 p-2">{sidebar}</div>

              </details>

              <div className="hidden lg:block">{sidebar}</div>

            </div>



            <div className="min-w-0 flex-1 space-y-3 pr-1 sm:pr-2">

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">

                <VitalesStockDeposito

                  productos={cardsCount}

                  pares={totalPares}

                  valorInventario={valorInventario}

                  variant="prominent"

                />

                <SinImagenCabeceraChip

                  productos={filtradas}

                  soloSinImagen={soloSinImagen}

                  onSoloSinImagenChange={setSoloSinImagen}

                  onFaltantesChange={setFaltantes}

                />

              </div>



              <DiccionarioPeBar

                rows={filtradas}

                claveActiva={diccionarioActivo}

                onClaveChange={onDiccionarioChange}

              />



              <GrillaPeImportadora

                productos={filtradasGrid}

                loteModo="pe-dual-ramo"

                showDiccionarioBadge

              />

            </div>

          </div>

        )}

      </div>

    </>

  );

}

