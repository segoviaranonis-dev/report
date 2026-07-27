import { NextResponse } from "next/server";
import {
  groupLogisticaPorFechaYChofer,
  groupLogisticaPorPedidoDuro,
  groupLogisticaPorTipoMarcaPp,
  groupLogisticaPorVendedorTipoMarcaPp,
  listLogisticaPendientes,
  enrichFilasConObsLogistica,
  enriquecerGruposConStatsPp,
  statsEjecucionLogistica,
  statsEjecucionPorPp,
  porPpConPeUnificado,
} from "@/lib/logistica-ok/queries-bandeja";
import {
  statsObsMensajes,
  tabInicialLogistica,
  type LogisticaTabId,
} from "@/lib/logistica-ok/constants";
import { requireLogisticaOkAccess } from "@/lib/logistica-ok/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

const TABS: LogisticaTabId[] = [
  "general",
  "general_exitoso",
  "vendedor",
  "confirmadas",
  "entregas",
  "exitosas",
];

export async function GET(req: Request) {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const url = new URL(req.url);
  const vendedorRaw = url.searchParams.get("vendedor_id");
  const vendedorId = vendedorRaw != null && vendedorRaw !== "" ? Number(vendedorRaw) : null;
  const tabRaw = url.searchParams.get("tab") || url.searchParams.get("vista") || "";
  const tabHint = TABS.includes(tabRaw as LogisticaTabId) ? (tabRaw as LogisticaTabId) : null;

  const gate = await requireLogisticaOkAccess(tabHint);
  if (gate.error) return gate.error;

  const tab: LogisticaTabId = tabHint ?? tabInicialLogistica(gate.categoria);
  if (!gate.tabsPermitidas.includes(tab)) {
    return NextResponse.json(
      { ok: false, error: `Pestaña «${tab}» no permitida para ${gate.categoria}` },
      { status: 403 },
    );
  }

  try {
    const pool = getRimecPool();
    const usuarioId = gate.session!.id_usuario;
    const enrich = async (filas: Awaited<ReturnType<typeof listLogisticaPendientes>>) =>
      enrichFilasConObsLogistica(pool, filas, { usuarioId, pestana: tab });

    const meta = {
      tabsPermitidas: gate.tabsPermitidas,
      categoria: gate.categoria,
      tab,
    };

    if (tab === "general" || tab === "general_exitoso") {
      const todas = await listLogisticaPendientes(pool, { estado: "TODOS" });
      const filasRaw =
        tab === "general_exitoso"
          ? todas.filter((f) => f.estado === "EXITOSA")
          : todas.filter((f) => f.estado === "PENDIENTE");
      const filas = await enrich(filasRaw);
      const ejec = statsEjecucionLogistica(todas);
      const porPp = porPpConPeUnificado(todas);
      const cajas = filas.reduce((s, f) => s + f.cajas, 0);
      const obs = statsObsMensajes(filas);
      return NextResponse.json({
        ok: true,
        ...meta,
        filas,
        gruposPedidoDuro: enriquecerGruposConStatsPp(groupLogisticaPorPedidoDuro(filas), porPp),
        statsPorPp: porPp,
        stats: {
          n: filas.length,
          cajas,
          ...ejec,
          obs_con: obs.conObs,
          obs_abiertos: obs.abiertos,
          obs_label: obs.label,
        },
      });
    }

    const filas = await enrich(
      await listLogisticaPendientes(pool, {
        tab,
        vendedorId:
          tab === "vendedor" && vendedorId != null && Number.isFinite(vendedorId) ? vendedorId : null,
      }),
    );
    const cajas = filas.reduce((s, f) => s + f.cajas, 0);
    const obs = statsObsMensajes(filas);
    const stats = {
      n: filas.length,
      cajas,
      obs_con: obs.conObs,
      obs_abiertos: obs.abiertos,
      obs_label: obs.label,
    };

    if (tab === "vendedor") {
      return NextResponse.json({
        ok: true,
        ...meta,
        filas,
        gruposVendedor: groupLogisticaPorVendedorTipoMarcaPp(filas),
        stats,
      });
    }
    if (tab === "entregas" || tab === "exitosas") {
      return NextResponse.json({
        ok: true,
        ...meta,
        filas,
        gruposDiaChofer: groupLogisticaPorFechaYChofer(filas),
        stats,
      });
    }
    if (tab === "confirmadas") {
      return NextResponse.json({
        ok: true,
        ...meta,
        filas,
        gruposTipo: groupLogisticaPorTipoMarcaPp(filas),
        stats,
      });
    }
    return NextResponse.json({
      ok: true,
      ...meta,
      filas,
      gruposPedidoDuro: groupLogisticaPorPedidoDuro(filas),
      stats,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const hint =
      /pendiente_impresion_legal|impresion_legal_ok|fecha_entrega_efectiva|chofer_nombre|EN_ENTREGA|EXITOSA|logistica_activada_at/i.test(
        msg,
      )
        ? " Aplicá MIG-174 (banderas logística) o revisá columnas PP."
        : "";
    return NextResponse.json({ ok: false, error: msg + hint }, { status: 500 });
  }
}
