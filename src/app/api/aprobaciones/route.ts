import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Usar la vista SQL optimizada (1 sola query con JOINs en PostgreSQL)
    const { data, error } = await supabase
      .from("v_aprobaciones_detalladas")
      .select("*")
      .limit(50);

    if (error) {
      console.error("Error fetching pedidos:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json([]);
    }

    // Transformar datos
    const pedidos = data.map((p: any) => ({
      id: p.id,
      nro_pedido: p.nro_pedido || `PVR-${p.id}`,
      fecha: p.fecha_creacion
        ? new Date(p.fecha_creacion).toLocaleDateString("es-PY", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "-",
      vendedor: p.vendedor_nombre || `Vendedor ${p.vendedor_id || "?"}`,
      cliente: p.cliente_nombre || `Cliente ${p.cliente_id || "?"}`,
      total: p.total_monto || 0,
      items_count: p.total_pares || 0,
      estado: mapEstado(p.estado),
      descuento_porcentaje: p.descuento_1 || 0,
      plazo: p.plazo_id ? `Plazo ${p.plazo_id}` : "EFECTIVO",
      lista_precio: p.lista_precio_id ? `LP${p.lista_precio_id}` : "LP1",
    }));

    return NextResponse.json(pedidos);
  } catch (err) {
    console.error("Error in /api/aprobaciones:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function mapEstado(
  dbEstado: string | null
): "PENDIENTE" | "APROBADO" | "RECHAZADO" {
  if (!dbEstado) return "PENDIENTE";
  const upper = dbEstado.toUpperCase();
  if (upper.includes("APROBADO") || upper.includes("CONFIRMADO"))
    return "APROBADO";
  if (upper.includes("RECHAZADO") || upper.includes("CANCELADO"))
    return "RECHAZADO";
  return "PENDIENTE";
}

// POST: Aprobar o rechazar pedido
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, pedido_id, admin_id, motivo } = body;

    if (!action || !pedido_id || !admin_id) {
      return NextResponse.json(
        { error: "Faltan parámetros: action, pedido_id, admin_id" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    let result;

    if (action === "aprobar") {
      const { data, error } = await supabase.rpc("aprobar_pedido", {
        p_pedido_id: pedido_id,
        p_admin_id: admin_id,
      });

      if (error) {
        console.error("Error aprobando pedido:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      result = data;
    } else if (action === "rechazar") {
      const { data, error } = await supabase.rpc("rechazar_pedido", {
        p_pedido_id: pedido_id,
        p_admin_id: admin_id,
        p_motivo: motivo || null,
      });

      if (error) {
        console.error("Error rechazando pedido:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      result = data;
    } else {
      return NextResponse.json(
        { error: "Acción inválida. Use 'aprobar' o 'rechazar'" },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Error in POST /api/aprobaciones:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
