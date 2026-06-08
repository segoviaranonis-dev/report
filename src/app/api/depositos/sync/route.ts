import { NextRequest, NextResponse } from "next/server";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

/**
 * Configuración de los 6 depósitos Bazzar
 */
const DEPOSITOS_CONFIG = [
  {
    cliente_id: 2100,
    ente: "Fernando",
    tipo: "Adultos",
    tabla: "deposito_tienda_fernando_adultos",
  },
  {
    cliente_id: 2900,
    ente: "Fernando",
    tipo: "Niños",
    tabla: "deposito_tienda_fernando_ninos",
  },
  {
    cliente_id: 2400,
    ente: "San Martin",
    tipo: "Adultos",
    tabla: "deposito_tienda_sanmartin_adultos",
  },
  {
    cliente_id: 2700,
    ente: "San Martin",
    tipo: "Niños",
    tabla: "deposito_tienda_sanmartin_ninos",
  },
  {
    cliente_id: 3100,
    ente: "Palma",
    tipo: "Adultos",
    tabla: "deposito_tienda_palma_adultos",
  },
  {
    cliente_id: 3200,
    ente: "Palma",
    tipo: "Niños",
    tabla: "deposito_tienda_palma_ninos",
  },
] as const;

export type DepositoConfig = typeof DEPOSITOS_CONFIG[number];

type SyncResult = {
  cliente_id: number;
  ente: string;
  tipo: string;
  registros_borrados: number;
  registros_insertados: number;
  duracion_ms: number;
  error?: string;
};

type SyncAllResponse = {
  configured: boolean;
  success: boolean;
  resultados: SyncResult[];
  total_registros: number;
  duracion_total_ms: number;
  error?: string;
};

/**
 * Sincroniza un depósito individual
 */
async function syncDeposito(config: DepositoConfig): Promise<SyncResult> {
  const inicio = Date.now();
  const pool = getRimecPool();

  try {
    // 1. Borrar registros existentes
    const deleteResult = await pool.query(
      `DELETE FROM public.${config.tabla}`,
    );
    const registros_borrados = deleteResult.rowCount || 0;

    // 2. Insertar registros desde registro_st_vt_rc_reposicion
    //    FILTRADO por tiendas_marcas (solo marcas permitidas)
    //    NOTA: Excluimos sku_key porque es columna GENERATED
    const insertResult = await pool.query(
      `
      INSERT INTO public.${config.tabla} (
        id, batch_id, batch_label, fecha_mov, origen_holding, tipo_movimiento,
        codigo_barras, linea_codigo_proveedor, referencia_codigo_proveedor,
        excel_material_code, excel_color_code, linea_id, referencia_id,
        material_id, color_id, grada, cantidad, precio_unitario, monto,
        imagen_nombre, archivo_origen, excel_sheet, created_at, created_by,
        marca_id, genero_id, grupo_estilo_id, tipo_1_id, tipo_v2_id, cliente_id
      )
      SELECT
        r.id, r.batch_id, r.batch_label, r.fecha_mov, r.origen_holding, r.tipo_movimiento,
        r.codigo_barras, r.linea_codigo_proveedor, r.referencia_codigo_proveedor,
        r.excel_material_code, r.excel_color_code, r.linea_id, r.referencia_id,
        r.material_id, r.color_id, r.grada, r.cantidad, r.precio_unitario, r.monto,
        r.imagen_nombre, r.archivo_origen, r.excel_sheet, r.created_at, r.created_by,
        r.marca_id, r.genero_id, r.grupo_estilo_id, r.tipo_1_id, r.tipo_v2_id, r.cliente_id
      FROM public.registro_st_vt_rc_reposicion r
      INNER JOIN public.tiendas_marcas tm ON
        tm.cliente_id = $1 AND
        tm.marca_id = r.marca_id AND
        tm.activo = true
      WHERE r.cliente_id = $1
        AND lower(btrim(r.tipo_movimiento)) = 'stock'
      `,
      [config.cliente_id],
    );
    const registros_insertados = insertResult.rowCount || 0;

    const duracion_ms = Date.now() - inicio;

    return {
      cliente_id: config.cliente_id,
      ente: config.ente,
      tipo: config.tipo,
      registros_borrados,
      registros_insertados,
      duracion_ms,
    };
  } catch (error) {
    const duracion_ms = Date.now() - inicio;
    const errorMsg = error instanceof Error ? error.message : "Error desconocido";

    return {
      cliente_id: config.cliente_id,
      ente: config.ente,
      tipo: config.tipo,
      registros_borrados: 0,
      registros_insertados: 0,
      duracion_ms,
      error: errorMsg,
    };
  }
}

/**
 * POST /api/depositos/sync
 *
 * Body (opcional):
 * {
 *   "cliente_id": 2100  // Si se envía, sincroniza solo ese depósito
 * }
 *
 * Sin body: sincroniza TODOS los depósitos
 */
export async function POST(req: NextRequest) {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        success: false,
        resultados: [],
        total_registros: 0,
        duracion_total_ms: 0,
        error: "Base de datos no configurada",
      } satisfies SyncAllResponse,
      { status: 500 },
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const cliente_id = body.cliente_id as number | undefined;

    const inicio = Date.now();

    // Si se especifica cliente_id, sincronizar solo ese depósito
    let depositosASincronizar = DEPOSITOS_CONFIG;
    if (cliente_id) {
      const deposito = DEPOSITOS_CONFIG.find((d) => d.cliente_id === cliente_id);
      if (!deposito) {
        return NextResponse.json(
          {
            configured: true,
            success: false,
            resultados: [],
            total_registros: 0,
            duracion_total_ms: 0,
            error: `cliente_id ${cliente_id} no encontrado`,
          } satisfies SyncAllResponse,
          { status: 400 },
        );
      }
      depositosASincronizar = [deposito];
    }

    // Sincronizar en paralelo
    const resultados = await Promise.all(
      depositosASincronizar.map((config) => syncDeposito(config)),
    );

    const duracion_total_ms = Date.now() - inicio;
    const total_registros = resultados.reduce(
      (sum, r) => sum + r.registros_insertados,
      0,
    );
    const success = resultados.every((r) => !r.error);

    return NextResponse.json({
      configured: true,
      success,
      resultados,
      total_registros,
      duracion_total_ms,
    } satisfies SyncAllResponse);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      {
        configured: true,
        success: false,
        resultados: [],
        total_registros: 0,
        duracion_total_ms: 0,
        error: errorMsg,
      } satisfies SyncAllResponse,
      { status: 500 },
    );
  }
}

/**
 * GET /api/depositos/sync
 * Retorna el estado actual de los 6 depósitos (cantidad de registros)
 */
export async function GET() {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({
      configured: false,
      depositos: [],
    });
  }

  try {
    const pool = getRimecPool();

    const estados = await Promise.all(
      DEPOSITOS_CONFIG.map(async (config) => {
        try {
          const result = await pool.query(
            `SELECT COUNT(*)::int AS count FROM public.${config.tabla}`,
          );
          const count = result.rows[0]?.count || 0;

          return {
            cliente_id: config.cliente_id,
            ente: config.ente,
            tipo: config.tipo,
            registros: count,
          };
        } catch (error) {
          return {
            cliente_id: config.cliente_id,
            ente: config.ente,
            tipo: config.tipo,
            registros: 0,
            error: error instanceof Error ? error.message : "Error",
          };
        }
      }),
    );

    return NextResponse.json({
      configured: true,
      depositos: estados,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      {
        configured: true,
        depositos: [],
        error: errorMsg,
      },
      { status: 500 },
    );
  }
}
