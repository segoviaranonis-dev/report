import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Usar MISMA query que Streamlit: pedido_venta_rimec con JOINs
    const { data, error } = await supabase
      .from("pedido_venta_rimec")
      .select(`
        id,
        nro_pedido,
        created_at,
        vendedor_id,
        cliente_id,
        total_monto,
        total_pares,
        estado,
        plazo_id,
        lista_precio_id,
        descuento_1,
        descuento_2,
        descuento_3,
        descuento_4,
        fecha_aprobacion,
        fecha_rechazo,
        motivo_rechazo,
        cliente_v2!pedido_venta_rimec_cliente_id_fkey(descp_cliente),
        usuario_v2!pedido_venta_rimec_vendedor_id_fkey(descp_usuario)
      `)
      .order("id", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error fetching pedidos:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json([]);
    }

    // Transformar datos (MISMO formato que Streamlit)
    const pedidos = data.map((p: any) => ({
      id: p.id,
      nro_pedido: p.nro_pedido || `PV-${String(p.id).padStart(6, "0")}`,
      fecha: p.created_at
        ? new Date(p.created_at).toLocaleDateString("es-PY", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "-",
      vendedor: p.usuario_v2?.descp_usuario || `Vendedor ${p.vendedor_id || "?"}`,
      cliente: p.cliente_v2?.descp_cliente || `Cliente ${p.cliente_id || "?"}`,
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
