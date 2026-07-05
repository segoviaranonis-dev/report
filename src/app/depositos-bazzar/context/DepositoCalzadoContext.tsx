"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import type { CategoriaDeposito } from "@/lib/depositos/depositos-config";
import {
  buildEstiloMarcaDrillFromRows,
  buildEstiloTonoDrillFromRows,
  type EstiloDrill,
  type EstiloMarcaDrill,
} from "@/lib/depositos/deposito-estadisticas-drill";
import type { StatSlice } from "@/lib/depositos/deposito-estadisticas-charts";
import {
  agregarPorCampoFromRows,
  agregarPorGradaFromRows,
  tonoLabelRow,
} from "@/lib/depositos/deposito-estadisticas-rows";
import {
  applyOperativaFilters,
  buildOperativaOpciones,
  EMPTY_OPERATIVA_FILTERS,
  normalizeDepositoRow,
  type OperativaFilterState,
  type OperativaOpciones,
} from "@/lib/depositos/operativa-filters";
import { calcValorInventario } from "@/lib/depositos/precio-venta";
import { TIPO_V2_CALZADO } from "@/lib/depositos/pilar-proveedor-index";
import { COLORES_ESTANDAR_DEFAULT, type ColorEstandar } from "@/lib/pilares/colores-estandar";

export const CALZADO_FILTERS_BASE: OperativaFilterState = {
  ...EMPTY_OPERATIVA_FILTERS,
  tipoV2Ids: [TIPO_V2_CALZADO],
};

type DepositoCalzadoContextValue = {
  rows: DepositoRow[];
  loading: boolean;
  err: string | null;
  ente: string;
  tonoCatalog: ColorEstandar[];
  filtros: OperativaFilterState;
  setFiltros: Dispatch<SetStateAction<OperativaFilterState>>;
  filtradas: DepositoRow[];
  opciones: OperativaOpciones;
  drill: EstiloDrill[];
  estiloMarcaDrill: EstiloMarcaDrill[];
  porMarca: StatSlice[];
  porEstilo: StatSlice[];
  porTono: StatSlice[];
  porGrada: StatSlice[];
  cardsCount: number;
  totalPares: number;
  valorInventario: number;
};

const DepositoCalzadoContext = createContext<DepositoCalzadoContextValue | null>(null);

export function useDepositoCalzado(): DepositoCalzadoContextValue {
  const ctx = useContext(DepositoCalzadoContext);
  if (!ctx) {
    throw new Error("useDepositoCalzado debe usarse dentro de DepositoCalzadoProvider");
  }
  return ctx;
}

type ProviderProps = {
  clienteId: number;
  categoria: CategoriaDeposito;
  refreshKey?: number;
  children: ReactNode;
};

export function DepositoCalzadoProvider({
  clienteId,
  categoria,
  refreshKey = 0,
  children,
}: ProviderProps) {
  const [rows, setRows] = useState<DepositoRow[]>([]);
  const [ente, setEnte] = useState("");
  const [tonoCatalog, setTonoCatalog] = useState<ColorEstandar[]>(COLORES_ESTANDAR_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<OperativaFilterState>(CALZADO_FILTERS_BASE);

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
        if (!prodRes.ok || j.error) {
          setErr(j.error || `Error HTTP ${prodRes.status}`);
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
  }, [clienteId, categoria, refreshKey]);

  const filtradas = useMemo(() => applyOperativaFilters(rows, filtros), [rows, filtros]);
  const opciones = useMemo(() => buildOperativaOpciones(rows, filtros), [rows, filtros]);
  const drill = useMemo(() => buildEstiloTonoDrillFromRows(filtradas), [filtradas]);
  const estiloMarcaDrill = useMemo(() => buildEstiloMarcaDrillFromRows(filtradas), [filtradas]);
  const porMarca = useMemo(
    () => agregarPorCampoFromRows(filtradas, (r) => r.marca || "Sin marca"),
    [filtradas],
  );
  const porEstilo = useMemo(
    () => agregarPorCampoFromRows(filtradas, (r) => r.estilo || "Sin estilo"),
    [filtradas],
  );
  const porTono = useMemo(
    () => agregarPorCampoFromRows(filtradas, tonoLabelRow),
    [filtradas],
  );
  const porGrada = useMemo(() => agregarPorGradaFromRows(filtradas), [filtradas]);

  const cardsCount = useMemo(() => {
    const keys = new Set(
      filtradas.map(
        (p) =>
          `${p.linea_codigo_proveedor}-${p.referencia_codigo_proveedor}-${p.material_code}-${p.color_code}`,
      ),
    );
    return keys.size;
  }, [filtradas]);

  const totalPares = useMemo(
    () => filtradas.reduce((s, p) => s + p.cantidad, 0),
    [filtradas],
  );
  const valorInventario = useMemo(() => calcValorInventario(filtradas), [filtradas]);

  const value = useMemo(
    () => ({
      rows,
      loading,
      err,
      ente,
      tonoCatalog,
      filtros,
      setFiltros,
      filtradas,
      opciones,
      drill,
      estiloMarcaDrill,
      porMarca,
      porEstilo,
      porTono,
      porGrada,
      cardsCount,
      totalPares,
      valorInventario,
    }),
    [
      rows,
      loading,
      err,
      ente,
      tonoCatalog,
      filtros,
      filtradas,
      opciones,
      drill,
      estiloMarcaDrill,
      porMarca,
      porEstilo,
      porTono,
      porGrada,
      cardsCount,
      totalPares,
      valorInventario,
    ],
  );

  return (
    <DepositoCalzadoContext.Provider value={value}>{children}</DepositoCalzadoContext.Provider>
  );
}
