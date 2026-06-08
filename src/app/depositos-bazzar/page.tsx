"use client";

import { useEffect, useState } from "react";
import { DepositoCard } from "./components/DepositoCard";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";

type DepositoEstado = {
  cliente_id: number;
  ente: string;
  tipo: "Adultos" | "Niños";
  registros: number;
  error?: string;
};

type DepositosResponse = {
  configured: boolean;
  depositos: DepositoEstado[];
  error?: string;
};

const DEPOSITOS_CONFIG = [
  { cliente_id: 2100, ente: "Fernando", tipo: "Adultos" as const },
  { cliente_id: 2900, ente: "Fernando", tipo: "Niños" as const },
  { cliente_id: 2400, ente: "San Martin", tipo: "Adultos" as const },
  { cliente_id: 2700, ente: "San Martin", tipo: "Niños" as const },
  { cliente_id: 3100, ente: "Palma", tipo: "Adultos" as const },
  { cliente_id: 3200, ente: "Palma", tipo: "Niños" as const },
];

export default function DepositosBazzarPage() {
  const [depositos, setDepositos] = useState<DepositoEstado[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Cargar estado inicial
  const loadEstados = async () => {
    try {
      const res = await fetch("/api/depositos/sync");
      const data: DepositosResponse = await res.json();

      if (!data.configured) {
        setError("Base de datos no configurada");
        return;
      }

      setDepositos(data.depositos);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar depósitos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEstados();
  }, []);

  // Sincronizar un depósito individual
  const handleSyncDeposito = async (cliente_id: number) => {
    setSyncing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/depositos/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cliente_id }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Error al sincronizar");
      }

      const resultado = data.resultados[0];
      setSuccessMessage(
        `${resultado.ente} ${resultado.tipo}: ${resultado.registros_insertados} registros sincronizados en ${resultado.duracion_ms}ms`,
      );

      // Recargar estados
      await loadEstados();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al sincronizar depósito");
    } finally {
      setSyncing(false);
    }
  };

  // Sincronizar TODOS los depósitos
  const handleSyncAll = async () => {
    setSyncingAll(true);
    setSyncing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/depositos/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Error al sincronizar todos los depósitos");
      }

      setSuccessMessage(
        `TODOS los depósitos sincronizados: ${data.total_registros} registros en ${data.duracion_total_ms}ms`,
      );

      // Recargar estados
      await loadEstados();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al sincronizar todos los depósitos");
    } finally {
      setSyncingAll(false);
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 text-xl font-semibold text-gray-700">
            Cargando depósitos Bazzar...
          </div>
          <div className="h-2 w-64 overflow-hidden rounded-full bg-gray-200">
            <div className="h-full animate-pulse bg-blue-500" style={{ width: "60%" }} />
          </div>
        </div>
      </div>
    );
  }

  const totalRegistros = depositos.reduce((sum, d) => sum + d.registros, 0);

  return (
    <>
      <NexusGlobalHeader active="depositos-bazzar" title="Depósitos Bazzar" />
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
        {/* Header */}
        <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-2xl bg-white p-8 shadow-lg">
          <h1 className="mb-2 text-4xl font-bold text-gray-800">
            Administrador de Depósitos Bazzar
          </h1>
          <p className="mb-6 text-gray-600">
            Gestión de stock para las 6 tiendas · Sistema POS Tablet
          </p>

          {/* Estadísticas globales */}
          <div className="mb-6 flex items-center gap-6">
            <div className="rounded-lg bg-blue-50 px-6 py-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                Total Registros
              </div>
              <div className="text-2xl font-bold text-blue-800">
                {totalRegistros.toLocaleString("es-PY")}
              </div>
            </div>
            <div className="rounded-lg bg-green-50 px-6 py-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-green-600">
                Depósitos Activos
              </div>
              <div className="text-2xl font-bold text-green-800">
                {depositos.filter((d) => d.registros > 0).length} / 6
              </div>
            </div>
          </div>

          {/* Botón Sincronizar TODOS */}
          <button
            type="button"
            onClick={handleSyncAll}
            disabled={syncingAll}
            className={`w-full rounded-xl py-4 text-lg font-bold text-white transition-all ${
              syncingAll
                ? "cursor-not-allowed bg-gray-400"
                : "bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 active:from-blue-800 active:to-green-800"
            }`}
          >
            {syncingAll ? "Sincronizando todos los depósitos..." : "⚡ Sincronizar TODOS los depósitos"}
          </button>
        </div>

        {/* Mensajes */}
        {error && (
          <div className="mb-6 rounded-xl border-2 border-red-300 bg-red-50 p-4 text-red-800">
            <strong>Error:</strong> {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-6 rounded-xl border-2 border-green-300 bg-green-50 p-4 text-green-800">
            <strong>Éxito:</strong> {successMessage}
          </div>
        )}

        {/* Grid de 6 depósitos */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {DEPOSITOS_CONFIG.map((config) => {
            const estado = depositos.find((d) => d.cliente_id === config.cliente_id);

            return (
              <DepositoCard
                key={config.cliente_id}
                cliente_id={config.cliente_id}
                ente={config.ente}
                tipo={config.tipo}
                registros={estado?.registros || 0}
                onSync={handleSyncDeposito}
                syncing={syncing}
              />
            );
          })}
        </div>

        {/* Footer info */}
        {/* Footer info */}
        <div className="mt-8 rounded-xl bg-white p-6 text-center text-sm text-gray-500 shadow">
          <p>
            <strong>Sincronización diaria desde:</strong> registro_st_vt_rc_reposicion
          </p>
          <p className="mt-2">
            <strong>Filtro:</strong> cliente_id específico + tipo_movimiento = &apos;stock&apos;
          </p>
        </div>
      </div>
    </div>
    </>
  );
}
