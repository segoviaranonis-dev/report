import { NextRequest, NextResponse } from "next/server";
import { parseFiltrosFromSearchParams } from "@/app/aprobaciones/lib/aprobaciones-filtros-parse";
import { filtrosActivos } from "@/app/aprobaciones/lib/aprobaciones-filtros-types";
import {
  countFiConFiltros,
  fetchFiAnuladas,
  fetchFiAnuladasConFiltros,
  fetchFiConfirmadas,
  fetchFiConfirmadasConFiltros,
  fetchFisDePedidosBatch,
  fetchPedidosPendientes,
  fetchPedidosPendientesConFiltros,
} from "@/app/aprobaciones/lib/aprobaciones-queries";
import { requireNivelDiosAction } from "@/app/aprobaciones/lib/require-nivel-dios";

/** GET ?tab=pendientes|aprobados|anulados + filtros indagación */
export async function GET(req: NextRequest) {
  const gate = await requireNivelDiosAction();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: 403 });
  }

  const tab = req.nextUrl.searchParams.get("tab");
  const filtros = parseFiltrosFromSearchParams(req.nextUrl.searchParams);
  const conFiltros = filtrosActivos(filtros);

  try {
    if (tab === "aprobados") {
      const fis = conFiltros
        ? await fetchFiConfirmadasConFiltros(filtros)
        : await fetchFiConfirmadas();
      const count = conFiltros
        ? await countFiConFiltros("CONFIRMADA", filtros)
        : null;
      return NextResponse.json({ fis, countFiltrado: count });
    }

    if (tab === "anulados") {
      const fis = conFiltros
        ? await fetchFiAnuladasConFiltros(filtros)
        : await fetchFiAnuladas();
      const count = conFiltros ? await countFiConFiltros("ANULADA", filtros) : null;
      return NextResponse.json({ fis, countFiltrado: count });
    }

    if (tab === "pendientes") {
      const pendientes = conFiltros
        ? await fetchPedidosPendientesConFiltros(filtros)
        : await fetchPedidosPendientes();
      const fisPorPedido = pendientes.length
        ? await fetchFisDePedidosBatch(pendientes.map((p) => p.id))
        : {};
      return NextResponse.json({ pendientes, fisPorPedido });
    }

    return NextResponse.json({ error: "tab inválido" }, { status: 400 });
  } catch (e) {
    console.error("[aprobaciones/lista]", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
