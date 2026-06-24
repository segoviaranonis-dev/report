import { NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Params = { params: Promise<{ ppId: string }> };

function csvEscape(v: string | number | null | undefined): string {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(_req: Request, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const ppId = Number((await params).ppId);
  if (!Number.isFinite(ppId)) {
    return NextResponse.json({ ok: false, error: "PP inválido" }, { status: 400 });
  }

  try {
    const pool = getRimecPool();
    const ppRow = await pool.query<{ numero_registro: string }>(
      "SELECT numero_registro FROM pedido_proveedor WHERE id = $1",
      [ppId],
    );
    if (!ppRow.rows[0]) {
      return NextResponse.json({ ok: false, error: "PP no encontrado" }, { status: 404 });
    }

    const fiCount = await pool.query<{ n: string }>(
      "SELECT COUNT(*)::text AS n FROM factura_interna WHERE pp_id = $1 AND estado = 'CONFIRMADA'",
      [ppId],
    );
    if (Number(fiCount.rows[0]?.n ?? 0) === 0) {
      return NextResponse.json({ ok: false, error: "Sin FI confirmadas para exportar" }, { status: 400 });
    }

    const { rows } = await pool.query<{
      marca: string;
      factura: string;
      cliente: string;
      vendedor: string;
      linea: string;
      referencia: string;
      material: string;
      color: string;
      grada: string | null;
      pares: string;
    }>(
      `
      SELECT
        COALESCE(mv.descp_marca, '—') AS marca,
        COALESCE(vt.numero_factura_interna, fi.nro_factura, '—') AS factura,
        COALESCE(cv.descp_cliente, vt.codigo_cliente, '—') AS cliente,
        COALESCE(uv.descp_usuario, '—') AS vendedor,
        ppd.linea,
        ppd.referencia,
        COALESCE(ppd.descp_material, '—') AS material,
        COALESCE(ppd.descp_color, '—') AS color,
        ppd.grada,
        SUM(COALESCE(vt.cantidad_vendida, fid.pares, 0))::text AS pares
      FROM factura_interna fi
      JOIN factura_interna_detalle fid ON fid.factura_id = fi.id
      JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
      LEFT JOIN venta_transito vt ON vt.pedido_proveedor_detalle_id = ppd.id
        AND vt.numero_factura_interna = fi.nro_factura
      LEFT JOIN marca_v2 mv ON mv.id_marca = ppd.id_marca
      LEFT JOIN cliente_v2 cv ON cv.id_cliente = fi.cliente_id
      LEFT JOIN usuario_v2 uv ON uv.id_usuario = fi.vendedor_id
      WHERE fi.pp_id = $1 AND fi.estado = 'CONFIRMADA'
      GROUP BY mv.descp_marca, fi.nro_factura, vt.numero_factura_interna,
               cv.descp_cliente, vt.codigo_cliente, uv.descp_usuario,
               ppd.linea, ppd.referencia, ppd.descp_material, ppd.descp_color, ppd.grada
      ORDER BY fi.nro_factura, ppd.linea, ppd.referencia
      `,
      [ppId],
    );

    const header = ["marca", "factura", "cliente", "vendedor", "linea", "referencia", "material", "color", "grada", "pares"];
    const lines = [
      header.join(","),
      ...rows.map((r) =>
        [r.marca, r.factura, r.cliente, r.vendedor, r.linea, r.referencia, r.material, r.color, r.grada ?? "", r.pares]
          .map(csvEscape)
          .join(","),
      ),
    ];
    const csv = lines.join("\n");
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const filename = `${ppRow.rows[0].numero_registro}_ventas_${ts}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
