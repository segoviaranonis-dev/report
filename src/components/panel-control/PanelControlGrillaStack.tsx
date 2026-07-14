"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import { BibliotecaCasoBar } from "@/app/depositos-bazzar/components/operativa/BibliotecaCasoBar";
import { GrillaPeImportadora } from "@/components/stock-pronta-entrega/GrillaPeImportadora";
import type { VentaCompradorLinea } from "@/lib/clientes/etiqueta-comprador";
import type { CasoBibliotecaLite } from "@/lib/depositos/caso-biblioteca";
import type {
  OperativaFilterState,
  OperativaOpciones,
} from "@/lib/depositos/operativa-filters";
import type { GrillaLoteModo } from "@/lib/panel-control/grilla-carga-lotes";
import { moleculeKeyImagen } from "@/lib/retail/product-image-presence";
import { PanelControlTrianguloHeader } from "./PanelControlTrianguloHeader";
import { SinImagenCabeceraChip } from "./SinImagenCabeceraChip";

type GrillaOpts = {
  showLlegada?: boolean;
  showVentas?: boolean;
  ventasPorMol?: Map<string, VentaCompradorLinea[]> | null;
  loteModo?: GrillaLoteModo;
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
    loteModo = "unitario",
  } = grilla;

  const [soloSinImagen, setSoloSinImagen] = useState(false);
  const [faltantes, setFaltantes] = useState<Set<string>>(() => new Set());

  const onFaltantesChange = useCallback((keys: Set<string>) => {
    setFaltantes(keys);
    if (keys.size === 0) setSoloSinImagen(false);
  }, []);

  const productosVista = useMemo(() => {
    if (!soloSinImagen || faltantes.size === 0) return productos;
    return productos.filter((p) =>
      faltantes.has(
        moleculeKeyImagen({
          linea: p.linea_codigo_proveedor,
          referencia: p.referencia_codigo_proveedor,
          material: p.material_code,
          color: p.color_code,
          tipo_v2_id: p.tipo_v2_id,
        }),
      ),
    );
  }, [productos, soloSinImagen, faltantes]);

  const trailing = (
    <>
      <SinImagenCabeceraChip
        productos={productos}
        soloSinImagen={soloSinImagen}
        onSoloSinImagenChange={setSoloSinImagen}
        onFaltantesChange={onFaltantesChange}
      />
      {summaryTrailing}
    </>
  );

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
        summaryTrailing={trailing}
        extraFilters={extraFilters}
      />
      <GrillaPeImportadora
        productos={productosVista}
        casoPorLinea={casoPorLinea}
        showLlegada={showLlegada}
        showVentas={showVentas}
        ventasPorMol={ventasPorMol}
        loteModo={loteModo}
      />
      {footer}
    </div>
  );
}
