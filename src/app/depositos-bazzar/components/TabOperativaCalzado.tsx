"use client";

import { useCallback, useMemo, useState } from "react";
import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import type { CategoriaDeposito } from "@/lib/depositos/depositos-config";
import {
  CALZADO_FILTERS_BASE,
  useDepositoCalzado,
} from "@/app/depositos-bazzar/context/DepositoCalzadoContext";
import {
  buildLineaCasoMap,
  lookupCasoLinea,
  type CasoBibliotecaLite,
} from "@/lib/depositos/caso-biblioteca";
import { BibliotecaCasoBar } from "./operativa/BibliotecaCasoBar";
import { FiltroCantidadOperativa } from "./operativa/FiltroCantidadOperativa";
import { GrillaOperativaDeposito } from "./operativa/GrillaOperativaDeposito";
import { TrianguloHeaderDeposito } from "./operativa/TrianguloHeaderDeposito";

type Props = {
  clienteId: number;
  categoria: CategoriaDeposito;
};

export function TabOperativaCalzado({ clienteId, categoria }: Props) {
  const {
    loading,
    err,
    ente,
    tonoCatalog,
    filtros,
    setFiltros,
    filtradas,
    opciones,
    cardsCount,
    totalPares,
    valorInventario,
  } = useDepositoCalzado();

  const [bibliotecaId, setBibliotecaId] = useState<number | null>(null);
  const [casoActivo, setCasoActivo] = useState<string | null>(null);
  const [lineaCasoMap, setLineaCasoMap] = useState<Map<string, string>>(() => new Map());

  const onCasosLoaded = useCallback((casos: CasoBibliotecaLite[]) => {
    setLineaCasoMap(buildLineaCasoMap(casos));
  }, []);

  const filtradasGrid = useMemo(() => {
    if (!casoActivo || lineaCasoMap.size === 0) return filtradas;
    return filtradas.filter(
      (r) => lookupCasoLinea(lineaCasoMap, r.linea_codigo_proveedor) === casoActivo,
    );
  }, [filtradas, casoActivo, lineaCasoMap]);

  if (loading || err) return null;

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
      <GrillaOperativaDeposito
        productos={filtradasGrid as DepositoRow[]}
        tienda={ente}
        casoPorLinea={lineaCasoMap}
      />
    </div>
  );
}
