import { NextResponse } from "next/server";
import { fetchAprobacionesData } from "@/app/aprobaciones/lib/aprobaciones-queries";

/** GET — datasets FI-centric (gemelo Streamlit) */
export async function GET() {
  try {
    const data = await fetchAprobacionesData();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Error in /api/aprobaciones:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
