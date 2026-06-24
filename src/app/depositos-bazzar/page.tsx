"use client";

import { useCallback, useEffect, useState } from "react";
import { DepositoCard } from "./components/DepositoCard";
import { CategoriaDepositoToggle } from "./components/CategoriaDepositoToggle";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import {
  CATEGORIA_DEPOSITO_META,
  parseCategoriaDeposito,
  type CategoriaDeposito,
} from "@/lib/depositos/depositos-config";

type DepositoEstado = {
  cliente_id: number;
  ente: string;
  tipo: "Adultos" | "Niños";
  categoria: CategoriaDeposito;
  tabla: string;
  registros: number;
  pares: number;
  error?: string;
};

type DepositosResponse = {
  configured: boolean;
  categoria?: CategoriaDeposito;
  depositos: DepositoEstado[];
  error?: string;
};

const DEPOSITOS_UI = [
  { cliente_id: 2100, ente: "Fernando", tipo: "Adultos" as const },
  { cliente_id: 2900, ente: "Fernando", tipo: "Niños" as const },
  { cliente_id: 2400, ente: "San Martin", tipo: "Adultos" as const },
  { cliente_id: 2700, ente: "San Martin", tipo: "Niños" as const },
  { cliente_id: 3100, ente: "Palma", tipo: "Adultos" as const },
  { cliente_id: 3200, ente: "Palma", tipo: "Niños" as const },
];

function categoriaFromUrl(): CategoriaDeposito {
  if (typeof window === "undefined") return "tienda";
  return parseCategoriaDeposito(new URLSearchParams(window.location.search).get("categoria"));
}

