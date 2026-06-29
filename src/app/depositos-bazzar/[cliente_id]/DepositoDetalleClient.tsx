"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  aceptaConfeccionCliente,
  getTiendaBase,
  parseCategoriaDeposito,
  type CategoriaDeposito,
} from "@/lib/depositos/depositos-config";
import { CategoriaDepositoToggle } from "../components/CategoriaDepositoToggle";
import { ImportCsvDepositoButton } from "../components/ImportCsvDepositoButton";
import { RamoOperativaToggle, type RamoOperativa } from "../components/RamoOperativaToggle";
import { TabOperativaCalzado } from "../components/TabOperativaCalzado";
import { TabOperativaConfecciones } from "../components/TabOperativaConfecciones";

type Props = {
  clienteId: number;
};

export function DepositoDetalleClient({ clienteId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tienda = getTiendaBase(clienteId);
  const showConfecciones = aceptaConfeccionCliente(clienteId);

  const tab = searchParams.get("tab") ?? "operativa";
  const categoria = parseCategoriaDeposito(searchParams.get("categoria"));
  const ramoParam = searchParams.get("ramo");
  const ramo: RamoOperativa =
    ramoParam === "confecciones" && showConfecciones ? "confecciones" : "calzado";

  const [accesoOk, setAccesoOk] = useState<boolean | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetch(`/api/depositos/${clienteId}?limit=1`)
      .then((r) => {
        setAccesoOk(r.status !== 403);
        if (r.status === 403) return null;
        return r.json();
      })
      .catch(() => setAccesoOk(false));
  }, [clienteId]);

  const patchParams = useCallback(
    (patch: Record<string, string | null>) => {
      const p = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "") p.delete(k);
        else p.set(k, v);
      }
      router.replace(`/depositos-bazzar/${clienteId}?${p.toString()}`, { scroll: false });
    },
    [clienteId, router, searchParams],
  );

  useEffect(() => {
    if (!tienda) return;
    if (ramoParam === "confecciones" && !showConfecciones) {
      patchParams({ ramo: "calzado" });
    }
  }, [ramoParam, showConfecciones, tienda, patchParams]);

  const onImportDone = useCallback(() => {
    setRefreshKey((k) => k + 1);
    router.refresh();
  }, [router]);

  if (accesoOk === false) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <p className="text-lg font-semibold text-red-700">Depósito no autorizado</p>
        <p className="mt-2 text-sm text-report-muted">
          Solo podés ver el stock de tu tienda asignada (P-06).
        </p>
        <Link href="/depositos-bazzar" className="mt-4 inline-block text-bazzar-naranja underline">
          Volver a mis depósitos
        </Link>
      </div>
    );
  }

  if (!tienda || !tienda.operativo) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <p className="text-lg font-semibold">Depósito {clienteId} no operativo</p>
        <Link href="/depositos-bazzar" className="mt-4 inline-block text-bazzar-naranja underline">
          Volver al hub
        </Link>
      </div>
    );
  }

  const titulo = tienda.palmaUnica
    ? `${tienda.ente} · Tienda única`
    : `${tienda.ente} · ${tienda.tipo}`;

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <nav className="text-sm">
        <Link href="/depositos-bazzar" className="text-bazzar-naranja hover:underline">
          ← Depósitos Bazzar
        </Link>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold">{titulo}</h1>
          <p className="text-sm text-report-muted">
            cliente {clienteId}
            {tienda.palmaUnica ? " · 1 caja tablet" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {categoria === "tienda" && (
            <ImportCsvDepositoButton
              maxFiles={1}
              label="Importar CSV"
              compact
              onDone={onImportDone}
            />
          )}
        </div>
      </header>

      <p className="text-xs text-report-muted">
        Stock vía CSV POS · origen BAZZAR_CSV · tablet lee estas tablas al importar
      </p>

      <CategoriaDepositoToggle
        value={categoria}
        onChange={(c) => patchParams({ categoria: c, tab: "operativa" })}
      />

      <div className="flex gap-2 border-b border-report-rule">
        {(["operativa", "articulos"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => patchParams({ tab: t })}
            className={`px-4 py-2 text-sm font-semibold capitalize ${
              tab === t
                ? "border-b-2 border-bazzar-naranja text-bazzar-naranja-dark"
                : "text-report-muted"
            }`}
          >
            {t === "operativa" ? "Operativa" : "Artículos"}
          </button>
        ))}
      </div>

      {tab === "operativa" && (
        <div className="space-y-4">
          <RamoOperativaToggle
            value={ramo}
            onChange={(r) => patchParams({ ramo: r, tab: "operativa" })}
            showConfecciones={showConfecciones}
          />
          {ramo === "calzado" ? (
            <TabOperativaCalzado key={refreshKey} clienteId={clienteId} categoria={categoria} />
          ) : (
            <TabOperativaConfecciones key={refreshKey} clienteId={clienteId} categoria={categoria} />
          )}
        </div>
      )}

      {tab === "articulos" && (
        <p className="py-8 text-center text-report-muted">
          Vista artículos — usar Operativa con filtros por ahora
        </p>
      )}
    </div>
  );
}
