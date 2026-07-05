"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { DepositosHubResponse, HubTiendaStats } from "@/app/api/depositos/hub/route";
import type { CategoriaDeposito } from "@/lib/depositos/depositos-config";
import { CategoriaDepositoToggle } from "./components/CategoriaDepositoToggle";
import { ImportCsvDepositoButton } from "./components/ImportCsvDepositoButton";

function fmt(n: number) {
  return new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(n);
}

function fmtImport(iso: string | null | undefined) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("es-PY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function RamoLink({
  href,
  emoji,
  label,
  uds,
}: {
  href: string;
  emoji: string;
  label: string;
  uds: number;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col rounded-lg border-2 border-bazzar-naranja/20 bg-white px-4 py-3 transition hover:border-bazzar-naranja hover:shadow-md"
    >
      <span className="text-lg">{emoji}</span>
      <span className="text-xs font-bold uppercase text-report-muted">{label}</span>
      <span className="text-xl font-bold tabular-nums text-bazzar-naranja-dark">{fmt(uds)}</span>
    </Link>
  );
}

function TiendaCard({
  tienda,
  categoria,
}: {
  tienda: HubTiendaStats;
  categoria: CategoriaDeposito;
}) {
  const base = `/depositos-bazzar/${tienda.cliente_id}?tab=operativa&categoria=${categoria}`;

  return (
    <div className="rounded-xl border-2 border-bazzar-naranja/25 bg-bazzar-fondo/50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-bold text-bazzar-text-dark">{tienda.label}</p>
          <p className="text-xs text-report-muted">cliente {tienda.cliente_id}</p>
          {!tienda.error && (
            <p className="mt-1 text-sm font-bold tabular-nums text-bazzar-naranja-dark">
              👟 {fmt(tienda.calzado.uds)} uds calzado
              {tienda.confeccion.uds > 0 && (
                <span className="ml-2 font-normal text-report-muted">
                  · 👕 {fmt(tienda.confeccion.uds)} conf.
                </span>
              )}
            </p>
          )}
          {!tienda.error && tienda.fecha_importacion && (
            <>
              <p className="text-xs text-report-muted">
                📅 Import {fmtImport(tienda.fecha_importacion)}
                {tienda.batch_label ? ` · ${tienda.batch_label}` : ""}
              </p>
              <p className="text-xs font-semibold tabular-nums text-emerald-800">
                🛒 {fmt(tienda.uds_vendidas ?? 0)} vendido
                {(tienda.uds_importadas ?? 0) > 0 && (
                  <span className="font-normal text-report-muted">
                    {" "}
                    · de {fmt(tienda.uds_importadas ?? 0)} importadas
                  </span>
                )}
              </p>
            </>
          )}
        </div>
        <Link
          href={base}
          className="rounded-lg bg-bazzar-naranja px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
        >
          Abrir
        </Link>
      </div>

      {tienda.error ? (
        <p className="text-xs text-red-600">{tienda.error}</p>
      ) : (
        <>
          <p className="text-sm text-report-muted">
            {fmt(tienda.registros)} filas · {fmt(tienda.pares_total)} uds total
          </p>
          <div className="grid grid-cols-2 gap-2">
            {tienda.palmaUnica ? (
              <>
                <RamoLink
                  href={`${base}&ramo=calzado`}
                  emoji="👟"
                  label="Calzado adultos"
                  uds={tienda.calzado_adultos?.uds ?? 0}
                />
                <RamoLink
                  href={`${base}&ramo=calzado&segmento=ninos`}
                  emoji="👟"
                  label="Calzado niños"
                  uds={tienda.calzado_ninos?.uds ?? 0}
                />
              </>
            ) : (
              <RamoLink
                href={`${base}&ramo=calzado`}
                emoji="👟"
                label="Calzado"
                uds={tienda.calzado.uds}
              />
            )}
            {tienda.aceptaConfeccion && (
              <RamoLink
                href={`${base}&ramo=confecciones`}
                emoji="👕"
                label="Confecciones"
                uds={tienda.confeccion.uds}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function DepositosHubClient() {
  const [categoria, setCategoria] = useState<CategoriaDeposito>("tienda");
  const [data, setData] = useState<DepositosHubResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const puedeImportGlobal = data?.puede_sync_global === true;

  const cargar = useCallback(() => {
    setLoading(true);
    fetch(`/api/depositos/hub?categoria=${categoria}`)
      .then((r) => r.json())
      .then((j: DepositosHubResponse) => setData(j))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [categoria]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const totalPares =
    data?.entes.reduce(
      (s, e) => s + e.tiendas.reduce((t, ti) => t + ti.pares_total, 0),
      0,
    ) ?? 0;

  const totalCalzado =
    data?.entes.reduce(
      (s, e) => s + e.tiendas.reduce((t, ti) => t + (ti.error ? 0 : ti.calzado.uds), 0),
      0,
    ) ?? 0;

  const totalVendido =
    data?.entes.reduce(
      (s, e) => s + e.tiendas.reduce((t, ti) => t + (ti.error ? 0 : (ti.uds_vendidas ?? 0)), 0),
      0,
    ) ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <header className="space-y-3">
        <h1 className="font-serif text-2xl font-bold text-report-ink">Depósitos Bazzar</h1>
        <p className="text-sm text-report-muted">
          {data?.acceso_label ?? "Depósitos Bazzar"} · 👟 {fmt(totalCalzado)} uds calzado ·{" "}
          {fmt(totalPares)} uds total
          {totalVendido > 0 && <> · 🛒 {fmt(totalVendido)} vendido</>} · import CSV POS
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <CategoriaDepositoToggle value={categoria} onChange={setCategoria} />
          {categoria === "tienda" && (
            <ImportCsvDepositoButton
              maxFiles={puedeImportGlobal ? 3 : 1}
              label={puedeImportGlobal ? "Importar 3 CSV" : "Importar CSV"}
              onDone={cargar}
            />
          )}
        </div>
        {loading && <p className="text-sm text-report-muted">Cargando stock…</p>}
      </header>

      {data?.entes.length === 0 && !loading && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No tenés ente asignado o no hay depósitos visibles para tu usuario.
        </p>
      )}

      <div className={`grid gap-8 ${data?.entes.length === 1 ? "lg:grid-cols-1 max-w-md" : "lg:grid-cols-3"}`}>
        {data?.entes.map((ente) => (
          <section key={ente.slug} className="space-y-3">
            <h2 className="border-b-2 border-bazzar-naranja pb-1 font-serif text-xl font-bold">
              {ente.ente}
            </h2>
            <div className="space-y-3">
              {ente.tiendas.map((t) => (
                <TiendaCard key={t.cliente_id} tienda={t} categoria={categoria} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {data?.error && <p className="text-red-600">{data.error}</p>}
    </div>
  );
}
