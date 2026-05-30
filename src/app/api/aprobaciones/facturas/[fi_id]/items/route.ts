import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(
  request: Request,
  { params }: { params: { fi_id: string } }
) {
  try {
    const fiId = parseInt(params.fi_id);
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener items de la factura interna
    const { data, error } = await supabase
      .from("factura_interna_detalle")
      .select(
        `
        id,
        pares,
        cajas,
        precio_neto,
        subtotal,
        linea_snapshot
      `
      )
      .eq("factura_id", fiId)
      .order("id");

    if (error) {
      console.error("Error fetching items:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transformar datos y parsear snapshot
    const items = (data || []).map((item: any) => {
      let snapshot = {};
      if (item.linea_snapshot) {
        try {
          snapshot = typeof item.linea_snapshot === "string"
            ? JSON.parse(item.linea_snapshot)
            : item.linea_snapshot;
        } catch (e) {
          console.error("Error parsing linea_snapshot:", e);
        }
      }

      return {
        id: item.id,
        pares: item.pares || 0,
        cajas: item.cajas || 0,
        precio_neto: item.precio_neto || 0,
        subtotal: item.subtotal || 0,
        linea_codigo: snapshot.linea_codigo || snapshot.linea || "?",
        ref_codigo: snapshot.ref_codigo || snapshot.referencia || "?",
        color_nombre: snapshot.color_nombre || snapshot.color || "",
        material_nombre: snapshot.material_nombre || snapshot.material || "",
        gradas_fmt: snapshot.gradas_fmt || "",
        imagen_url: snapshot.imagen_url || "",
      };
    });

    return NextResponse.json(items);
  } catch (err) {
    console.error("Error in /api/aprobaciones/facturas/[fi_id]/items:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
