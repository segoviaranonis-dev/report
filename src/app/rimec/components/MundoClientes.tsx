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
import { COLOR_OBJETIVO, COLOR_REAL_ACTUAL, COLOR_REAL_ANTERIOR, RIMEC_RECHARTS_TOOLTIP } from "../chart-theme";
import { TablaJerarquica, type SegmentoCarteraCliente } from "./TablaJerarquica";

const fmtGs = (n: number) => new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(n);

type LineRow = {
  etapa: string;
  crecimiento: number;
  riesgo: number;
  sinCompra: number;
};

type SegmentoCartera = SegmentoCarteraCliente;

type FilaCarteraCompleta = {
  id_cliente: number;
  codigo: string;
  nombre: string;
  cadena: string;
  segmento: SegmentoCartera;
  /** Criterio único de orden: compras período (2026) o, sin compra, último monto registrado. */
  montoOrden: number;
  monto_2026: number | null;
  monto_2025: number | null;
  ultimo_monto: number | null;
  ultimo_mes: string | null;
};

function sombraSegmento(segmento: SegmentoCartera): string {
  switch (segmento) {
    case "crecimiento":
      return "shadow-[0_0_24px_-6px_rgba(34,197,94,0.55)] border-emerald-500/25";
    case "riesgo":
      return "shadow-[0_0_24px_-6px_rgba(249,115,22,0.42)] border-orange-400/25";
    case "sin_compra":
      return "shadow-[0_0_24px_-6px_rgba(248,113,113,0.38)] border-red-400/22";
    default:
      return "";
  }
}

