import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const pedidoId = parseInt(params.id);
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener facturas internas del pedido
    const { data, error } = await supabase
      .from("factura_interna")
      .select(
        `
        id,
        nro_factura,
        pp_id,
        pedido_id,
        marca,
        marca_id,
        caso,
        caso_id,
        total_pares,
        total_monto,
        estado,
        lista_precio_id,
        descuento_1,
        descuento_2,
        descuento_3,
        descuento_4,
        created_at
      `
      )
      .eq("pedido_id", pedidoId)
      .order("pp_id")
      .order("marca")
      .order("caso");

    if (error) {
      console.error("Error fetching facturas:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json([]);
    }

    // Obtener PP IDs únicos
    const ppIds = [...new Set(data.map((f: any) => f.pp_id).filter(Boolean))];

    // Consultar pedidos_proveedor
    const { data: ppData } = await supabase
      .from("pedido_proveedor")
      .select("id, numero_registro, fecha_arribo_estimada")
      .in("id", ppIds);

    // Crear map de PP
    const ppMap = new Map(
      (ppData || []).map((pp: any) => [
        pp.id,
        {
          numero_registro: pp.numero_registro,
          fecha_arribo_estimada: pp.fecha_arribo_estimada,
        },
      ])
    );

    // Transformar datos
    const facturas = data.map((f: any) => {
      const pp = ppMap.get(f.pp_id);
      return {
        id: f.id,
        nro_factura: f.nro_factura,
        pp_id: f.pp_id,
        nro_pp: pp?.numero_registro || `PP-${f.pp_id}`,
        fecha_arribo_estimada: pp?.fecha_arribo_estimada || null,
        marca: f.marca,
        caso: f.caso,
        total_pares: f.total_pares || 0,
        total_monto: f.total_monto || 0,
        estado: f.estado || "RESERVADA",
        lista_precio_id: f.lista_precio_id || null,
        descuento_1: f.descuento_1 || 0,
        descuento_2: f.descuento_2 || 0,
        descuento_3: f.descuento_3 || 0,
        descuento_4: f.descuento_4 || 0,
      };
    });

    return NextResponse.json(facturas);
  } catch (err) {
    console.error("Error in /api/aprobaciones/[id]/facturas:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
