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
import type { VentaCompradorLinea } from "@/lib/clientes/etiqueta-comprador";
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
  EMPTY_OPERATIVA_FILTERS,
  normalizeDepositoRow,
  type OperativaFilterState,
  type OperativaOpciones,
} from "@/lib/depositos/operativa-filters";
import { calcValorInventario } from "@/lib/depositos/precio-venta";
import { COLORES_ESTANDAR_DEFAULT, type ColorEstandar } from "@/lib/pilares/colores-estandar";
import { loadProgramadoProductosPrefetch } from "@/lib/panel-control/prefetch-grilla-apis";
import {
  applyStockProgramadoFilters,
  buildStockProgramadoOpciones,
  countProgramadoCards,
} from "@/lib/stock-programado/stock-programado-filters";

type StockProgramadoContextValue = {
  rows: DepositoRow[];
  loading: boolean;
  err: string | null;
  tonoCatalog: ColorEstandar[];
  filtros: OperativaFilterState;
  setFiltros: Dispatch<SetStateAction<OperativaFilterState>>;
  quincenaIds: string[];
  setQuincenaIds: Dispatch<SetStateAction<string[]>>;
  ppIds: string[];
  setPpIds: Dispatch<SetStateAction<string[]>>;
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
  totalInicial: number;
  totalVendidos: number;
  valorInventario: number;
  ventasComprador: Map<string, VentaCompradorLinea[]>;
};

const StockProgramadoContext = createContext<StockProgramadoContextValue | null>(null);

export function useStockProgramado(): StockProgramadoContextValue {
  const ctx = useContext(StockProgramadoContext);
  if (!ctx) throw new Error("useStockProgramado debe usarse dentro de StockProgramadoProvider");
  return ctx;
}

export function StockProgramadoProvider({ children }: { children: ReactNode }) {
  const [rows, setRows] = useState<DepositoRow[]>([]);
  const [tonoCatalog, setTonoCatalog] = useState<ColorEstandar[]>(COLORES_ESTANDAR_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [quincenaIds, setQuincenaIds] = useState<string[]>([]);
  const [ppIds, setPpIds] = useState<string[]>([]);
  const [filtros, setFiltros] = useState(EMPTY_OPERATIVA_FILTERS);
  const [ventasComprador, setVentasComprador] = useState<Map<string, VentaCompradorLinea[]>>(
    () => new Map(),
  );

  useEffect(() => {
    setLoading(true);
    setErr(null);
    Promise.all([
      loadProgramadoProductosPrefetch(),
      fetch("/api/pilares/color?tipo_v2_id=1&limit=1", { cache: "no-store" }),
    ])
      .then(async ([j, tonoRes]) => {
        const tonoData = await tonoRes.json().catch(() => null);
        setRows(((j as { productos?: DepositoRow[] }).productos ?? []).map((p) => normalizeDepositoRow(p)));
        const raw = ((j as { ventasComprador?: Record<string, VentaCompradorLinea[]> }).ventasComprador ??
          {}) as Record<string, VentaCompradorLinea[]>;
        setVentasComprador(new Map(Object.entries(raw)));
        if (tonoData?.estandar?.length) setTonoCatalog(tonoData.estandar);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, []);

  const filtradas = useMemo(
    () => applyStockProgramadoFilters(rows, filtros, quincenaIds, ppIds),
    [rows, filtros, quincenaIds, ppIds],
  );
  const opciones = useMemo(
    () => buildStockProgramadoOpciones(rows, filtros, quincenaIds, ppIds),
    [rows, filtros, quincenaIds, ppIds],
  );
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
  const porTono = useMemo(() => agregarPorCampoFromRows(filtradas, tonoLabelRow), [filtradas]);
  const porGrada = useMemo(() => agregarPorGradaFromRows(filtradas), [filtradas]);
  const cardsCount = useMemo(() => countProgramadoCards(filtradas), [filtradas]);
  const totalPares = useMemo(() => filtradas.reduce((s, p) => s + p.cantidad, 0), [filtradas]);
  const totalInicial = useMemo(
    () => filtradas.reduce((s, p) => s + (p.cantidad_inicial ?? p.cantidad), 0),
    [filtradas],
  );
  const totalVendidos = useMemo(
    () => filtradas.reduce((s, p) => s + (p.pares_vendidos ?? 0), 0),
    [filtradas],
  );
  const valorInventario = useMemo(() => calcValorInventario(filtradas), [filtradas]);

  const value = useMemo(
    () => ({
      rows,
      loading,
      err,
      tonoCatalog,
      filtros,
      setFiltros,
      quincenaIds,
      setQuincenaIds,
      ppIds,
      setPpIds,
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
      totalInicial,
      totalVendidos,
      valorInventario,
      ventasComprador,
    }),
    [
      rows,
      loading,
      err,
      tonoCatalog,
      filtros,
      quincenaIds,
      ppIds,
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
      totalInicial,
      totalVendidos,
      valorInventario,
      ventasComprador,
    ],
  );

  return <StockProgramadoContext.Provider value={value}>{children}</StockProgramadoContext.Provider>;
}
