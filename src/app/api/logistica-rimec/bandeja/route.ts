import { NextResponse } from "next/server";
import {
  groupLogisticaPorFechaYChofer,
  groupLogisticaPorTipoMarcaPp,
  groupLogisticaPorVendedorTipoMarcaPp,
  enriquecerGruposConStatsPp,
  statsEjecucionLogistica,
  porPpConPeUnificado,
} from "@/lib/logistica-ok/queries-bandeja";
import {
  statsObsMensajes,
  tabInicialLogistica,
  type LogisticaTabId,
} from "@/lib/logistica-ok/constants";
import { requireLogisticaOkAccess } from "@/lib/logistica-ok/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { listLogisticaRimecAsPendiente } from "@/lib/logistica-rimec/queries";
import { groupLogisticaRimecPorEntidad } from "@/lib/logistica-rimec/group-entidad";
import {
  isVendedorLogisticaReport,
  resolveIdVendedorFromUsuario,
} from "@/lib/logistica-ok/vendedor-usuario";

const TABS: LogisticaTabId[] = [
  "general",
  "general_exitoso",
  "vendedor",
  "confirmadas",
  "entregas",
  "exitosas",
];

function filtrarPorVendedorSesion<T extends { id_vendedor: number | null }>(
  filas: T[],
  idVendedor: number | null,
): T[] {
  if (idVendedor == null) return filas;
  return filas.filter((f) => f.id_vendedor === idVendedor);
}

export async function GET(req: Request) {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const url = new URL(req.url);
  const tabRaw = url.searchParams.get("tab") || url.searchParams.get("vista") || "";
  const tabHint = TABS.includes(tabRaw as LogisticaTabId) ? (tabRaw as LogisticaTabId) : null;

  const gate = await requireLogisticaOkAccess(tabHint);
  if (gate.error) return gate.error;

  let tab: LogisticaTabId = tabHint ?? tabInicialLogistica(gate.categoria);
  if (!gate.tabsPermitidas.includes(tab)) {
    tab = tabInicialLogistica(gate.categoria);
  }
  if (!gate.tabsPermitidas.includes(tab)) {
    return NextResponse.json(
      { ok: false, error: `Pestaña «${tabHint ?? tab}» no permitida para ${gate.categoria}` },
      { status: 403 },
    );
  }

  try {
    const pool = getRimecPool();
    const esVendedor = isVendedorLogisticaReport(
      gate.session!.rol_id,
      gate.categoria,
    );
    const resolved = esVendedor
      ? await resolveIdVendedorFromUsuario(pool, gate.session!.name)
      : { idVendedor: null as number | null, nombreCanon: null as string | null };
    const idVendedorScope = esVendedor ? resolved.idVendedor : null;

    const meta = {
      tabsPermitidas: gate.tabsPermitidas,
      categoria: gate.categoria,
      tab,
      modo: "rimec" as const,
      id_vendedor_sesion: idVendedorScope,
      vendedor_sesion: resolved.nombreCanon,
    };

    if (tab === "general" || tab === "general_exitoso") {
      const todas = await listLogisticaRimecAsPendiente(pool, { estado: "TODOS" });
      const filas =
        tab === "general_exitoso"
          ? todas.filter((f) => f.estado === "EXITOSA")
          : todas.filter((f) => f.estado === "PENDIENTE");
      const ejec = statsEjecucionLogistica(todas);
      const porPp = porPpConPeUnificado(todas);
      const cajas = filas.reduce((s, f) => s + f.cajas, 0);
      const obs = statsObsMensajes(filas);
      const grupos = enriquecerGruposConStatsPp(groupLogisticaRimecPorEntidad(filas), porPp);
      return NextResponse.json({
        ok: true,
        ...meta,
        filas,
        gruposPedidoDuro: grupos,
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

    let filas = await listLogisticaRimecAsPendiente(pool, { tab });
    if (tab === "vendedor") {
      filas = filtrarPorVendedorSesion(filas, idVendedorScope);
      if (esVendedor && idVendedorScope == null) {
        return NextResponse.json(
          {
            ok: false,
            error: `Usuario «${gate.session!.name}» sin vínculo en vendedor_v2. Avisá a la jefa.`,
          },
          { status: 403 },
        );
      }
    }
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
      // Confirmadas: mismos 3 bloques entidad + atraso
      return NextResponse.json({
        ok: true,
        ...meta,
        filas,
        gruposTipo: groupLogisticaPorTipoMarcaPp(filas),
        gruposPedidoDuro: groupLogisticaRimecPorEntidad(filas),
        stats,
      });
    }
    return NextResponse.json({
      ok: true,
      ...meta,
      filas,
      gruposPedidoDuro: groupLogisticaRimecPorEntidad(filas),
      stats,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (/logistica_rimec_|does not exist|entidad_am|relation/i.test(msg)) {
      return NextResponse.json(
        { ok: false, error: "Falta MIG-190/191 (logistica_rimec_*)." },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
