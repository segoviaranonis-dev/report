import { NextRequest, NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { loadBibliotecaEditor } from "@/lib/motor-precios/biblioteca-editor";
import { MOTOR_PROVEEDOR_DEFAULT } from "@/lib/motor-precios/constants";
import {
  findBibliotecaCanonica,
  listBibliotecasPorProveedor,
} from "@/lib/motor-precios/queries";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

/**
 * GET /api/stock-pronta-entrega/filtros-indice
 * Puente Motor Precios → stock PE RIMEC (solo lectura · proveedor 654).
 */
export async function GET(req: NextRequest) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ configured: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const proveedorId = Number(req.nextUrl.searchParams.get("proveedor_id") ?? MOTOR_PROVEEDOR_DEFAULT);
  if (!Number.isFinite(proveedorId) || proveedorId <= 0) {
    return NextResponse.json({ ok: false, error: "proveedor_id inválido" }, { status: 400 });
  }

  const pool = getRimecPool();
  const bibliotecaRaw = req.nextUrl.searchParams.get("biblioteca_id");

  if (!bibliotecaRaw) {
    try {
      const bibliotecas = await listBibliotecasPorProveedor(pool, proveedorId);
      const canonica = findBibliotecaCanonica(bibliotecas);
      return NextResponse.json({
        configured: true,
        scope: "stock_pronta_entrega_rimec",
        proveedor_id: proveedorId,
        bibliotecas,
        canonica,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al listar bibliotecas";
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
  }

  const bibliotecaId = Number(bibliotecaRaw);
  if (!Number.isFinite(bibliotecaId) || bibliotecaId <= 0) {
    return NextResponse.json({ ok: false, error: "biblioteca_id inválido" }, { status: 400 });
  }

  try {
    const payload = await loadBibliotecaEditor(pool, bibliotecaId, proveedorId);
    if (!payload) {
      return NextResponse.json({ ok: false, error: "Biblioteca no encontrada" }, { status: 404 });
    }

    return NextResponse.json({
      configured: true,
      scope: "stock_pronta_entrega_rimec",
      proveedor_id: proveedorId,
      biblioteca: payload.biblioteca,
      resumen: payload.resumen,
      casos: payload.casos.map((c) => ({
        id: c.id,
        nombre_caso: c.nombre_caso,
        lineas: c.lineas,
        lineas_count: c.lineas_count,
        indice_gs: c.indice_gs,
        dolar_politica: c.dolar_politica,
        factor_conversion: c.factor_conversion,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al cargar biblioteca";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