export default function DepositosBazzarPage() {
  const [categoria, setCategoria] = useState<CategoriaDeposito>("tienda");
  const [depositos, setDepositos] = useState<DepositoEstado[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const meta = CATEGORIA_DEPOSITO_META[categoria];
  const esTienda = categoria === "tienda";

  const loadEstados = useCallback(async (cat: CategoriaDeposito) => {
    try {
      const res = await fetch(`/api/depositos/sync?categoria=${cat}`);
      const raw = await res.text();
      let data: DepositosResponse;
      try {
        data = JSON.parse(raw) as DepositosResponse;
      } catch {
        throw new Error(
          res.ok
            ? "Respuesta inválida del servidor"
            : raw.slice(0, 120) || `HTTP ${res.status}`,
        );
      }

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
  }, []);

  useEffect(() => {
    const initial = categoriaFromUrl();
    setCategoria(initial);
    loadEstados(initial);
  }, [loadEstados]);

  const handleCategoriaChange = (cat: CategoriaDeposito) => {
    setCategoria(cat);
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    const url = new URL(window.location.href);
    if (cat === "tienda") {
      url.searchParams.delete("categoria");
    } else {
      url.searchParams.set("categoria", cat);
    }
    window.history.replaceState({}, "", url.toString());
    loadEstados(cat);
  };

  const handleSyncDeposito = async (cliente_id: number) => {
    if (!esTienda) return;
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

      await loadEstados(categoria);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al sincronizar depósito");
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncAll = async () => {
    if (!esTienda) return;
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
        `TODOS los depósitos tienda sincronizados: ${data.total_registros} registros en ${data.duracion_total_ms}ms`,
      );

      await loadEstados(categoria);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al sincronizar todos los depósitos");
    } finally {
      setSyncingAll(false);
      setSyncing(false);
    }
  };

  if (loading && depositos.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 text-xl font-semibold text-gray-700">
            Cargando depósitos Bazzar...
          </div>
          <div className="h-2 w-64 overflow-hidden rounded-full bg-gray-200">
            <div className="h-full animate-pulse bg-bazzar-naranja" style={{ width: "60%" }} />
          </div>
        </div>
      </div>
    );
  }

  const totalRegistros = depositos.reduce((sum, d) => sum + d.registros, 0);
  const totalPares = depositos.reduce((sum, d) => sum + (d.pares ?? 0), 0);

  return (
    <>
      <NexusGlobalHeader active="depositos-bazzar" title="Depósitos Bazzar" />
      <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-gray-50 to-gray-100 p-8">
        <div className="mx-auto min-w-0 max-w-7xl">
          <div className="mb-8 rounded-2xl bg-white p-8 shadow-lg">
            <h1 className="mb-2 text-4xl font-bold text-gray-800">
              Administrador de Depósitos Bazzar
            </h1>
            <p className="mb-6 text-gray-600">
              {meta.descripcion}
            </p>

            <div className="mb-6 flex flex-wrap items-center gap-6">
              <div className="rounded-lg bg-bazzar-naranja/15 px-6 py-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-bazzar-naranja">
                  Total pares · {meta.label}
                </div>
                <div className="text-2xl font-bold text-bazzar-text-dark">
                  {Math.round(totalPares).toLocaleString("es-PY")}
                </div>
              </div>
              <div className="rounded-lg bg-gray-100 px-6 py-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Total registros · {meta.label}
                </div>
                <div className="text-xl font-bold text-gray-700">
                  {totalRegistros.toLocaleString("es-PY")}
                </div>
              </div>
              <div className="rounded-lg bg-semantic-success/10 px-6 py-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-semantic-success">
                  Depósitos con stock
                </div>
                <div className="text-2xl font-bold text-semantic-success">
                  {depositos.filter((d) => d.registros > 0).length} / 6
                </div>
              </div>
            </div>

            <CategoriaDepositoToggle categoria={categoria} onChange={handleCategoriaChange} />

            {esTienda ? (
              <button
                type="button"
                onClick={handleSyncAll}
                disabled={syncingAll}
                className={`w-full rounded-xl py-4 text-lg font-bold text-white transition-all ${
                  syncingAll
                    ? "cursor-not-allowed bg-gray-400"
                    : "bg-gradient-to-r from-bazzar-naranja to-bazzar-naranja-dark hover:from-bazzar-naranja-dark hover:to-bazzar-naranja-dark active:from-bazzar-text-dark active:to-bazzar-text-dark"
                }`}
              >
                {syncingAll ? "Sincronizando todos los depósitos..." : "⚡ Sincronizar TODOS los depósitos (tienda)"}
              </button>
            ) : (
              <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-4 text-center text-sm text-gray-600">
                Sync Retail solo aplica a depósito <strong>TIENDA</strong> (nivel 1).{" "}
                <strong>Tablet Bazzar</strong> lee únicamente esas 6 tablas.
              </div>
            )}
          </div>

          {error && (
            <div className="mb-6 rounded-xl border-2 border-red-300 bg-red-50 p-4 text-red-800">
              <strong>Error:</strong> {error}
            </div>
          )}

          {successMessage && (
            <div className="mb-6 rounded-xl border-2 border-semantic-success/30 bg-semantic-success/10 p-4 text-semantic-success">
              <strong>Éxito:</strong> {successMessage}
            </div>
          )}

          <div className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {DEPOSITOS_UI.map((config) => {
              const estado = depositos.find((d) => d.cliente_id === config.cliente_id);

              return (
                <DepositoCard
                  key={config.cliente_id}
                  cliente_id={config.cliente_id}
                  ente={config.ente}
                  tipo={config.tipo}
                  categoria={categoria}
                  tabla={estado?.tabla ?? ""}
                  registros={estado?.registros || 0}
                  pares={estado?.pares ?? 0}
                  tablaError={estado?.error}
                  onSync={handleSyncDeposito}
                  syncing={syncing}
                />
              );
            })}
          </div>

          <div className="mt-8 rounded-xl bg-white p-6 text-center text-sm text-gray-500 shadow">
            {esTienda ? (
              <>
                <p>
                  <strong>Sincronización diaria desde:</strong> registro_st_vt_rc_reposicion
                </p>
                <p className="mt-2">
                  <strong>Filtro:</strong> cliente_id específico + tipo_movimiento = &apos;stock&apos;
                </p>
                <p className="mt-2 font-semibold text-bazzar-naranja">
                  Conectado a Tablet Bazzar POS
                </p>
              </>
            ) : (
              <p>
                Vista <strong>{meta.label}</strong> · tablas nivel {meta.nivel} · consulta admin · sin sync ni Tablet
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
