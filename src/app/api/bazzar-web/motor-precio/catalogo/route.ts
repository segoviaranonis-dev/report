import { NextResponse } from "next/server";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import {
  getCatalogoPrecios,
  purgarSellosHuerfanos,
  repararSellosDesfasadosAlineados,
} from "@/lib/bazzar-web/motor-precio/catalogo";
import {
  estadoPublicacionMotor,
  selloMotorDesfasado,
  selloMotorHuerfano,
} from "@/lib/bazzar-web/motor-precio/types";

export async function GET() {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ configured: false, catalogo: [] }, { status: 503 });
  }
  try {
    let catalogo = await getCatalogoPrecios();
    const huerfanos = catalogo.filter(selloMotorHuerfano).length;
    const desfasados = catalogo.filter(selloMotorDesfasado).length;
    let sellos_reparados = 0;
    let sellos_purgados = 0;

    // Siempre purga huérfanos de almacén (incluye tripleta sin stock actual).
    const purge = await purgarSellosHuerfanos();
    sellos_purgados = purge.purgados;
    if (desfasados > 0) {
      const heal = await repararSellosDesfasadosAlineados(catalogo);
      sellos_reparados = heal.reparados;
    }
    if (sellos_reparados > 0 || sellos_purgados > 0 || huerfanos > 0) {
      catalogo = await getCatalogoPrecios();
    }

    const conPrecio = catalogo.filter((r) => !r.sin_precio).length;
    const conflictos = catalogo.filter(
      (r) => estadoPublicacionMotor(r) === "pendiente_conflicto",
    ).length;
    return NextResponse.json({
      configured: true,
      catalogo,
      metricas: {
        skus: catalogo.length,
        con_precio: conPrecio,
        sin_precio: catalogo.length - conPrecio,
        pares: catalogo.reduce((s, r) => s + r.stock_pares, 0),
        conflictos,
        sellos_reparados,
        sellos_purgados,
      },
    });
  } catch (err) {
    console.error("[motor-precio/catalogo]", err);
    return NextResponse.json({ error: "Error al cargar catálogo" }, { status: 500 });
  }
}
