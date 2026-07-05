"use client";

import { useEffect, useState } from "react";
import type { AnalisisResponse } from "@/app/api/depositos/[cliente_id]/analisis/route";
import type { CategoriaDeposito } from "@/lib/depositos/depositos-config";
import { AnalisisGraficos } from "./AnalisisGraficos";

type Props = {
  cliente_id: string;
  categoria?: CategoriaDeposito;
};

export function TabAnalisis({ cliente_id, categoria = "tienda" }: Props) {
  const [data, setData] = useState<AnalisisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [soloConSaldo, setSoloConSaldo] = useState(true);

  useEffect(() => {
    const loadAnalisis = async () => {
      try {
        const catQ = categoria === "tienda" ? "" : `?categoria=${categoria}`;
        const res = await fetch(`/api/depositos/${cliente_id}/analisis${catQ}`);
        const result: AnalisisResponse = await res.json();

        if (!result.configured) {
          setError("Base de datos no configurada");
          return;
        }

        if (result.error) {
          setError(result.error);
          return;
        }

        setData(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar análisis");
      } finally {
        setLoading(false);
      }
    };

    loadAnalisis();
  }, [cliente_id, categoria]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-xl font-semibold text-gray-700">
            Cargando análisis...
          </div>
          <div className="h-2 w-64 overflow-hidden rounded-full bg-gray-200">
            <div className="h-full w-3/5 animate-pulse bg-bazzar-naranja" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-4xl px-4">
        <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-8 text-center">
          <div className="mb-4 text-4xl">❌</div>
          <div className="mb-2 text-xl font-bold text-red-800">Error</div>
          <div className="text-red-700">{error || "Error desconocido"}</div>
        </div>
      </div>
    );
  }

  const { resumen, resumen_operativo, analisis_por_estilo, analisis_por_marca } = data;

  return (
    <div className="mx-auto max-w-6xl px-4">
      <div className="mb-6 flex items-center justify-between">
          <label className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            <input
              type="checkbox"
              checked={soloConSaldo}
              onChange={(e) => setSoloConSaldo(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-bazzar-naranja focus:ring-bazzar-naranja"
            />
            Solo con saldo &gt; 0
          </label>

        <button
          type="button"
          onClick={() => setSoloConSaldo(true)}
          className="text-xs font-semibold text-bazzar-naranja hover:underline"
        >
          Limpiar filtros
        </button>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="Inicial" value={resumen.inicial} suffix="pares" variant="orange" />
        <MetricCard label="Vendido" value={resumen.vendido} suffix="pares" variant="green" />
        <MetricCard label="Saldo" value={resumen.saldo} suffix="pares" variant="orange-dark" />
        <MetricCard label="% Vendido" value={resumen.pct_vendido} suffix="rotación" variant="orange" isPct />
        <MetricCard label="SKUs" value={resumen.total_skus} suffix="productos" variant="gray" />
        <MetricCard label="Marcas" value={resumen.total_marcas} suffix="lo pp" variant="orange" />
      </div>

      <AnalisisGraficos
        resumenOperativo={resumen_operativo}
        analisisPorEstilo={analisis_por_estilo}
        analisisPorMarca={analisis_por_marca}
        soloConSaldo={soloConSaldo}
      />
        </div>
  );
}

function MetricCard({
  label,
  value,
  suffix,
  variant,
  isPct,
}: {
  label: string;
  value: number;
  suffix: string;
  variant: "orange" | "orange-dark" | "green" | "gray";
  isPct?: boolean;
}) {
  const box =
    variant === "green"
      ? "border-semantic-success/20 bg-gradient-to-br from-semantic-success/10 to-white"
      : variant === "gray"
        ? "border-gray-200 bg-gradient-to-br from-gray-50 to-white"
        : "border-bazzar-naranja/25 bg-gradient-to-br from-bazzar-naranja/10 to-white";

  const labelCls =
    variant === "green"
      ? "text-semantic-success"
      : variant === "gray"
        ? "text-gray-600"
        : variant === "orange-dark"
          ? "text-bazzar-naranja-dark"
          : "text-bazzar-naranja";

  const valueCls =
    variant === "green"
      ? "text-semantic-success"
      : variant === "gray"
        ? "text-gray-900"
        : "text-bazzar-text-dark";

  return (
    <div className={`rounded-2xl border p-4 ${box}`}>
      <div className={`text-xs font-semibold uppercase tracking-wider ${labelCls}`}>{label}</div>
      <div className={`mt-2 text-3xl font-bold ${valueCls}`}>
        {isPct ? `${value}%` : value.toLocaleString("es-PY")}
      </div>
      <div className={`mt-1 text-xs ${labelCls}`}>{suffix}</div>
    </div>
  );
}
