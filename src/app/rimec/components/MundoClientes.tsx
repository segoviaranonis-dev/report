import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  FullSnapshotClienteSinCompra,
  FullSnapshotClienteTabla,
  FullSnapshotResponse,
} from "@/lib/rimec/full-snapshot-types";
import { metaFromSnapshot } from "@/lib/rimec/pdf-gerencial";
import { rowsCarteraCompleta } from "@/lib/rimec/pdf-rows-from-snapshot";
import { COLOR_OBJETIVO, COLOR_REAL_ACTUAL, COLOR_REAL_ANTERIOR, RIMEC_RECHARTS_TOOLTIP } from "../chart-theme";
import { PdfExportBar } from "./PdfExportBar";
import { TablaJerarquica, type SegmentoCarteraCliente } from "./TablaJerarquica";

const fmtGs = (n: number) => new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(n);

type LineRow = {
  etapa: string;
  crecimiento: number;
  riesgo: number;
  sinCompra: number;
};

export function MundoClientes({ data }: { data: FullSnapshotResponse }) {
  const [search, setSearch] = useState("");
  const [carteraCompletaVisible, setCarteraCompletaVisible] = useState(false);
  const pdfMeta = metaFromSnapshot(data.meta);
  /** Solo el PDF: visión general Cadena→Cliente→Marca (sin buckets). La UI no cambia. */
  const pdfCartera = useMemo(() => rowsCarteraCompleta(data), [data]);

  const q = search.toLowerCase().trim();
  const matchCliente = (c: FullSnapshotClienteTabla) => {
    if (!q) return true;
    return (
      c.nombre.toLowerCase().includes(q) ||
      c.codigo.toLowerCase().includes(q) ||
      String(c.id_cliente).includes(q.trim()) ||
      (c.cadena ?? "").toLowerCase().includes(q) ||
      (c.marca_principal ?? "").toLowerCase().includes(q)
    );
  };

  const matchSinCompra = (c: FullSnapshotClienteSinCompra) => {
    if (!q) return true;
    return (
      c.nombre.toLowerCase().includes(q) ||
      c.codigo.toLowerCase().includes(q) ||
      String(c.id_cliente).includes(q.trim()) ||
      (c.cadena ?? "").toLowerCase().includes(q)
    );
  };

  const crec = data.clientes_crecimiento.filter(matchCliente);
  const ries = data.clientes_riesgo.filter(matchCliente);
  const sinc = data.clientes_sin_compra.filter(matchSinCompra);

  const jerarquiaLeaves = data.jerarquia_clientes ?? [];

  /** Ranking «Toda la cartera»: toda la jerarquía del sync; búsqueda acota por cliente/cadena/marca. */
  const jerarquiaLeavesRanking = useMemo(() => {
    if (!q) return jerarquiaLeaves;
    return jerarquiaLeaves.filter(
      (L) =>
        L.descp_cliente.toLowerCase().includes(q) ||
        L.descp_cadena.toLowerCase().includes(q) ||
        L.descp_marca.toLowerCase().includes(q) ||
        String(L.id_cliente).includes(q.trim()),
    );
  }, [jerarquiaLeaves, q]);

  const clientesCrecIds = useMemo(() => new Set(crec.map((c) => c.id_cliente).filter((id) => id > 0)), [crec]);
  const clientesRiesIds = useMemo(() => new Set(ries.map((c) => c.id_cliente).filter((id) => id > 0)), [ries]);

  const barTotales = useMemo(
    () => [
      { clave: "real_2025", etiqueta: "Real 2025 (total)", valor: data.kpis.monto_periodo_anterior },
      { clave: "objetivo", etiqueta: "Objetivo (total)", valor: data.kpis.monto_objetivo },
      { clave: "real_2026", etiqueta: "Real 2026 (actual)", valor: data.kpis.monto_periodo },
    ],
    [data.kpis.monto_periodo, data.kpis.monto_objetivo, data.kpis.monto_periodo_anterior]
  );

  const segmentoMapCrec = useMemo(() => {
    const m = new Map<number, SegmentoCarteraCliente>();
    for (const c of data.clientes_crecimiento) {
      if (c.id_cliente > 0) m.set(c.id_cliente, "crecimiento");
    }
    return m;
  }, [data.clientes_crecimiento]);

  const segmentoMapRies = useMemo(() => {
    const m = new Map<number, SegmentoCarteraCliente>();
    for (const c of data.clientes_riesgo) {
      if (c.id_cliente > 0) m.set(c.id_cliente, "riesgo");
    }
    return m;
  }, [data.clientes_riesgo]);

  const { lineData, ratioGlobal, hayBaseGlobal } = useMemo(() => {
    const suma = (rows: FullSnapshotClienteTabla[]) => rows.reduce((s, c) => s + c.monto_2025, 0);
    const crec2025 = suma(data.clientes_crecimiento);
    const ries2025 = suma(data.clientes_riesgo);
    const sinBase = data.clientes_sin_compra.reduce((s, c) => s + c.ultimo_monto, 0);
    const kPrev = data.kpis.monto_periodo_anterior;
    const kCur = data.kpis.monto_periodo;
    const hayBaseGlobal = kPrev > 0;
    const ratioGlobal = hayBaseGlobal ? kCur / kPrev : 1;
    const line: LineRow[] = [
      { etapa: "Base (suma Real 2025)", crecimiento: crec2025, riesgo: ries2025, sinCompra: sinBase },
      {
        etapa: "Proyección (× variación global)",
        crecimiento: crec2025 * ratioGlobal,
        riesgo: ries2025 * ratioGlobal,
        sinCompra: sinBase * ratioGlobal,
      },
    ];
    return { lineData: line, ratioGlobal, hayBaseGlobal };
  }, [
    data.clientes_crecimiento,
    data.clientes_riesgo,
    data.clientes_sin_compra,
    data.kpis.monto_periodo,
    data.kpis.monto_periodo_anterior,
  ]);

  return (
    <div className="flex h-full flex-col gap-6 p-2">
      <div className="grid h-[400px] shrink-0 grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="group relative overflow-hidden rounded-2xl border border-rimec-azul/15 bg-white p-6 backdrop-blur-md transition-all hover:border-rimec-azul/25">
          <h3 className="mb-1 font-serif text-sm uppercase tracking-widest text-rimec-azul/80">Sumatoria montos globales</h3>
          <p className="mb-4 max-w-xl text-[10px] leading-snug text-neutral-ink-muted">
            Totales del informe con filtros actuales: Real 2025, objetivo y Real 2026 (mismo criterio que las tarjetas del dashboard).
          </p>
          <div className="h-[calc(100%-4.5rem)] min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barTotales} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,43,78,0.08)" vertical={false} />
                <XAxis
                  dataKey="etiqueta"
                  stroke="rgba(0,43,78,0.18)"
                  tick={{ fill: "rgba(45,37,32,0.70)", fontSize: 10 }}
                  interval={0}
                  height={52}
                  tickMargin={6}
                />
                <YAxis
                  stroke="rgba(0,43,78,0.18)"
                  tickFormatter={(v) => `${(Number(v) / 1_000_000_000).toFixed(0)}B`}
                  tick={{ fill: "rgba(45,37,32,0.62)", fontSize: 11 }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(0,43,78,0.05)" }}
                  {...RIMEC_RECHARTS_TOOLTIP}
                  formatter={(value) => (typeof value === 'number' ? fmtGs(value) : "")}
                />
                <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                  {barTotales.map((e) => (
                    <Cell
                      key={e.clave}
                      fill={
                        e.clave === "real_2025"
                          ? COLOR_REAL_ANTERIOR
                          : e.clave === "objetivo"
                            ? COLOR_OBJETIVO
                            : COLOR_REAL_ACTUAL
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-4 text-[10px] uppercase tracking-wider text-neutral-ink-muted">
            <span className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: COLOR_REAL_ANTERIOR }} />
              Real 2025
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: COLOR_OBJETIVO }} />
              Objetivo
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: COLOR_REAL_ACTUAL }} />
              Real 2026
            </span>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-rimec-azul/15 bg-white p-6 backdrop-blur-md transition-all hover:border-rimec-azul/25">
          <h3 className="mb-1 font-serif text-sm uppercase tracking-widest text-rimec-azul/80">Segmentos — línea y proyección</h3>
          <p className="mb-4 max-w-xl text-[10px] leading-snug text-neutral-ink-muted">
            Cada serie suma la base 2025 de su lista (crecimiento y riesgo: <span className="text-neutral-ink-medium">monto_2025</span>; sin compra:{" "}
            <span className="text-neutral-ink-medium">último monto</span>). La proyección multiplica esas sumas por el factor global Real 2026 ÷ Real 2025 del
            informe
            {hayBaseGlobal ? ` (${ratioGlobal.toFixed(3)}×)` : " (sin base 2025, factor 1×)"}.
          </p>
          <div className="h-[calc(100%-5.5rem)] min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 8, right: 16, left: 4, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,43,78,0.08)" />
                <XAxis
                  dataKey="etapa"
                  stroke="rgba(0,43,78,0.18)"
                  tick={{ fill: "rgba(45,37,32,0.70)", fontSize: 10 }}
                  interval={0}
                  height={56}
                  tickMargin={4}
                />
                <YAxis
                  stroke="rgba(0,43,78,0.18)"
                  tickFormatter={(v) => `${(Number(v) / 1_000_000_000).toFixed(0)}B`}
                  tick={{ fill: "rgba(45,37,32,0.62)", fontSize: 11 }}
                />
                <Tooltip
                  {...RIMEC_RECHARTS_TOOLTIP}
                  formatter={(value) => (typeof value === 'number' ? fmtGs(value) : "")}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" />
                <Line type="monotone" dataKey="crecimiento" name="Crecimiento (Σ 2025)" stroke="#22C55E" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="riesgo" name="Riesgo (Σ 2025)" stroke="#002B4E" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="sinCompra" name="Sin compra (Σ último)" stroke="#94A3B8" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Cartera Unificada (Tablas) */}
      <div
        className={`flex flex-col overflow-hidden rounded-2xl border border-rimec-azul/15 bg-white backdrop-blur-md transition-all ${
          carteraCompletaVisible
            ? "fixed inset-4 z-50 bg-white backdrop-blur-xl"
            : "flex-1"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rimec-azul/15 bg-app-bg p-6">
          <h3 className="font-serif text-sm uppercase tracking-widest text-rimec-azul">Cartera Unificada</h3>
          <div className="flex flex-wrap items-center gap-2">
            <PdfExportBar
              title="Cartera Completa"
              rows={pdfCartera}
              groupCols={["Cadena", "Cliente", "Marca", "Mes"]}
              meta={pdfMeta}
            />
            <button
              type="button"
              onClick={() => setCarteraCompletaVisible((v) => !v)}
              className={`rounded-full border px-4 py-2 text-xs font-medium uppercase tracking-wider transition-all ${
                carteraCompletaVisible
                  ? "border-rimec-azul/60 bg-rimec-azul-light/20 text-rimec-azul shadow-lg shadow-rimec-azul-light/20"
                  : "border-rimec-azul/20 bg-white text-neutral-ink hover:border-rimec-azul/25 hover:bg-rimec-azul/5"
              }`}
            >
              {carteraCompletaVisible ? "Ocultar lista total" : "Toda la cartera"}
            </button>
            <input
              type="text"
              placeholder="Buscar cliente..."
              className="w-64 min-w-[12rem] rounded-full border border-rimec-azul/15 bg-white px-4 py-2 text-sm text-neutral-ink focus:border-rimec-azul focus:outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="custom-scrollbar flex-1 space-y-12 overflow-y-auto p-6">
          {carteraCompletaVisible ? (
            <section className="rounded-xl border border-rimec-azul/15 bg-app-bg p-4">
              <div className="mb-3">
                <h4 className="font-serif text-base text-rimec-azul">Ranking consulta</h4>
                <p className="mt-1 max-w-3xl text-[10px] leading-snug text-neutral-ink-muted">
                  Sumatoria de la consulta sincronizada · ranking por Monto 26 (expandí cadena → cliente → marca).
                  Clientes sin cadena compiten en la raíz (sin bucket «Clientes sin cadenas»).
                </p>
              </div>
              {jerarquiaLeavesRanking.length > 0 ? (
                <TablaJerarquica
                  jerarquiaLeaves={jerarquiaLeavesRanking}
                  title="Ranking consulta · Cadena → Cliente → Marca"
                  aplanarSinCadena
                />
              ) : (
                <p className="rounded-lg border border-rimec-azul/15 bg-app-bg py-6 text-center text-sm text-neutral-ink-muted">
                  {jerarquiaLeaves.length === 0
                    ? "No hay bloque de jerarquía desde el servidor para estos filtros. Revisá sincronización o filtros."
                    : "No hay filas que coincidan con la búsqueda."}
                </p>
              )}
            </section>
          ) : (
            <>
              {crec.length > 0 ? (
                <section>
                  <h4 className="mb-1 font-serif text-lg text-semantic-success">En crecimiento</h4>
                  <p className="mb-3 text-[10px] leading-snug text-neutral-ink-muted">
                    Cadena → Cliente → Marca. Agregación en base por{" "}
                    <span className="text-neutral-ink-medium">id_cadena</span>,{" "}
                    <span className="text-neutral-ink-medium">id_cliente</span> e{" "}
                    <span className="text-neutral-ink-medium">id_marca</span>; la UI solo muestra descripciones de FK.
                    Cartera filtrada por <span className="text-neutral-ink-medium">id_cliente</span> en crecimiento.
                  </p>
                  <TablaJerarquica
                    jerarquiaLeaves={jerarquiaLeaves}
                    filterClienteIds={clientesCrecIds}
                    segmentoPorClienteId={segmentoMapCrec}
                  />
                </section>
              ) : (
                <p className="text-sm text-neutral-ink-muted">
                  No hay clientes en crecimiento con los filtros actuales.
                </p>
              )}
              {ries.length > 0 ? (
                <section>
                  <h4 className="mb-1 font-serif text-lg text-rimec-azul">En riesgo</h4>
                  <p className="mb-3 text-[10px] leading-snug text-neutral-ink-muted">
                    Misma jerarquía desde Postgres (ids); cartera en riesgo filtrada por{" "}
                    <span className="text-neutral-ink-medium">id_cliente</span>.
                  </p>
                  <TablaJerarquica
                    jerarquiaLeaves={jerarquiaLeaves}
                    filterClienteIds={clientesRiesIds}
                    segmentoPorClienteId={segmentoMapRies}
                  />
                </section>
              ) : (
                <p className="text-sm text-neutral-ink-muted">No hay clientes en riesgo con los filtros actuales.</p>
              )}
              <TablaSinCompra title="Sin compra reciente" data={sinc} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TablaSinCompra({ title, data }: { title: string; data: FullSnapshotClienteSinCompra[] }) {
  if (!data.length) return null;
  return (
    <div>
      <h4 className="mb-4 font-serif text-lg text-gray-400">{title}</h4>
      <div className="overflow-x-auto">
        <table className="w-full whitespace-nowrap text-left text-sm">
          <thead className="sticky top-0 bg-white backdrop-blur">
            <tr className="border-b border-rimec-azul/15 text-[10px] uppercase tracking-wider text-neutral-ink-muted">
              <th className="px-4 py-3 font-normal">Cliente</th>
              <th className="px-4 py-3 text-right font-normal">Último Monto (2025)</th>
              <th className="px-4 py-3 text-right font-normal">Último Mes</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <tr key={c.id_cliente > 0 ? `sc-${c.id_cliente}` : c.codigo} className="border-b border-rimec-azul/10 transition-colors hover:bg-white">
                <td className="px-4 py-3 text-gray-300">{c.nombre}</td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-400">{fmtGs(c.ultimo_monto)}</td>
                <td className="px-4 py-3 text-right text-gray-500">{c.ultimo_mes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
