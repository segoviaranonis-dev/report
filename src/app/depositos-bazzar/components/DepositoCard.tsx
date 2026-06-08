"use client";

import { useState } from "react";

type DepositoCardProps = {
  cliente_id: number;
  ente: string;
  tipo: "Adultos" | "Niños";
  registros: number;
  onSync: (cliente_id: number) => Promise<void>;
  syncing: boolean;
};

export function DepositoCard({
  cliente_id,
  ente,
  tipo,
  registros,
  onSync,
  syncing,
}: DepositoCardProps) {
  const [loading, setLoading] = useState(false);

  const handleSync = async () => {
    setLoading(true);
    try {
      await onSync(cliente_id);
    } finally {
      setLoading(false);
    }
  };

  const colorClass = tipo === "Niños"
    ? "border-green-500 bg-green-50"
    : "border-blue-500 bg-blue-50";

  const badgeClass = tipo === "Niños"
    ? "bg-green-100 text-green-800"
    : "bg-blue-100 text-blue-800";

  return (
    <div
      className={`rounded-2xl border-2 p-6 shadow-md transition-all hover:shadow-lg ${colorClass}`}
    >
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Cliente ID
          </div>
          <div className="text-3xl font-bold text-gray-800">{cliente_id}</div>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}
        >
          {tipo}
        </span>
      </div>

      {/* Ente */}
      <div className="mb-4">
        <div className="text-xl font-semibold text-gray-700">{ente}</div>
        <div className="text-sm text-gray-500">
          {ente === "San Martin" ? "San Martín" : ente}
        </div>
      </div>

      {/* Registros */}
      <div className="mb-6 rounded-lg bg-white p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Stock en depósito
        </div>
        <div className="text-2xl font-bold text-gray-800">
          {registros.toLocaleString("es-PY")} <span className="text-sm font-normal text-gray-500">registros</span>
        </div>
      </div>

      {/* Botones */}
      <div className="space-y-2">
        {/* Botón Abrir (SIEMPRE visible) */}
        <a
          href={`/depositos-bazzar/${cliente_id}`}
          className={`block w-full rounded-xl py-3 text-center font-semibold text-white transition-all ${
            tipo === "Niños"
              ? "bg-green-600 hover:bg-green-700"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          📋 Abrir Depósito
        </a>

        {/* Botón Sincronizar */}
        <button
          type="button"
          onClick={handleSync}
          disabled={loading || syncing}
          className={`w-full rounded-xl py-3 font-semibold transition-all ${
            loading || syncing
              ? "cursor-not-allowed bg-gray-400 text-white"
              : tipo === "Niños"
              ? "border-2 border-green-600 bg-white text-green-600 hover:bg-green-50"
              : "border-2 border-blue-600 bg-white text-blue-600 hover:bg-blue-50"
          }`}
        >
          {loading ? "Sincronizando..." : syncing ? "Esperando..." : "🔄 Sincronizar"}
        </button>
      </div>

      {/* Última actualización */}
      {registros > 0 && (
        <div className="mt-3 text-center text-xs text-gray-400">
          Listo para uso en tablets
        </div>
      )}
    </div>
  );
}