export function MundoClientes({ data }: { data: FullSnapshotResponse }) {
  const [search, setSearch] = useState("");
  const [carteraCompletaVisible, setCarteraCompletaVisible] = useState(false);

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

  const carteraCompletaOrdenada = useMemo((): FilaCarteraCompleta[] => {
    const filas: FilaCarteraCompleta[] = [];
    for (const c of data.clientes_crecimiento) {
      if (!matchCliente(c)) continue;
      filas.push({
        id_cliente: c.id_cliente,
        codigo: c.codigo,
        nombre: c.nombre,
        cadena: c.cadena,
        segmento: "crecimiento",
        montoOrden: c.monto_2026,
        monto_2026: c.monto_2026,
        monto_2025: c.monto_2025,
        ultimo_monto: null,
        ultimo_mes: null,
      });
    }
    for (const c of data.clientes_riesgo) {
      if (!matchCliente(c)) continue;
      filas.push({
        id_cliente: c.id_cliente,
        codigo: c.codigo,
        nombre: c.nombre,
        cadena: c.cadena,
        segmento: "riesgo",
        montoOrden: c.monto_2026,
        monto_2026: c.monto_2026,
        monto_2025: c.monto_2025,
        ultimo_monto: null,
        ultimo_mes: null,
      });
    }
    for (const c of data.clientes_sin_compra) {
      if (!matchSinCompra(c)) continue;
      filas.push({
        id_cliente: c.id_cliente,
        codigo: c.codigo,
        nombre: c.nombre,
        cadena: c.cadena,
        segmento: "sin_compra",
        montoOrden: c.ultimo_monto,
        monto_2026: null,
        monto_2025: null,
        ultimo_monto: c.ultimo_monto,
        ultimo_mes: c.ultimo_mes,
      });
    }
    const conCompraPeriodo = filas.filter((f) => f.segmento !== "sin_compra").sort((a, b) => b.montoOrden - a.montoOrden);
    const sinCompraLista = filas.filter((f) => f.segmento === "sin_compra").sort((a, b) => b.montoOrden - a.montoOrden);
    return [...conCompraPeriodo, ...sinCompraLista];
  }, [data.clientes_crecimiento, data.clientes_riesgo, data.clientes_sin_compra, q]);

  const idsCarteraCompleta = useMemo(
    () => new Set(carteraCompletaOrdenada.map((c) => c.id_cliente).filter((id) => id > 0)),
    [carteraCompletaOrdenada]
  );

  const segmentoPorClienteCompleto = useMemo(() => {
    const m = new Map<number, SegmentoCarteraCliente>();
    for (const row of carteraCompletaOrdenada) {
      if (row.id_cliente > 0) m.set(row.id_cliente, row.segmento);
    }
    return m;
  }, [carteraCompletaOrdenada]);

  const idsConHojaJerarquiaEnCartera = useMemo(() => {
    const s = new Set<number>();
    for (const L of jerarquiaLeaves) {
      if (idsCarteraCompleta.has(L.id_cliente)) s.add(L.id_cliente);
    }
    return s;
  }, [jerarquiaLeaves, idsCarteraCompleta]);

  const clientesSinDesgloseJerarquia = useMemo(
    () => carteraCompletaOrdenada.filter((c) => c.id_cliente > 0 && !idsConHojaJerarquiaEnCartera.has(c.id_cliente)),
    [carteraCompletaOrdenada, idsConHojaJerarquiaEnCartera]
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
        <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition-all hover:border-white/20">
          <h3 className="mb-1 font-serif text-sm uppercase tracking-widest text-white/70">Sumatoria montos globales</h3>
          <p className="mb-4 max-w-xl text-[10px] leading-snug text-white/40">
            Totales del informe con filtros actuales: Real 2025, objetivo y Real 2026 (mismo criterio que las tarjetas del dashboard).
          </p>
          <div className="h-[calc(100%-4.5rem)] min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barTotales} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="etiqueta"
                  stroke="rgba(255,255,255,0.25)"
                  tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 10 }}
                  interval={0}
                  height={52}
                  tickMargin={6}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.25)"
                  tickFormatter={(v) => `${(Number(v) / 1_000_000_000).toFixed(0)}B`}
                  tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
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
          <div className="mt-2 flex flex-wrap justify-center gap-4 text-[10px] uppercase tracking-wider text-white/45">
            <span className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: COLOR_REAL_ANTERIOR }} />
              Real 2025
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-sm bg-white/25" />
              Objetivo
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: COLOR_REAL_ACTUAL }} />
              Real 2026
            </span>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition-all hover:border-white/20">
          <h3 className="mb-1 font-serif text-sm uppercase tracking-widest text-white/70">Segmentos — línea y proyección</h3>
          <p className="mb-4 max-w-xl text-[10px] leading-snug text-white/40">
            Cada serie suma la base 2025 de su lista (crecimiento y riesgo: <span className="text-white/55">monto_2025</span>; sin compra:{" "}
            <span className="text-white/55">último monto</span>). La proyección multiplica esas sumas por el factor global Real 2026 ÷ Real 2025 del
            informe
            {hayBaseGlobal ? ` (${ratioGlobal.toFixed(3)}×)` : " (sin base 2025, factor 1×)"}.
          </p>
          <div className="h-[calc(100%-5.5rem)] min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 8, right: 16, left: 4, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="etapa"
                  stroke="rgba(255,255,255,0.25)"
                  tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 10 }}
                  interval={0}
                  height={56}
                  tickMargin={4}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.25)"
                  tickFormatter={(v) => `${(Number(v) / 1_000_000_000).toFixed(0)}B`}
                  tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                />
                <Tooltip
                  {...RIMEC_RECHARTS_TOOLTIP}
                  formatter={(value) => (typeof value === 'number' ? fmtGs(value) : "")}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" />
                <Line type="monotone" dataKey="crecimiento" name="Crecimiento (Σ 2025)" stroke="#4ade80" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="riesgo" name="Riesgo (Σ 2025)" stroke="#f87171" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="sinCompra" name="Sin compra (Σ último)" stroke="#9ca3af" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Cartera Unificada (Tablas) */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/20 p-6">
          <h3 className="font-serif text-sm uppercase tracking-widest text-white/90">Cartera Unificada</h3>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCarteraCompletaVisible((v) => !v)}
              className={`rounded-full border px-4 py-2 text-xs font-medium uppercase tracking-wider transition-colors ${
                carteraCompletaVisible
                  ? "border-yellow-400/60 bg-yellow-500/15 text-yellow-200"
                  : "border-white/15 bg-white/5 text-white/75 hover:border-white/25 hover:bg-white/10"
              }`}
            >
              {carteraCompletaVisible ? "Ocultar lista total" : "Toda la cartera"}
            </button>
            <input
              type="text"
              placeholder="Buscar cliente..."
              className="w-64 min-w-[12rem] rounded-full border border-white/10 bg-black/50 px-4 py-2 text-sm text-white focus:border-yellow-400 focus:outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="custom-scrollbar flex-1 space-y-12 overflow-y-auto p-6">
          {carteraCompletaVisible ? (
            <section className="rounded-xl border border-white/10 bg-black/25 p-4">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h4 className="font-serif text-base text-white/90">Lista completa de cartera</h4>
                  <p className="mt-1 max-w-3xl text-[10px] leading-snug text-white/40">
                    Misma vista <span className="text-white/55">Cadena → Cliente → Marca</span> que el resto del informe (datos agregados en base).
                    Colores de sombra en cliente/marca según segmento (crecimiento / riesgo / sin compra). Abajo: clientes de la cartera sin líneas de
                    venta en el período (solo aparecen como listado auxiliar).
                  </p>
                </div>
                <p className="text-[10px] text-white/45">
                  {carteraCompletaOrdenada.length} cliente{carteraCompletaOrdenada.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="mb-4 flex flex-wrap gap-4 text-[10px] uppercase tracking-wider text-white/50">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-4 rounded-sm shadow-[0_0_12px_rgba(34,197,94,0.5)] ring-1 ring-emerald-400/40" />
                  Crecimiento
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-4 rounded-sm shadow-[0_0_12px_rgba(249,115,22,0.45)] ring-1 ring-orange-400/35" />
                  Riesgo
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-4 rounded-sm shadow-[0_0_12px_rgba(248,113,113,0.45)] ring-1 ring-red-400/30" />
                  Sin compra
                </span>
              </div>
              {carteraCompletaOrdenada.length === 0 ? (
                <p className="py-8 text-center text-sm text-white/35">No hay clientes que coincidan con la búsqueda.</p>
              ) : (
                <>
                  {jerarquiaLeaves.length > 0 ? (
                    <TablaJerarquica
                      jerarquiaLeaves={jerarquiaLeaves}
                      filterClienteIds={idsCarteraCompleta}
                      segmentoPorClienteId={segmentoPorClienteCompleto}
                      title="Cadena → Cliente → Marca (toda la cartera)"
                    />
                  ) : (
                    <p className="rounded-lg border border-white/10 bg-black/30 py-6 text-center text-sm text-white/45">
                      No hay bloque de jerarquía desde el servidor para estos filtros. Revisá sincronización o filtros.
                    </p>
                  )}
                  {clientesSinDesgloseJerarquia.length > 0 ? (
                    <div className="mt-6">
                      <h5 className="mb-2 font-medium text-white/70">Clientes en cartera sin ventas en el período (sin desglose marca)</h5>
                      <p className="mb-3 text-[10px] text-white/40">
                        No generan filas en la jerarquía SQL (monto 2026 en período = 0). Último monto y mes a modo de referencia.
                      </p>
                      <ul className="max-h-[min(40vh,320px)] space-y-2 overflow-y-auto pr-1">
                        {clientesSinDesgloseJerarquia.map((row, idx) => (
                          <li
                            key={row.id_cliente > 0 ? `sd-${row.id_cliente}` : `sd-${row.codigo}-${idx}`}
                            className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white/[0.03] px-4 py-3 ${sombraSegmento(row.segmento)}`}
                          >
                            <div className="min-w-0 flex-1">
                              <span className="font-medium text-white/90">{row.nombre}</span>
                              <span className="ml-2 text-[11px] text-white/40">ID {row.codigo}</span>
                              {row.cadena ? (
                                <span className="ml-2 max-w-[200px] truncate text-[11px] text-white/45">{row.cadena}</span>
                              ) : null}
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] uppercase tracking-wider text-white/35">Último monto</p>
                              <p className="tabular-nums text-sm text-white/90">{fmtGs(row.montoOrden)}</p>
                              {row.ultimo_mes ? <p className="text-[10px] text-white/35">Últ. mes {row.ultimo_mes}</p> : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              )}
            </section>
          ) : null}
          {crec.length > 0 ? (
            <section>
              <h4 className="mb-1 font-serif text-lg text-green-400">En crecimiento</h4>
              <p className="mb-3 text-[10px] leading-snug text-white/40">
                Cadena → Cliente → Marca. Agregación en base por <span className="text-white/55">id_cadena</span>,{" "}
                <span className="text-white/55">id_cliente</span> e <span className="text-white/55">id_marca</span>; la UI solo muestra
                descripciones de FK. Cartera filtrada por <span className="text-white/55">id_cliente</span> en crecimiento.
              </p>
              <TablaJerarquica
                jerarquiaLeaves={jerarquiaLeaves}
                filterClienteIds={clientesCrecIds}
                segmentoPorClienteId={segmentoMapCrec}
              />
            </section>
          ) : (
            <p className="text-sm text-white/35">No hay clientes en crecimiento con los filtros actuales.</p>
          )}
          {ries.length > 0 ? (
            <section>
              <h4 className="mb-1 font-serif text-lg text-red-400">En riesgo</h4>
              <p className="mb-3 text-[10px] leading-snug text-white/40">
                Misma jerarquía desde Postgres (ids); cartera en riesgo filtrada por <span className="text-white/55">id_cliente</span>.
              </p>
              <TablaJerarquica
                jerarquiaLeaves={jerarquiaLeaves}
                filterClienteIds={clientesRiesIds}
                segmentoPorClienteId={segmentoMapRies}
              />
            </section>
          ) : (
            <p className="text-sm text-white/35">No hay clientes en riesgo con los filtros actuales.</p>
          )}
          <TablaSinCompra title="Sin compra reciente" data={sinc} />
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
          <thead className="sticky top-0 bg-slate-900/90 backdrop-blur">
            <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-white/40">
              <th className="px-4 py-3 font-normal">Cliente</th>
              <th className="px-4 py-3 text-right font-normal">Último Monto (2025)</th>
              <th className="px-4 py-3 text-right font-normal">Último Mes</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <tr key={c.id_cliente > 0 ? `sc-${c.id_cliente}` : c.codigo} className="border-b border-white/5 transition-colors hover:bg-white/5">
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
