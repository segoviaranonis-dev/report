"use client";

import type { ReactNode } from "react";
import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import { BibliotecaCasoBar } from "@/app/depositos-bazzar/components/operativa/BibliotecaCasoBar";
import { GrillaPeImportadora } from "@/components/stock-pronta-entrega/GrillaPeImportadora";
import type { VentaCompradorLinea } from "@/lib/clientes/etiqueta-comprador";
import type { CasoBibliotecaLite } from "@/lib/depositos/caso-biblioteca";
import type {
  OperativaFilterState,
  OperativaOpciones,
} from "@/lib/depositos/operativa-filters";
import { PanelControlTrianguloHeader } from "./PanelControlTrianguloHeader";

type GrillaOpts = {
  showLlegada?: boolean;
  showVentas?: boolean;
  ventasPorMol?: Map<string, VentaCompradorLinea[]> | null;
};

type Props = {
  bibliotecaIndicePath: string;
  bibliotecaId: number | null;
  casoActivo: string | null;
  onBibliotecaChange: (id: number | null) => void;
  onCasoChange: (caso: string | null) => void;
  onCasosLoaded?: (casos: CasoBibliotecaLite[]) => void;
  filtros: OperativaFilterState;
  onFiltrosChange: React.Dispatch<React.SetStateAction<OperativaFilterState>>;
  opciones: OperativaOpciones;
  cardsCount: number;
  totalPares: number;
  valorInventario: number;
  summaryTrailing?: ReactNode;
  extraFilters?: ReactNode;
  productos: DepositoRow[];
  casoPorLinea?: Map<string, string> | null;
  grilla?: GrillaOpts;
  footer?: ReactNode;
};

/** Stack canónico Panel CP: Biblioteca → CABECERA DE FILTROS → GrillaPeImportadora. */
export function PanelControlGrillaStack({
  bibliotecaIndicePath,
  bibliotecaId,
  casoActivo,
  onBibliotecaChange,
  onCasoChange,
  onCasosLoaded,
  filtros,
  onFiltrosChange,
  opciones,
  cardsCount,
  totalPares,
  valorInventario,
  summaryTrailing,
  extraFilters,
  productos,
  casoPorLinea = null,
  grilla = {},
  footer,
}: Props) {
  const {
    showLlegada = false,
    showVentas = false,
    ventasPorMol = null,
  } = grilla;

  return (
    <div className="space-y-3">
      <BibliotecaCasoBar
        indiceApiPath={bibliotecaIndicePath}
        bibliotecaId={bibliotecaId}
        casoActivo={casoActivo}
        onBibliotecaChange={onBibliotecaChange}
        onCasoChange={onCasoChange}
        onCasosLoaded={onCasosLoaded ?? (() => {})}
      />
      <PanelControlTrianguloHeader
        filtros={filtros}
        onChange={onFiltrosChange}
        opciones={opciones}
        totalProductos={cardsCount}
        totalPares={totalPares}
        valorInventario={valorInventario}
        summaryTrailing={summaryTrailing}
        extraFilters={extraFilters}
      />
      <GrillaPeImportadora
        productos={productos}
        casoPorLinea={casoPorLinea}
        showLlegada={showLlegada}
        showVentas={showVentas}
        ventasPorMol={ventasPorMol}
      />
      {footer}
    </div>
  );
}
