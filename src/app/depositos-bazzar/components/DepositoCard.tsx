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
    ? "border-semantic-success bg-semantic-success/10"
    : "border-bazzar-naranja bg-bazzar-naranja/10";

  const badgeClass = tipo === "Niños"
    ? "bg-semantic-success/15 text-semantic-success"
    : "bg-bazzar-naranja/15 text-bazzar-text-dark";

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
              ? "bg-semantic-success hover:bg-semantic-success/90"
              : "bg-bazzar-naranja hover:bg-bazzar-naranja-dark"
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
              ? "border-2 border-semantic-success bg-white text-semantic-success hover:bg-semantic-success/10"
              : "border-2 border-bazzar-naranja bg-white text-bazzar-naranja hover:bg-bazzar-naranja/10"
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
