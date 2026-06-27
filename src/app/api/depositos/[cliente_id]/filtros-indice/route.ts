import { NextRequest, NextResponse } from "next/server";
import { getDepositoConfig, parseCategoriaDeposito } from "@/lib/depositos/depositos-config";
import { loadBibliotecaEditor } from "@/lib/motor-precios/biblioteca-editor";
import { MOTOR_PROVEEDOR_DEFAULT } from "@/lib/motor-precios/constants";
import {
  findBibliotecaCanonica,
  listBibliotecasPorProveedor,
} from "@/lib/motor-precios/queries";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Params = { params: Promise<{ cliente_id: string }> };

/**
 * GET /api/depositos/[cliente_id]/filtros-indice
 * Puente Motor Precios → stock depósito (solo lectura).
 *
 * Query:
 *  - biblioteca_id (opcional) — si falta, devuelve listado bibliotecas
 *  - proveedor_id (default 654)
 *  - categoria (tienda|guardado|averiado)
 */
export async function GET(req: NextRequest, { params }: Params) {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ configured: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const clienteId = Number((await params).cliente_id);
  if (!Number.isFinite(clienteId) || clienteId <= 0) {
    return NextResponse.json({ ok: false, error: "cliente_id inválido" }, { status: 400 });
  }

  const categoria = parseCategoriaDeposito(req.nextUrl.searchParams.get("categoria"));
  const config = getDepositoConfig(clienteId, categoria);
  if (!config) {
    return NextResponse.json({ ok: false, error: "Depósito no configurado" }, { status: 404 });
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
        cliente_id: clienteId,
        ente: config.ente,
        tipo: config.tipo,
        categoria,
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
      cliente_id: clienteId,
      ente: config.ente,
      tipo: config.tipo,
      categoria,
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
