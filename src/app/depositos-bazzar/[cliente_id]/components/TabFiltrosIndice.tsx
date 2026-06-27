"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import type { CategoriaDeposito } from "@/lib/depositos/depositos-config";
import {
  applyFiltroIndiceCaso,
  statsPorCaso,
} from "@/lib/depositos/filtros-indice";
import { normalizeDepositoRow } from "@/lib/depositos/operativa-filters";
import type { CasoBibliotecaRow } from "@/lib/motor-precios/biblioteca-editor";
import type { BibliotecaRow } from "@/lib/motor-precios/queries";
import { CabeceraFiltrosIndice } from "./CabeceraFiltrosIndice";
import { GrillaOperativaDeposito } from "./GrillaOperativaDeposito";

export type FiltrosIndiceStats = { productos: number; pares: number };

type Props = {
  cliente_id: string;
  categoria?: CategoriaDeposito;
  onExpandImage?: (p: DepositoRow) => void;
  onStatsChange?: (stats: FiltrosIndiceStats) => void;
};

type CasoPayload = Pick<
  CasoBibliotecaRow,
  "id" | "nombre_caso" | "lineas" | "lineas_count" | "indice_gs" | "dolar_politica" | "factor_conversion"
>;

export function TabFiltrosIndice({
  cliente_id,
  categoria = "tienda",
  onExpandImage,
  onStatsChange,
}: Props) {
  const [productos, setProductos] = useState<DepositoRow[]>([]);
  const [ente, setEnte] = useState("");
  const [bibliotecas, setBibliotecas] = useState<BibliotecaRow[]>([]);
  const [canonica, setCanonica] = useState<BibliotecaRow | null>(null);
  const [bibliotecaId, setBibliotecaId] = useState<number | null>(null);
  const [casos, setCasos] = useState<CasoPayload[]>([]);
  const [casoActivoId, setCasoActivoId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingBiblioteca, setLoadingBiblioteca] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const catParam = categoria === "tienda" ? "" : `&categoria=${categoria}`;

  const filtrosIndiceUrl = useCallback(
    (extra?: Record<string, string>) => {
      const sp = new URLSearchParams();
      if (categoria !== "tienda") sp.set("categoria", categoria);
      if (extra) {
        for (const [k, v] of Object.entries(extra)) sp.set(k, v);
      }
      const qs = sp.toString();
      return `/api/depositos/${cliente_id}/filtros-indice${qs ? `?${qs}` : ""}`;
    },
    [cliente_id, categoria],
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [prodRes, bibRes] = await Promise.all([
          fetch(`/api/depositos/${cliente_id}?limit=all${catParam}`, { cache: "no-store" }),
          fetch(filtrosIndiceUrl(), { cache: "no-store" }),
        ]);
        const prodData = await prodRes.json();
        const bibData = await bibRes.json();

        if (!prodData.configured || !bibData.configured) {
          setError("Base de datos no configurada");
          return;
        }
        if (prodData.error) throw new Error(prodData.error);
        if (bibData.error) throw new Error(bibData.error);

        const rows = (prodData.productos ?? []).map((r: DepositoRow) => normalizeDepositoRow(r));
        setProductos(rows);
        setEnte(prodData.ente ?? "");

        const libs: BibliotecaRow[] = bibData.bibliotecas ?? [];
        setBibliotecas(libs);
        setCanonica(bibData.canonica ?? null);
        const initialId = bibData.canonica?.id ?? libs[0]?.id ?? null;
        setBibliotecaId(initialId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar filtros por índice");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [cliente_id, catParam, filtrosIndiceUrl]);

  const loadCasos = useCallback(
    async (bid: number) => {
      setLoadingBiblioteca(true);
      setError(null);
      try {
        const res = await fetch(filtrosIndiceUrl({ biblioteca_id: String(bid) }), {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al cargar casos");
        setCasos(data.casos ?? []);
        setCasoActivoId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar casos");
        setCasos([]);
      } finally {
        setLoadingBiblioteca(false);
      }
    },
    [filtrosIndiceUrl],
  );

  useEffect(() => {
    if (bibliotecaId != null) loadCasos(bibliotecaId);
  }, [bibliotecaId, loadCasos]);

  const casosComoRows = casos as CasoBibliotecaRow[];
  const casoStats = useMemo(() => statsPorCaso(productos, casosComoRows), [productos, casosComoRows]);

  const casoActivo = useMemo(
    () => casos.find((c) => c.id === casoActivoId) ?? null,
    [casos, casoActivoId],
  );

  const filtrados = useMemo(() => {
    if (!casoActivo) return productos;
    return applyFiltroIndiceCaso(productos, casoActivo.lineas);
  }, [productos, casoActivo]);

  const cardsCount = useMemo(() => {
    const keys = new Set(
      filtrados.map(
        (p) =>
          `${p.linea_codigo_proveedor}-${p.referencia_codigo_proveedor}-${p.material_code}-${p.color_code}`,
      ),
    );
    return keys.size;
  }, [filtrados]);

  const totalPares = filtrados.reduce((s, p) => s + p.cantidad, 0);

  useEffect(() => {
    onStatsChange?.({ productos: cardsCount, pares: totalPares });
  }, [cardsCount, totalPares, onStatsChange]);

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="h-2 w-64 overflow-hidden rounded-full bg-gray-200">
          <div className="h-full w-3/5 animate-pulse bg-bazzar-naranja" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4">
        <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-6 text-center text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      <CabeceraFiltrosIndice
        bibliotecas={bibliotecas}
        bibliotecaId={bibliotecaId}
        canonica={canonica}
        casos={casosComoRows}
        casoStats={casoStats}
        casoActivoId={casoActivoId}
        onBibliotecaChange={(id) => setBibliotecaId(id)}
        onCasoSelect={setCasoActivoId}
        totalProductos={cardsCount}
        totalPares={totalPares}
        loadingBiblioteca={loadingBiblioteca}
      />
      <GrillaOperativaDeposito productos={filtrados} tienda={ente} onExpandImage={onExpandImage} />
    </div>
  );
}
