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
import {
  applyStockPeFilters,
  buildStockPeOpciones,
  countPeCards,
} from "@/lib/stock-pronta-entrega/stock-pe-filters";

type StockPeContextValue = {
  rows: DepositoRow[];
  loading: boolean;
  err: string | null;
  ente: string;
  tonoCatalog: ColorEstandar[];
  filtros: OperativaFilterState;
  setFiltros: Dispatch<SetStateAction<OperativaFilterState>>;
  depositoLegal: string;
  setDepositoLegal: Dispatch<SetStateAction<string>>;
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
  calzadoPares: number;
  confeccionesPares: number;
  calzadoGs: number;
  confeccionesGs: number;
};

const StockPeContext = createContext<StockPeContextValue | null>(null);

export function useStockPe(): StockPeContextValue {
  const ctx = useContext(StockPeContext);
  if (!ctx) throw new Error("useStockPe debe usarse dentro de StockPeProvider");
  return ctx;
}

export function StockPeProvider({ children }: { children: ReactNode }) {
  const [rows, setRows] = useState<DepositoRow[]>([]);
  const [tonoCatalog, setTonoCatalog] = useState<ColorEstandar[]>(COLORES_ESTANDAR_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [depositoLegal, setDepositoLegal] = useState("");
  const [filtros, setFiltros] = useState(EMPTY_OPERATIVA_FILTERS);

  useEffect(() => {
    setLoading(true);
    setErr(null);
    Promise.all([
      fetch("/api/stock-pronta-entrega/productos", { cache: "no-store" }),
      fetch("/api/pilares/color?tipo_v2_id=1&limit=1", { cache: "no-store" }),
    ])
      .then(async ([prodRes, tonoRes]) => {
        const j = await prodRes.json();
        const tonoData = await tonoRes.json().catch(() => null);
        if (!prodRes.ok || !j.ok) throw new Error(j.error ?? "Error productos");
        setRows((j.productos ?? []).map((p: DepositoRow) => normalizeDepositoRow(p)));
        if (tonoData?.estandar?.length) setTonoCatalog(tonoData.estandar);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, []);

  const filtradas = useMemo(
    () => applyStockPeFilters(rows, filtros, depositoLegal),
    [rows, filtros, depositoLegal],
  );
  const opciones = useMemo(
    () => buildStockPeOpciones(rows, filtros, depositoLegal),
    [rows, filtros, depositoLegal],
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
  const cardsCount = useMemo(() => countPeCards(filtradas), [filtradas]);
  const totalPares = useMemo(() => filtradas.reduce((s, p) => s + p.cantidad, 0), [filtradas]);
  const valorInventario = useMemo(() => calcValorInventario(filtradas), [filtradas]);

  const calzadoFiltrado = useMemo(
    () => filtradas.filter((r) => r.tipo_v2_id === 1),
    [filtradas],
  );
  const confeccionesFiltrado = useMemo(
    () => filtradas.filter((r) => r.tipo_v2_id === 2),
    [filtradas],
  );
  const calzadoPares = useMemo(
    () => calzadoFiltrado.reduce((s, p) => s + p.cantidad, 0),
    [calzadoFiltrado],
  );
  const confeccionesPares = useMemo(
    () => confeccionesFiltrado.reduce((s, p) => s + p.cantidad, 0),
    [confeccionesFiltrado],
  );
  const calzadoGs = useMemo(() => calcValorInventario(calzadoFiltrado), [calzadoFiltrado]);
  const confeccionesGs = useMemo(
    () => calcValorInventario(confeccionesFiltrado),
    [confeccionesFiltrado],
  );

  const value = useMemo(
    () => ({
      rows,
      loading,
      err,
      ente: "RIMEC PE",
      tonoCatalog,
      filtros,
      setFiltros,
      depositoLegal,
      setDepositoLegal,
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
      calzadoPares,
      confeccionesPares,
      calzadoGs,
      confeccionesGs,
    }),
    [
      rows,
      loading,
      err,
      tonoCatalog,
      filtros,
      depositoLegal,
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
      calzadoPares,
      confeccionesPares,
      calzadoGs,
      confeccionesGs,
    ],
  );

  return <StockPeContext.Provider value={value}>{children}</StockPeContext.Provider>;
}
