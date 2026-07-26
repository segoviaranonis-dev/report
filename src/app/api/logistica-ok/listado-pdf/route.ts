import { NextResponse } from "next/server";
import {
  buildListadoClientesPdf,
  type ListadoPdfFila,
} from "@/lib/logistica-ok/listado-clientes-pdf";
import { ENTIDAD_AM_META, type EntidadAmLogistica } from "@/lib/logistica-ok/constants";
import { facturaRealDesdeRow } from "@/lib/logistica-ok/factura-real";
import {
  diasAtrasoDesdePublicacion,
  filtrarFilasLogistica,
} from "@/lib/logistica-ok/queries-bandeja";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import {
  formatNumeroPreventaCarlos,
  formatQuincenaCorta,
} from "@/lib/pedido-proveedor/dato-duro-cabecera";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ListadoDbFila = ListadoPdfFila & {
  numero_registro: string | null;
  nro_pedido_externo: string | null;
  entidad_am: string | null;
  quincena: string | null;
  pares: number | null;
  estado: string | null;
  id_vendedor: number | null;
  id_cadena: number | null;
  pp_publicado_at: string | null;
  pv_global: number | null;
  factura_carlos: string | null;
};

function splitCsv(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function numero(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function etiquetaEntidad(entidad: string | null): string {
  const key = String(entidad ?? "").trim().toUpperCase() as EntidadAmLogistica;
  return ENTIDAD_AM_META[key]?.label ?? (String(entidad ?? "").trim() || "Sin entidad");
}

export async function GET(req: Request) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const url = new URL(req.url);
  const pedidoProveedorId = Number(url.searchParams.get("pedido_proveedor_id"));
  if (!Number.isInteger(pedidoProveedorId) || pedidoProveedorId <= 0) {
    return NextResponse.json(
      { ok: false, error: "pedido_proveedor_id es requerido y debe ser un entero positivo" },
      { status: 400 },
    );
  }

  const tab = (url.searchParams.get("tab") || "general").trim();
  const estadoPdf =
    tab === "general_exitoso" || tab === "exitosas"
      ? "EXITOSA"
      : url.searchParams.get("estado")?.trim().toUpperCase() || null;

  const filtros = {
    q: url.searchParams.get("q") ?? "",
    vendedores: splitCsv(url.searchParams.get("vendedores")),
    cadenas: splitCsv(url.searchParams.get("cadenas")),
    clientes: splitCsv(url.searchParams.get("clientes")),
    marcas: splitCsv(url.searchParams.get("marcas")),
  };

  try {
    const result = await getRimecPool().query<ListadoDbFila>(
      `
      SELECT l.id_cliente, cv.descp_cliente AS cliente, COALESCE(vd.descp_vendedor,'—') AS vendedor,
        cad.descp_cadena AS cadena, COALESCE(NULLIF(BTRIM(fi.marca),''),'Sin marca') AS marca,
        l.cajas, l.nro_factura, fi.pv_global, fi.factura_carlos, l.pares, l.estado,
        l.id_vendedor, l.id_cadena,
        pp.numero_registro, pp.nro_pedido_externo, l.entidad_am,
        qa.descripcion AS quincena,
        COALESCE(pp.logistica_activada_at, pp.created_at)::date::text AS pp_publicado_at
      FROM logistica_pendiente_confirmacion l
      JOIN factura_interna fi ON fi.id = l.factura_interna_id
      JOIN cliente_v2 cv ON cv.id_cliente = l.id_cliente
      JOIN pedido_proveedor pp ON pp.id = l.pedido_proveedor_id
      LEFT JOIN vendedor_v2 vd ON vd.id_vendedor = l.id_vendedor
      LEFT JOIN cadena_v2 cad ON cad.id_cadena = l.id_cadena
      LEFT JOIN quincena_arribo qa ON qa.id = pp.quincena_arribo_id
      WHERE l.pedido_proveedor_id = $1
        AND ($2::text IS NULL OR l.estado = $2)
      ORDER BY l.id_cliente, vendedor, marca
      `,
      [
        pedidoProveedorId,
        tab === "general_exitoso" || tab === "exitosas"
          ? "EXITOSA"
          : tab === "general"
            ? "PENDIENTE"
            : estadoPdf,
      ],
    );

    if (!result.rows.length) {
      return NextResponse.json(
        { ok: false, error: "No hay filas de Logística OK para este pedido / filtros" },
        { status: 404 },
      );
    }

    const filasBrutas = result.rows.map((fila) => ({
      id: 0,
      factura_interna_id: 0,
      pedido_proveedor_id: pedidoProveedorId,
      entidad_am: (fila.entidad_am || "CP") as EntidadAmLogistica,
      fecha_orden: "",
      id_cliente: numero(fila.id_cliente),
      id_cadena: fila.id_cadena != null ? Number(fila.id_cadena) : null,
      id_vendedor: fila.id_vendedor != null ? Number(fila.id_vendedor) : null,
      pares: numero(fila.pares),
      cajas: numero(fila.cajas),
      monto_neto: null,
      nro_factura: fila.nro_factura == null ? null : String(fila.nro_factura),
      pv_global: fila.pv_global != null ? Number(fila.pv_global) : null,
      factura_carlos: fila.factura_carlos?.trim() || null,
      factura_real:
        facturaRealDesdeRow({
          pv_global: fila.pv_global != null ? Number(fila.pv_global) : null,
          factura_carlos: fila.factura_carlos,
        }) || null,
      fecha_entrega_cliente: null,
      fecha_entrega_vendedor: null,
      estado: String(fila.estado ?? ""),
      pendiente_impresion_legal: true,
      impresion_legal_ok: false,
      pendiente_entrega: true,
      entregado_ok: false,
      fecha_entrega_efectiva: null,
      chofer_nombre: null,
      cliente: String(fila.cliente ?? ""),
      cadena: fila.cadena,
      vendedor: String(fila.vendedor ?? "—"),
      pp_numero: String(fila.numero_registro ?? ""),
      nro_pedido_externo: fila.nro_pedido_externo,
      marca: String(fila.marca ?? "Sin marca"),
      quincena_arribo_id: null,
      quincena_desc: fila.quincena,
      etiqueta_cadena: String(fila.cadena ?? fila.cliente ?? ""),
      pp_publicado_at: fila.pp_publicado_at?.slice(0, 10) ?? null,
      dias_atraso: diasAtrasoDesdePublicacion(fila.pp_publicado_at),
      obs_count: 0,
      obs_no_leida: false,
    }));

    const filtradas = filtrarFilasLogistica(filasBrutas, filtros);
    if (!filtradas.length) {
      return NextResponse.json(
        { ok: false, error: "Los filtros no dejan ninguna FI para el PDF" },
        { status: 404 },
      );
    }

    const source = result.rows[0];
    const filas: ListadoPdfFila[] = filtradas.map((fila) => ({
      id_cliente: fila.id_cliente,
      cliente: fila.cliente,
      vendedor: fila.vendedor,
      cadena: fila.cadena,
      marca: fila.marca,
      cajas: fila.cajas,
      nro_factura: fila.nro_factura,
    }));
    const nFi = new Set(filas.map((fila) => fila.nro_factura).filter((nro): nro is string => Boolean(nro))).size;
    const nClientes = new Set(filas.map((fila) => fila.id_cliente)).size;
    const preventa = formatNumeroPreventaCarlos(source.nro_pedido_externo) || String(source.numero_registro ?? "");
    const diasAtraso = diasAtrasoDesdePublicacion(source.pp_publicado_at);
    const filtrosLabel = [
      filtros.q ? `q=${filtros.q}` : "",
      filtros.vendedores.length ? `vend=${filtros.vendedores.length}` : "",
      filtros.cadenas.length ? `cad=${filtros.cadenas.length}` : "",
      filtros.clientes.length ? `cli=${filtros.clientes.length}` : "",
      filtros.marcas.length ? `marca=${filtros.marcas.length}` : "",
      estadoPdf ? `estado=${estadoPdf}` : "",
    ]
      .filter(Boolean)
      .join(" · ");

    const pdf = await buildListadoClientesPdf({
      filas,
      meta: {
        preventa,
        pp_numero: String(source.numero_registro ?? ""),
        entidad_label: etiquetaEntidad(source.entidad_am),
        quincena_corta: formatQuincenaCorta(source.quincena),
        n_fi: nFi,
        n_clientes: nClientes,
        dias_atraso: diasAtraso,
        pp_publicado_at: source.pp_publicado_at?.slice(0, 10) ?? null,
        filtros_label: filtrosLabel || "sin filtros",
      },
    });
    const nombreSeguro = (preventa || String(pedidoProveedorId)).replace(/[^\w.-]+/g, "_");

    const cuerpoPdf = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
    return new NextResponse(cuerpoPdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="LISTADO_CLIENTES_PRG_STOCK_${nombreSeguro}.pdf"`,
        "Cache-Control": "no-store",
        "X-Logistica-FI-Count": String(nFi),
        "X-Logistica-Dias-Atraso": String(diasAtraso),
      },
    });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Error generando listado de clientes";
    console.error("[Logística OK] listado clientes PDF:", error);
    return NextResponse.json({ ok: false, error: mensaje }, { status: 500 });
  }
}
