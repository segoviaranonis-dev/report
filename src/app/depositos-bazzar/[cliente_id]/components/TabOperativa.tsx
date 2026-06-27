"use client";

import { useEffect, useMemo, useState } from "react";
import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import type { CategoriaDeposito } from "@/lib/depositos/depositos-config";
import {
  applyOperativaFilters,
  buildOperativaOpciones,
  EMPTY_OPERATIVA_FILTERS,
  normalizeDepositoRow,
  type OperativaFilterState,
} from "@/lib/depositos/operativa-filters";
import {
  COLORES_ESTANDAR_DEFAULT,
  type ColorEstandar,
} from "@/lib/pilares/colores-estandar";
import { GrillaOperativaDeposito } from "./GrillaOperativaDeposito";
import { TrianguloHeaderDeposito } from "./TrianguloHeaderDeposito";
import { FiltroCantidadOperativa } from "./FiltroCantidadOperativa";

export type OperativaStats = { productos: number; pares: number };

type Props = {
  cliente_id: string;
  categoria?: CategoriaDeposito;
  onExpandImage?: (p: DepositoRow) => void;
  onStatsChange?: (stats: OperativaStats) => void;
};

export function TabOperativa({ cliente_id, categoria = "tienda", onExpandImage, onStatsChange }: Props) {
  const [productos, setProductos] = useState<DepositoRow[]>([]);
  const [ente, setEnte] = useState("");
  const [tipo, setTipo] = useState("");
  const [tonoCatalog, setTonoCatalog] = useState<ColorEstandar[]>(COLORES_ESTANDAR_DEFAULT);
  const [filtros, setFiltros] = useState<OperativaFilterState>(EMPTY_OPERATIVA_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const catParam = categoria === "tienda" ? "" : `&categoria=${categoria}`;
        const [prodRes, tonoRes] = await Promise.all([
          fetch(`/api/depositos/${cliente_id}?limit=all${catParam}`, { cache: "no-store" }),
          fetch("/api/pilares/color?tipo_v2_id=1&limit=1", { cache: "no-store" }),
        ]);
        const prodData = await prodRes.json();
        const tonoData = await tonoRes.json().catch(() => null);

        if (!prodData.configured) {
          setError("Base de datos no configurada");
          return;
        }
        if (prodData.error) {
          setError(prodData.error);
          return;
        }

        const rows = (prodData.productos ?? []).map((r: DepositoRow) => normalizeDepositoRow(r));
        setProductos(rows);
        setEnte(prodData.ente ?? "");
        setTipo(prodData.tipo ?? "");
        if (tonoData?.estandar?.length) setTonoCatalog(tonoData.estandar);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar operativa");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [cliente_id, categoria]);

  const opciones = useMemo(() => buildOperativaOpciones(productos, filtros), [productos, filtros]);
  const filtrados = useMemo(() => applyOperativaFilters(productos, filtros), [productos, filtros]);
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
      <TrianguloHeaderDeposito
        filtros={filtros}
        onChange={setFiltros}
        opciones={opciones}
        tonoCatalog={tonoCatalog}
        totalProductos={cardsCount}
        totalPares={totalPares}
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
      <GrillaOperativaDeposito productos={filtrados} tienda={ente} onExpandImage={onExpandImage} />
    </div>
  );
}
