"use client";

import {
  createContext,
  useCallback,
  useContext,
  useDeferredValue,
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
  type TrianguloMaestrasOverride,
} from "@/lib/depositos/operativa-filters";
import { calcValorInventario } from "@/lib/depositos/precio-venta";
import { COLORES_ESTANDAR_DEFAULT, type ColorEstandar } from "@/lib/pilares/colores-estandar";
import { fetchMaestrasFiltroTriangulo } from "@/lib/pilares/fetch-maestras-filtro-client";
import {
  loadPeProductosPrefetch,
  readPeProductosSession,
  writePeProductosSession,
} from "@/lib/panel-control/prefetch-grilla-apis";
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
  /** Actualiza tono_etiqueta en todas las filas del color_id (post-PATCH pilares). */
  applyTonoLocal: (colorId: number, etiqueta: string | null) => void;
  applyLrLocal: (
    lrId: number,
    patch: {
      grupo_estilo_id?: number | null;
      estilo?: string | null;
      tipo_1_id?: number | null;
      tipo_1?: string | null;
    },
  ) => void;
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
  reloadProductos: () => Promise<void>;
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
  const [trianguloMaestras, setTrianguloMaestras] = useState<TrianguloMaestrasOverride | null>(null);
  const [qDebounced, setQDebounced] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(filtros.q), 280);
    return () => window.clearTimeout(t);
  }, [filtros.q]);
  const filtrosCompute = useMemo(
    () => ({ ...filtros, q: qDebounced }),
    [filtros, qDebounced],
  );
  const filtrosDeferred = useDeferredValue(filtrosCompute);

  useEffect(() => {
    let cancelled = false;
    void fetchMaestrasFiltroTriangulo(filtros.ramoTipo).then((m) => {
      if (cancelled) return;
      if (!m) {
        setTrianguloMaestras(null);
        return;
      }
      setTrianguloMaestras({ estilos: m.estilos, generos: m.generos });
    });
    return () => {
      cancelled = true;
    };
  }, [filtros.ramoTipo]);

  const reloadProductos = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const j = await loadPeProductosPrefetch({ fresh: true });
      setRows(((j as { productos?: DepositoRow[] }).productos ?? []).map((p) => normalizeDepositoRow(p)));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const stale = readPeProductosSession();
    if (stale?.productos && Array.isArray(stale.productos) && stale.productos.length > 0) {
      setRows((stale.productos as DepositoRow[]).map((p) => normalizeDepositoRow(p)));
      setLoading(false);
    } else {
      setLoading(true);
    }
    setErr(null);

    /** Tono no bloquea la grilla. */
    void Promise.all([
      fetch("/api/pilares/color?tipo_v2_id=1&limit=1", { cache: "no-store" }),
      fetch("/api/pilares/color?tipo_v2_id=2&limit=1", { cache: "no-store" }),
    ])
      .then(async ([tono1Res, tono2Res]) => {
        if (cancelled) return;
        const t1 = await tono1Res.json().catch(() => null);
        const t2 = await tono2Res.json().catch(() => null);
        const map = new Map<string, ColorEstandar>();
        for (const c of [...(t1?.estandar ?? []), ...(t2?.estandar ?? [])] as ColorEstandar[]) {
          if (c?.etiqueta && !map.has(c.etiqueta)) map.set(c.etiqueta, c);
        }
        if (map.size) setTonoCatalog([...map.values()]);
      })
      .catch(() => {});

    /** Pintar calzado primero (~mitad) · luego merge confecciones — perceived < cold full. */
    const pCalz = loadPeProductosPrefetch({ tipo_v2: 1 });
    const pConf = loadPeProductosPrefetch({ tipo_v2: 2 });

    void pCalz
      .then((j) => {
        if (cancelled) return;
        const prods = ((j as { productos?: DepositoRow[] }).productos ?? []).map((p) =>
          normalizeDepositoRow(p),
        );
        setRows((prev) => {
          if (stale?.productos && prev.length > prods.length) return prev;
          return prods;
        });
        setLoading(false);
      })
      .catch(() => {});

    void Promise.all([pCalz, pConf])
      .then(([a, b]) => {
        if (cancelled) return;
        const merged = [
          ...(((a as { productos?: DepositoRow[] }).productos ?? []) as DepositoRow[]),
          ...(((b as { productos?: DepositoRow[] }).productos ?? []) as DepositoRow[]),
        ].map((p) => normalizeDepositoRow(p));
        setRows(merged);
        writePeProductosSession({
          ok: true,
          productos: merged,
          cajas: merged.length,
          pares: merged.reduce((s, r) => s + (r.cantidad || 0), 0),
        });
      })
      .catch((e) => {
        if (cancelled) return;
        if (!stale?.productos) setErr(e instanceof Error ? e.message : "Error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filtradas = useMemo(
    () => applyStockPeFilters(rows, filtrosDeferred, depositoLegal),
    [rows, filtrosDeferred, depositoLegal],
  );
  const opciones = useMemo(
    () => buildStockPeOpciones(rows, filtrosDeferred, depositoLegal, trianguloMaestras),
    [rows, filtrosDeferred, depositoLegal, trianguloMaestras],
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

  const applyTonoLocal = useCallback((colorId: number, etiqueta: string | null) => {
    if (!colorId) return;
    setRows((prev) =>
      prev.map((r) =>
        r.color_id === colorId
          ? { ...r, tono_etiqueta: etiqueta?.trim() ? etiqueta.trim() : null }
          : r,
      ),
    );
  }, []);

  const applyLrLocal = useCallback(
    (
      lrId: number,
      patch: {
        grupo_estilo_id?: number | null;
        estilo?: string | null;
        tipo_1_id?: number | null;
        tipo_1?: string | null;
      },
    ) => {
      if (!lrId) return;
      setRows((prev) =>
        prev.map((r) => {
          if (r.linea_referencia_id !== lrId) return r;
          return {
            ...r,
            ...patch,
            estilo:
              patch.estilo !== undefined
                ? patch.estilo?.trim() || "(sin estilo)"
                : r.estilo,
            tipo_1:
              patch.tipo_1 !== undefined
                ? patch.tipo_1?.trim() || "OTROS"
                : r.tipo_1,
          };
        }),
      );
    },
    [],
  );

  const value = useMemo(
    () => ({
      rows,
      loading,
      err,
      ente: "RIMEC PE",
      tonoCatalog,
      applyTonoLocal,
      applyLrLocal,
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
      reloadProductos,
    }),
    [
      rows,
      loading,
      err,
      tonoCatalog,
      applyTonoLocal,
      applyLrLocal,
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
      reloadProductos,
    ],
  );

  return <StockPeContext.Provider value={value}>{children}</StockPeContext.Provider>;
}
