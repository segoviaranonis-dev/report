import { NextResponse } from "next/server";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { fetchVentasFotos } from "@/lib/ventas-fotos/queries";
import type { VentasFotosFilters, VentasFotosResponse } from "@/lib/ventas-fotos/types";

const EMPTY_RESPONSE: VentasFotosResponse = {
  configured: false,
  rows: [],
  kpis: { total_cantidad: 0, total_ventas: 0, total_transito: 0, articulos_unicos: 0 },
  cliente: null,
  marca: null,
  columnasDetectadas: [],
  message: "DATABASE_URL no configurada. El módulo queda en modo demostración.",
};

function parseBody(body: unknown): VentasFotosFilters | string {
  const b = body as Partial<VentasFotosFilters>;
  const clienteCodigo = String(b?.clienteCodigo ?? "").trim();
  const fechaInicio = String(b?.fechaInicio ?? "").trim();
  const fechaFin = String(b?.fechaFin ?? "").trim();
  const marcaId = Number(b?.marcaId);
  const referenciaPrefix = String(b?.referenciaPrefix ?? "").trim();

  if (!/^[0-9]+$/.test(clienteCodigo)) return "Cliente obligatorio y numérico.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaFin)) {
    return "Fechas obligatorias en formato YYYY-MM-DD.";
  }
  if (fechaInicio > fechaFin) return "La fecha inicial no puede ser posterior a la final.";
  if (!Number.isFinite(marcaId) || marcaId <= 0) return "Marca obligatoria.";

  return { clienteCodigo, fechaInicio, fechaFin, marcaId, referenciaPrefix };
}

export async function POST(req: Request) {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json(EMPTY_RESPONSE);
  }

  const parsed = parseBody(await req.json().catch(() => ({})));
  if (typeof parsed === "string") {
    return NextResponse.json({ ...EMPTY_RESPONSE, configured: true, error: parsed }, { status: 400 });
  }

  try {
    const data = await fetchVentasFotos(getRimecPool(), parsed);
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error cargando ventas con fotos";
    return NextResponse.json(
      { ...EMPTY_RESPONSE, configured: true, error: message } satisfies VentasFotosResponse,
      { status: 500 },
    );
  }
}
