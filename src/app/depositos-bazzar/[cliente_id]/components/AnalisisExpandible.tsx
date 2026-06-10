"use client";

import { useState } from "react";
import type { AnalisisNodo } from "@/app/api/depositos/[cliente_id]/analisis/route";

type Props = {
  nodo: AnalisisNodo;
  profundidad?: number;
};

const COLORES_NIVEL = {
  pp: "bg-gray-700 text-white hover:bg-gray-800",
  genero: "bg-bazzar-naranja text-white hover:bg-bazzar-naranja-dark",
  marca: "bg-semantic-success text-white hover:bg-semantic-success/90",
  estilo: "bg-bazzar-naranja/10 text-bazzar-text-dark hover:bg-bazzar-naranja/20",
  producto: "bg-white text-gray-800 hover:bg-gray-50",
};

const ICONOS_NIVEL = {
  pp: "📦",
  genero: "👤",
  marca: "🏷️",
  estilo: "👟",
  producto: "📋",
};

function formatNumber(n: number): string {
  return Math.round(n).toLocaleString("es-PY");
}

export function AnalisisExpandible({ nodo, profundidad = 0 }: Props) {
  const [expanded, setExpanded] = useState(profundidad === 0);

  const tieneHijos = nodo.hijos && nodo.hijos.length > 0;
  const pctVendido = nodo.inicial > 0 ? (nodo.vendido / nodo.inicial) * 100 : 0;

  const estiloFondo = COLORES_NIVEL[nodo.nivel];
  const icono = ICONOS_NIVEL[nodo.nivel];

  return (
    <div className={`${profundidad > 0 ? "ml-6" : ""}`}>
      {/* Fila del nodo */}
      <div
        className={`group flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 ${estiloFondo} ${
          tieneHijos ? "cursor-pointer" : ""
        } transition-all`}
        onClick={() => tieneHijos && setExpanded(!expanded)}
      >
        {/* Izquierda: Label */}
        <div className="flex items-center gap-3">
          {tieneHijos && (
            <span className="text-lg transition-transform" style={{ transform: expanded ? "rotate(90deg)" : "" }}>
              ▶
            </span>
          )}
          {!tieneHijos && <span className="w-5" />}
          <span className="text-sm">{icono}</span>
          <span className="font-semibold">
            {nodo.label}
            {nodo.nivel !== "producto" && nodo.skus > 0 && (
              <span className="ml-2 text-xs opacity-75">({nodo.skus})</span>
            )}
          </span>
        </div>

        {/* Derecha: Métricas */}
        <div className="flex items-center gap-8 text-sm font-semibold">
          <div className="text-right">
            <div className="text-xs opacity-75">INICIAL</div>
            <div>{formatNumber(nodo.inicial)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs opacity-75">VENDIDO</div>
            <div>{formatNumber(nodo.vendido)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs opacity-75">SALDO</div>
            <div>{formatNumber(nodo.saldo)}</div>
          </div>
          {pctVendido > 0 && (
            <div className="text-right">
              <div className="text-xs opacity-75">% ROT.</div>
              <div>{pctVendido.toFixed(1)}%</div>
            </div>
          )}
        </div>
      </div>

      {/* Detalles del producto (solo para nivel producto) */}
      {nodo.nivel === "producto" && nodo.tallas && nodo.tallas.length > 0 && (
        <div className="ml-12 mt-2 rounded-lg bg-gray-50 px-4 py-2 text-xs text-gray-600">
          <span className="font-semibold">Tallas:</span> {nodo.tallas.sort().join(", ")}
        </div>
      )}

      {/* Hijos (recursivo) */}
      {expanded && tieneHijos && (
        <div className="mt-2 space-y-2">
          {nodo.hijos!.map((hijo) => (
            <AnalisisExpandible key={hijo.key} nodo={hijo} profundidad={profundidad + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
