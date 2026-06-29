"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import type { CategoriaDeposito } from "@/lib/depositos/depositos-config";
import {
  applyOperativaFilters,
  buildOperativaOpciones,
  EMPTY_OPERATIVA_FILTERS,
  normalizeDepositoRow,
  type OperativaFilterState,
} from "@/lib/depositos/operativa-filters";
import { TIPO_V2_CALZADO } from "@/lib/depositos/pilar-proveedor-index";
import { calcValorInventario } from "@/lib/depositos/precio-venta";
import {
  buildLineaCasoMap,
  lookupCasoLinea,
  type CasoBibliotecaLite,
} from "@/lib/depositos/caso-biblioteca";
import { COLORES_ESTANDAR_DEFAULT, type ColorEstandar } from "@/lib/pilares/colores-estandar";
import { BibliotecaCasoBar } from "./operativa/BibliotecaCasoBar";
import { FiltroCantidadOperativa } from "./operativa/FiltroCantidadOperativa";
import { GrillaOperativaDeposito } from "./operativa/GrillaOperativaDeposito";
import { TrianguloHeaderDeposito } from "./operativa/TrianguloHeaderDeposito";

const CALZADO_FILTERS_BASE: OperativaFilterState = {
  ...EMPTY_OPERATIVA_FILTERS,
  tipoV2Ids: [TIPO_V2_CALZADO],
};

type Props = {
  clienteId: number;
  categoria: CategoriaDeposito;
};

export function TabOperativaCalzado({ clienteId, categoria }: Props) {
  const [rows, setRows] = useState<DepositoRow[]>([]);
  const [ente, setEnte] = useState("");
  const [tonoCatalog, setTonoCatalog] = useState<ColorEstandar[]>(COLORES_ESTANDAR_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<OperativaFilterState>(CALZADO_FILTERS_BASE);
  const [bibliotecaId, setBibliotecaId] = useState<number | null>(null);
  const [casoActivo, setCasoActivo] = useState<string | null>(null);
  const [lineaCasoMap, setLineaCasoMap] = useState<Map<string, string>>(() => new Map());

  const onCasosLoaded = useCallback((casos: CasoBibliotecaLite[]) => {
    setLineaCasoMap(buildLineaCasoMap(casos));
  }, []);

  useEffect(() => {
    setLoading(true);
    const catParam = categoria === "tienda" ? "" : `&categoria=${categoria}`;
    Promise.all([
      fetch(`/api/depositos/${clienteId}?limit=all${catParam}`, { cache: "no-store" }),
      fetch("/api/pilares/color?tipo_v2_id=1&limit=1", { cache: "no-store" }),
    ])
      .then(async ([prodRes, tonoRes]) => {
        const j = await prodRes.json();
        const tonoData = await tonoRes.json().catch(() => null);
        if (j.error) {
          setErr(j.error);
          setRows([]);
          return;
        }
        const calzado = (j.productos ?? [])
          .map((p: DepositoRow) => normalizeDepositoRow(p))
          .filter((p: DepositoRow) => p.tipo_v2_id == null || p.tipo_v2_id === TIPO_V2_CALZADO);
        setRows(calzado);
        setEnte(j.ente ?? "");
        setErr(null);
        if (tonoData?.estandar?.length) setTonoCatalog(tonoData.estandar);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, [clienteId, categoria]);

  const filtradas = useMemo(() => {
    let out = applyOperativaFilters(rows, filtros);
    if (casoActivo && lineaCasoMap.size > 0) {
      out = out.filter(
        (r) => lookupCasoLinea(lineaCasoMap, r.linea_codigo_proveedor) === casoActivo,
      );
    }
    return out;
  }, [rows, filtros, casoActivo, lineaCasoMap]);

  const opciones = useMemo(() => buildOperativaOpciones(rows, filtros), [rows, filtros]);

  const cardsCount = useMemo(() => {
    const keys = new Set(
      filtradas.map(
        (p) =>
          `${p.linea_codigo_proveedor}-${p.referencia_codigo_proveedor}-${p.material_code}-${p.color_code}`,
      ),
    );
    return keys.size;
  }, [filtradas]);

  const totalPares = filtradas.reduce((s, p) => s + p.cantidad, 0);
  const valorInventario = useMemo(() => calcValorInventario(filtradas), [filtradas]);

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="h-2 w-64 overflow-hidden rounded-full bg-gray-200">
          <div className="h-full w-3/5 animate-pulse bg-bazzar-naranja" />
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="mx-auto max-w-4xl px-4">
        <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-6 text-center text-red-700">
          {err}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      <BibliotecaCasoBar
        clienteId={clienteId}
        categoria={categoria}
        bibliotecaId={bibliotecaId}
        casoActivo={casoActivo}
        onBibliotecaChange={setBibliotecaId}
        onCasoChange={setCasoActivo}
        onCasosLoaded={onCasosLoaded}
      />
      <TrianguloHeaderDeposito
        filtros={filtros}
        onChange={setFiltros}
        opciones={opciones}
        tonoCatalog={tonoCatalog}
        totalProductos={cardsCount}
        totalPares={totalPares}
        valorInventario={valorInventario}
        hideCategoria
        emptyFilters={CALZADO_FILTERS_BASE}
      />
      <FiltroCantidadOperativa
        applied={{
          cantidadOp: filtros.cantidadOp,
          cantidadValor: filtros.cantidadValor,
        }}
        onApply={(draft) =>
          setFiltros((prev) => ({
            ...prev,
            cantidadOp: draft.cantidadOp,
            cantidadValor: draft.cantidadValor,
          }))
        }
        onClear={() =>
          setFiltros((prev) => ({
            ...prev,
            cantidadOp: null,
            cantidadValor: null,
          }))
        }
      />
      <GrillaOperativaDeposito productos={filtradas} tienda={ente} casoPorLinea={lineaCasoMap} />
    </div>
  );
}
