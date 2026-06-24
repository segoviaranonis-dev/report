"use client";

import { useState } from "react";
import type { CategoriaDeposito } from "@/lib/depositos/depositos-config";
import { CATEGORIA_DEPOSITO_META } from "@/lib/depositos/depositos-config";

type DepositoCardProps = {
  cliente_id: number;
  ente: string;
  tipo: "Adultos" | "Niños";
  categoria: CategoriaDeposito;
  tabla: string;
  registros: number;
  pares: number;
  tablaError?: string;
  onSync: (cliente_id: number) => Promise<void>;
  syncing: boolean;
};

export function DepositoCard({
  cliente_id,
  ente,
  tipo,
  categoria,
  tabla,
  registros,
  pares,
  tablaError,
  onSync,
  syncing,
}: DepositoCardProps) {
  const [loading, setLoading] = useState(false);
  const meta = CATEGORIA_DEPOSITO_META[categoria];
  const esTienda = categoria === "tienda";

  const handleSync = async () => {
    setLoading(true);
    try {
      await onSync(cliente_id);
    } finally {
      setLoading(false);
    }
  };

  const colorClass = tipo === "Niños"
    ? "border-semantic-success bg-semantic-success/10"
    : "border-bazzar-naranja bg-bazzar-naranja/10";

  const badgeClass = tipo === "Niños"
    ? "bg-semantic-success/15 text-semantic-success"
    : "bg-bazzar-naranja/15 text-bazzar-text-dark";

  const detailHref =
    categoria === "tienda"
      ? `/depositos-bazzar/${cliente_id}`
      : `/depositos-bazzar/${cliente_id}?categoria=${categoria}`;

  return (
    <div
      className={`min-w-0 rounded-2xl border-2 p-6 shadow-md transition-all hover:shadow-lg ${colorClass}`}
    >
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Cliente ID
          </div>
          <div className="text-3xl font-bold text-gray-800">{cliente_id}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>
            {tipo}
          </span>
          <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
            {meta.label}
          </span>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-xl font-semibold text-gray-700">{ente}</div>
        {tabla && (
          <div className="mt-1 break-all font-mono text-[10px] text-gray-400">{tabla}</div>
        )}
      </div>

      <div className="mb-6 rounded-lg bg-white p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Stock en depósito
        </div>
        <div className="text-3xl font-bold text-gray-900">
          {Math.round(pares).toLocaleString("es-PY")}{" "}
          <span className="text-lg font-bold text-bazzar-naranja">pares</span>
        </div>
        <div className="mt-1 text-sm text-gray-500">
          {registros.toLocaleString("es-PY")} registros
        </div>
        {tablaError && (
          <div className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-800">
            Tabla no encontrada o sin acceso: {tablaError}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <a
          href={detailHref}
          className={`block w-full rounded-xl py-3 text-center font-semibold text-white transition-all ${
            tipo === "Niños"
              ? "bg-semantic-success hover:bg-semantic-success/90"
              : "bg-bazzar-naranja hover:bg-bazzar-naranja-dark"
          }`}
        >
          📋 Abrir Depósito
        </a>

        {esTienda && (
          <button
            type="button"
            onClick={handleSync}
            disabled={loading || syncing}
            className={`w-full rounded-xl py-3 font-semibold transition-all ${
              loading || syncing
                ? "cursor-not-allowed bg-gray-400 text-white"
                : tipo === "Niños"
                  ? "border-2 border-semantic-success bg-white text-semantic-success hover:bg-semantic-success/10"
                  : "border-2 border-bazzar-naranja bg-white text-bazzar-naranja hover:bg-bazzar-naranja/10"
            }`}
          >
            {loading ? "Sincronizando..." : syncing ? "Esperando..." : "🔄 Sincronizar"}
          </button>
        )}
      </div>

      {esTienda && registros > 0 && (
        <div className="mt-3 text-center text-xs font-semibold text-bazzar-naranja">
          Conectado a Tablet Bazzar
        </div>
      )}

      {!esTienda && (
        <div className="mt-3 text-center text-xs text-gray-400">
          Solo consulta · ETL pendiente
        </div>
      )}
    </div>
  );
}
