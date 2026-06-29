import { NextRequest, NextResponse } from "next/server";
import {
  getDepositoConfig,
  parseCategoriaDeposito,
  type CategoriaDeposito,
} from "@/lib/depositos/depositos-config";
import {
  hubEntesVisibles,
  labelAccesoDeposito,
  puedeSyncGlobal,
} from "@/lib/depositos/depositos-acceso";
import { getDepositoAccesoFromSession } from "@/lib/depositos/depositos-session";
import {
  TIPO_V2_CALZADO,
  TIPO_V2_CONFECCIONES,
} from "@/lib/depositos/pilar-proveedor-index";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export type HubRamoStats = {
  uds: number;
  filas: number;
};

export type HubTiendaStats = {
  cliente_id: number;
  label: string;
  aceptaConfeccion: boolean;
  palmaUnica: boolean;
  registros: number;
  pares_total: number;
  calzado: HubRamoStats;
  confeccion: HubRamoStats;
  /** Palma única: calzado adultos vs niños por marca */
  calzado_adultos?: HubRamoStats;
  calzado_ninos?: HubRamoStats;
  error?: string;
};

export type HubEnteStats = {
  ente: string;
  slug: string;
  tiendas: HubTiendaStats[];
};

export type DepositosHubResponse = {
  configured: boolean;
  categoria: CategoriaDeposito;
  entes: HubEnteStats[];
  acceso_label?: string;
  puede_sync_global?: boolean;
  error?: string;
};

async function statsTienda(
  clienteId: number,
  categoria: CategoriaDeposito,
  palmaUnica: boolean,
): Promise<Omit<HubTiendaStats, "cliente_id" | "label" | "aceptaConfeccion" | "palmaUnica">> {
  const config = getDepositoConfig(clienteId, categoria);
  if (!config) {
    return {
      registros: 0,
      pares_total: 0,
      calzado: { uds: 0, filas: 0 },
      confeccion: { uds: 0, filas: 0 },
      error: "cliente_id inválido",
    };
  }

  const pool = getRimecPool();
  const tabla = config.tabla;

  const { rows } = await pool.query<{
    tipo_v2_id: number | null;
    uds: number;
    filas: number;
    segmento: string | null;
  }>(
    `
    SELECT
      s.tipo_v2_id,
      COALESCE(SUM(s.cantidad), 0)::float AS uds,
      COUNT(*)::int AS filas,
      CASE
        WHEN $1::boolean AND s.tipo_v2_id = $2::int THEN
          CASE
            WHEN s.marca_id IN (5, 6) THEN 'calzado_ninos'
            WHEN s.marca_id IN (1, 2, 3, 4, 7, 8, 9) THEN 'calzado_adultos'
            ELSE 'calzado_otro'
          END
        ELSE NULL
      END AS segmento
    FROM public.${tabla} s
    WHERE s.cantidad > 0
    GROUP BY s.tipo_v2_id,
      CASE
        WHEN $1::boolean AND s.tipo_v2_id = $2::int THEN
          CASE
            WHEN s.marca_id IN (5, 6) THEN 'calzado_ninos'
            WHEN s.marca_id IN (1, 2, 3, 4, 7, 8, 9) THEN 'calzado_adultos'
            ELSE 'calzado_otro'
          END
        ELSE NULL
      END
    `,
    [palmaUnica, TIPO_V2_CALZADO],
  );

  let calzado = { uds: 0, filas: 0 };
  let confeccion = { uds: 0, filas: 0 };
  let calzado_adultos = { uds: 0, filas: 0 };
  let calzado_ninos = { uds: 0, filas: 0 };
  let pares_total = 0;
  let registros = 0;

  for (const r of rows) {
    const uds = Number(r.uds) || 0;
    const filas = Number(r.filas) || 0;
    pares_total += uds;
    registros += filas;

    if (r.tipo_v2_id === TIPO_V2_CONFECCIONES) {
      confeccion.uds += uds;
      confeccion.filas += filas;
    } else if (r.tipo_v2_id === TIPO_V2_CALZADO || r.tipo_v2_id == null) {
      calzado.uds += uds;
      calzado.filas += filas;
      if (r.segmento === "calzado_adultos") {
        calzado_adultos.uds += uds;
        calzado_adultos.filas += filas;
      } else if (r.segmento === "calzado_ninos") {
        calzado_ninos.uds += uds;
        calzado_ninos.filas += filas;
      }
    }
  }

  return {
    registros,
    pares_total,
    calzado,
    confeccion,
    ...(palmaUnica ? { calzado_adultos, calzado_ninos } : {}),
  };
}

export async function GET(req: NextRequest) {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({
      configured: false,
      entes: [],
      categoria: "tienda",
      error: "Base de datos no configurada",
    } satisfies DepositosHubResponse);
  }

  const categoria = parseCategoriaDeposito(new URL(req.url).searchParams.get("categoria"));
  const acceso = await getDepositoAccesoFromSession();
  if (!acceso) {
    return NextResponse.json(
      { configured: true, categoria, entes: [], error: "No autenticado" },
      { status: 401 },
    );
  }

  const hubs = hubEntesVisibles(acceso);

  try {
    const entes: HubEnteStats[] = [];

    for (const hub of hubs) {
      const tiendas: HubTiendaStats[] = [];
      for (const t of hub.tiendas) {
        try {
          const stats = await statsTienda(t.cliente_id, categoria, !!t.palmaUnica);
          tiendas.push({
            cliente_id: t.cliente_id,
            label: t.labelHub,
            aceptaConfeccion: t.aceptaConfeccion,
            palmaUnica: !!t.palmaUnica,
            ...stats,
          });
        } catch (error) {
          tiendas.push({
            cliente_id: t.cliente_id,
            label: t.labelHub,
            aceptaConfeccion: t.aceptaConfeccion,
            palmaUnica: !!t.palmaUnica,
            registros: 0,
            pares_total: 0,
            calzado: { uds: 0, filas: 0 },
            confeccion: { uds: 0, filas: 0 },
            error: error instanceof Error ? error.message : "Error",
          });
        }
      }
      entes.push({ ente: hub.ente, slug: hub.slug, tiendas });
    }

    return NextResponse.json({
      configured: true,
      categoria,
      entes,
      acceso_label: labelAccesoDeposito(acceso),
      puede_sync_global: puedeSyncGlobal(acceso),
    } satisfies DepositosHubResponse);
  } catch (error) {
    return NextResponse.json(
      {
        configured: true,
        categoria,
        entes: [],
        error: error instanceof Error ? error.message : "Error",
      } satisfies DepositosHubResponse,
      { status: 500 },
    );
  }
}
