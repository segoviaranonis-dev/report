import { NextRequest, NextResponse } from "next/server";
import {
  getDepositoConfig,
  parseCategoriaDeposito,
} from "@/lib/depositos/depositos-config";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export type AnalisisNodo = {
  key: string;
  label: string;
  nivel: "pp" | "genero" | "marca" | "estilo" | "producto";
  inicial: number;
  vendido: number;
  saldo: number;
  skus: number;
  hijos?: AnalisisNodo[];
  // Datos del producto (solo para nivel producto)
  linea?: string;
  referencia?: string;
  material?: string;
  color?: string;
  tallas?: string[];
};

export type AnalisisResponse = {
  configured: boolean;
  resumen: {
    inicial: number;
    vendido: number;
    saldo: number;
    pct_vendido: number;
    total_skus: number;
    total_marcas: number;
  };
  resumen_operativo: AnalisisNodo[];      // Ente → Género → Marca → SKU
  analisis_por_estilo: AnalisisNodo[];    // Ente → Estilo → Marca → SKU
  analisis_por_marca: AnalisisNodo[];     // Ente → Marca → Estilo → SKU
  error?: string;
};

/**
 * GET /api/depositos/[cliente_id]/analisis
 *
 * Retorna estructura jerárquica para análisis de stock
 * Agrupado por: PP (batch) → Género → Marca → Estilo → Productos
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ cliente_id: string }> }
) {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({
      configured: false,
      resumen: {
        inicial: 0,
        vendido: 0,
        saldo: 0,
        pct_vendido: 0,
        total_skus: 0,
        total_marcas: 0,
      },
      resumen_operativo: [],
      analisis_por_estilo: [],
      analisis_por_marca: [],
      error: "Base de datos no configurada",
    } satisfies AnalisisResponse);
  }

  const { cliente_id: clienteIdStr } = await params;
  const cliente_id = parseInt(clienteIdStr);
  const categoria = parseCategoriaDeposito(new URL(req.url).searchParams.get("categoria"));
  const config = getDepositoConfig(cliente_id, categoria);
  const tabla = config?.tabla;
  if (!tabla) {
    return NextResponse.json(
      {
        configured: true,
        resumen: {
          inicial: 0,
          vendido: 0,
          saldo: 0,
          pct_vendido: 0,
          total_skus: 0,
          total_marcas: 0,
        },
        resumen_operativo: [],
        analisis_por_estilo: [],
        analisis_por_marca: [],
        error: `cliente_id ${cliente_id} no válido`,
      } satisfies AnalisisResponse,
      { status: 400 }
    );
  }

  try {
    const pool = getRimecPool();

    // 1. Calcular resumen general
    const { rows: resumenRows } = await pool.query<{
      total_inicial: string;
      total_skus: string;
      total_marcas: string;
    }>(`
      SELECT
        SUM(cantidad) AS total_inicial,
        COUNT(DISTINCT CONCAT(linea_id, '-', referencia_id, '-', material_id, '-', color_id)) AS total_skus,
        COUNT(DISTINCT marca_id) AS total_marcas
      FROM public.${tabla}
    `);

    const resumen = resumenRows[0];
    const inicial = parseFloat(resumen.total_inicial || "0");

    // Por ahora vendido = 0 (futuro: se calculará desde tickets)
    const vendido = 0;
    const saldo = inicial - vendido;
    const pct_vendido = inicial > 0 ? (vendido / inicial) * 100 : 0;

    // 2. Obtener estructura jerárquica agrupada
    const { rows: datosRows } = await pool.query<{
      batch_label: string;
      genero_id: number;
      genero: string;
      marca_id: number;
      marca: string;
      estilo_id: number | null;
      estilo: string | null;
      linea_codigo: string;
      ref_codigo: string;
      material_code: string;
      color_code: string;
      grada: string;
      cantidad: string;
    }>(`
      SELECT
        d.batch_label,
        COALESCE(g.id, 0) AS genero_id,
        COALESCE(g.descripcion, 'Sin género') AS genero,
        COALESCE(m.id_marca, 0) AS marca_id,
        COALESCE(m.descp_marca, 'Sin marca') AS marca,
        e.id_grupo_estilo AS estilo_id,
        e.descp_grupo_estilo AS estilo,
        d.linea_codigo_proveedor AS linea_codigo,
        d.referencia_codigo_proveedor AS ref_codigo,
        d.excel_material_code AS material_code,
        d.excel_color_code AS color_code,
        d.grada,
        d.cantidad
      FROM public.${tabla} d
      LEFT JOIN public.genero g ON g.id = d.genero_id
      LEFT JOIN public.marca_v2 m ON m.id_marca = d.marca_id
      LEFT JOIN public.grupo_estilo_v2 e ON e.id_grupo_estilo = d.grupo_estilo_id
      ORDER BY d.batch_label, genero, marca, estilo, linea_codigo, ref_codigo
    `);

    // 3. Construir árbol jerárquico
    const arbolMap = new Map<string, AnalisisNodo>();

    for (const row of datosRows) {
      const cantidad = parseFloat(row.cantidad);

      // Nivel 1: PP (Proveedor-Periodo)
      const ppKey = row.batch_label || "Sin PP";
      if (!arbolMap.has(ppKey)) {
        arbolMap.set(ppKey, {
          key: ppKey,
          label: ppKey,
          nivel: "pp",
          inicial: 0,
          vendido: 0,
          saldo: 0,
          skus: 0,
          hijos: [],
        });
      }
      const ppNodo = arbolMap.get(ppKey)!;
      ppNodo.inicial += cantidad;
      ppNodo.saldo += cantidad;

      // Nivel 2: Género
      const generoKey = `${ppKey}|${row.genero}`;
      let generoNodo = ppNodo.hijos?.find((h) => h.key === generoKey);
      if (!generoNodo) {
        generoNodo = {
          key: generoKey,
          label: row.genero,
          nivel: "genero",
          inicial: 0,
          vendido: 0,
          saldo: 0,
          skus: 0,
          hijos: [],
        };
        ppNodo.hijos!.push(generoNodo);
      }
      generoNodo.inicial += cantidad;
      generoNodo.saldo += cantidad;

      // Nivel 3: Marca
      const marcaKey = `${generoKey}|${row.marca}`;
      let marcaNodo = generoNodo.hijos?.find((h) => h.key === marcaKey);
      if (!marcaNodo) {
        marcaNodo = {
          key: marcaKey,
          label: row.marca,
          nivel: "marca",
          inicial: 0,
          vendido: 0,
          saldo: 0,
          skus: 0,
          hijos: [],
        };
        generoNodo.hijos!.push(marcaNodo);
      }
      marcaNodo.inicial += cantidad;
      marcaNodo.saldo += cantidad;

      // Nivel 4: Estilo
      const estiloLabel = row.estilo || "Sin estilo";
      const estiloKey = `${marcaKey}|${estiloLabel}`;
      let estiloNodo = marcaNodo.hijos?.find((h) => h.key === estiloKey);
      if (!estiloNodo) {
        estiloNodo = {
          key: estiloKey,
          label: estiloLabel,
          nivel: "estilo",
          inicial: 0,
          vendido: 0,
          saldo: 0,
          skus: 0,
          hijos: [],
        };
        marcaNodo.hijos!.push(estiloNodo);
      }
      estiloNodo.inicial += cantidad;
      estiloNodo.saldo += cantidad;

      // Nivel 5: Producto (SKU)
      const productoLabel = `${row.linea_codigo}-${row.ref_codigo}-${row.material_code}-${row.color_code}`;
      const productoKey = `${estiloKey}|${productoLabel}`;
      let productoNodo = estiloNodo.hijos?.find((h) => h.key === productoKey);
      if (!productoNodo) {
        productoNodo = {
          key: productoKey,
          label: productoLabel,
          nivel: "producto",
          inicial: 0,
          vendido: 0,
          saldo: 0,
          skus: 1,
          linea: row.linea_codigo,
          referencia: row.ref_codigo,
          material: row.material_code,
          color: row.color_code,
          tallas: [],
        };
        estiloNodo.hijos!.push(productoNodo);
        estiloNodo.skus++;
        marcaNodo.skus++;
        generoNodo.skus++;
        ppNodo.skus++;
      }
      productoNodo.inicial += cantidad;
      productoNodo.saldo += cantidad;

      // Agregar tallas
      const tallas = row.grada.split("/").map((t) => t.trim());
      for (const talla of tallas) {
        if (talla && !productoNodo.tallas!.includes(talla)) {
          productoNodo.tallas!.push(talla);
        }
      }
    }

    // 3. Construir los 3 árboles con agrupaciones diferentes
    const entes_map: Record<number, string> = {
      2100: "Fernando Adultos",
      2900: "Fernando Niños",
      2400: "San Martín Adultos",
      2700: "San Martín Niños",
      3100: "Palma Adultos",
      3200: "Palma Niños",
    };
    const ente_nombre = entes_map[cliente_id] || "Depósito";

    const resumen_operativo = construirArbolGeneroMarca(datosRows, ente_nombre);
    const analisis_por_estilo = construirArbolEstiloMarca(datosRows, ente_nombre);
    const analisis_por_marca = construirArbolMarcaEstilo(datosRows, ente_nombre);

    return NextResponse.json({
      configured: true,
      resumen: {
        inicial: Math.round(inicial),
        vendido,
        saldo: Math.round(saldo),
        pct_vendido: Math.round(pct_vendido * 10) / 10,
        total_skus: parseInt(resumen.total_skus || "0"),
        total_marcas: parseInt(resumen.total_marcas || "0"),
      },
      resumen_operativo,
      analisis_por_estilo,
      analisis_por_marca,
    } satisfies AnalisisResponse);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      {
        configured: true,
        resumen: {
          inicial: 0,
          vendido: 0,
          saldo: 0,
          pct_vendido: 0,
          total_skus: 0,
          total_marcas: 0,
        },
        resumen_operativo: [],
        analisis_por_estilo: [],
        analisis_por_marca: [],
        error: errorMsg,
      } satisfies AnalisisResponse,
      { status: 500 }
    );
  }
}

// ============================================================================
// FUNCIONES HELPER: Construir árboles con diferentes agrupaciones
// ============================================================================

type DatoRow = {
  genero: string;
  marca: string;
  estilo: string | null;
  linea_codigo: string;
  ref_codigo: string;
  material_code: string;
  color_code: string;
  grada: string;
  cantidad: string;
};

/**
 * 1. Resumen operativo: Ente → Género → Marca → SKU
 */
function construirArbolGeneroMarca(rows: DatoRow[], ente: string): AnalisisNodo[] {
  const raiz: AnalisisNodo = {
    key: ente,
    label: ente,
    nivel: "pp",
    inicial: 0,
    vendido: 0,
    saldo: 0,
    skus: 0,
    hijos: [],
  };

  for (const row of rows) {
    const cantidad = parseFloat(row.cantidad);

    // Nivel 1: Género
    const generoKey = `${ente}|${row.genero}`;
    let generoNodo = raiz.hijos!.find((h) => h.key === generoKey);
    if (!generoNodo) {
      generoNodo = {
        key: generoKey,
        label: row.genero,
        nivel: "genero",
        inicial: 0,
        vendido: 0,
        saldo: 0,
        skus: 0,
        hijos: [],
      };
      raiz.hijos!.push(generoNodo);
    }

    // Nivel 2: Marca
    const marcaKey = `${generoKey}|${row.marca}`;
    let marcaNodo = generoNodo.hijos!.find((h) => h.key === marcaKey);
    if (!marcaNodo) {
      marcaNodo = {
        key: marcaKey,
        label: row.marca,
        nivel: "marca",
        inicial: 0,
        vendido: 0,
        saldo: 0,
        skus: 0,
        hijos: [],
      };
      generoNodo.hijos!.push(marcaNodo);
    }

    // Nivel 3: Producto (SKU)
    const productoLabel = `${row.linea_codigo}-${row.ref_codigo}-${row.material_code}-${row.color_code}`;
    const productoKey = `${marcaKey}|${productoLabel}`;
    let productoNodo = marcaNodo.hijos!.find((h) => h.key === productoKey);
    if (!productoNodo) {
      productoNodo = {
        key: productoKey,
        label: productoLabel,
        nivel: "producto",
        inicial: 0,
        vendido: 0,
        saldo: 0,
        skus: 1,
        linea: row.linea_codigo,
        referencia: row.ref_codigo,
        material: row.material_code,
        color: row.color_code,
        tallas: [],
      };
      marcaNodo.hijos!.push(productoNodo);
      marcaNodo.skus++;
      generoNodo.skus++;
      raiz.skus++;
    }

    // Actualizar cantidades
    productoNodo.inicial += cantidad;
    productoNodo.saldo += cantidad;
    marcaNodo.inicial += cantidad;
    marcaNodo.saldo += cantidad;
    generoNodo.inicial += cantidad;
    generoNodo.saldo += cantidad;
    raiz.inicial += cantidad;
    raiz.saldo += cantidad;

    // Agregar tallas
    const tallas = row.grada.split("/").map((t) => t.trim());
    for (const talla of tallas) {
      if (talla && !productoNodo.tallas!.includes(talla)) {
        productoNodo.tallas!.push(talla);
      }
    }
  }

  return [raiz];
}

/**
 * 2. Análisis por Ente → Estilo → Marca → SKU
 */
function construirArbolEstiloMarca(rows: DatoRow[], ente: string): AnalisisNodo[] {
  const raiz: AnalisisNodo = {
    key: ente,
    label: ente,
    nivel: "pp",
    inicial: 0,
    vendido: 0,
    saldo: 0,
    skus: 0,
    hijos: [],
  };

  for (const row of rows) {
    const cantidad = parseFloat(row.cantidad);
    const estiloLabel = row.estilo || "Sin estilo";

    // Nivel 1: Estilo
    const estiloKey = `${ente}|${estiloLabel}`;
    let estiloNodo = raiz.hijos!.find((h) => h.key === estiloKey);
    if (!estiloNodo) {
      estiloNodo = {
        key: estiloKey,
        label: estiloLabel,
        nivel: "estilo",
        inicial: 0,
        vendido: 0,
        saldo: 0,
        skus: 0,
        hijos: [],
      };
      raiz.hijos!.push(estiloNodo);
    }

    // Nivel 2: Marca
    const marcaKey = `${estiloKey}|${row.marca}`;
    let marcaNodo = estiloNodo.hijos!.find((h) => h.key === marcaKey);
    if (!marcaNodo) {
      marcaNodo = {
        key: marcaKey,
        label: row.marca,
        nivel: "marca",
        inicial: 0,
        vendido: 0,
        saldo: 0,
        skus: 0,
        hijos: [],
      };
      estiloNodo.hijos!.push(marcaNodo);
    }

    // Nivel 3: Producto (SKU)
    const productoLabel = `${row.linea_codigo}-${row.ref_codigo}-${row.material_code}-${row.color_code}`;
    const productoKey = `${marcaKey}|${productoLabel}`;
    let productoNodo = marcaNodo.hijos!.find((h) => h.key === productoKey);
    if (!productoNodo) {
      productoNodo = {
        key: productoKey,
        label: productoLabel,
        nivel: "producto",
        inicial: 0,
        vendido: 0,
        saldo: 0,
        skus: 1,
        linea: row.linea_codigo,
        referencia: row.ref_codigo,
        material: row.material_code,
        color: row.color_code,
        tallas: [],
      };
      marcaNodo.hijos!.push(productoNodo);
      marcaNodo.skus++;
      estiloNodo.skus++;
      raiz.skus++;
    }

    // Actualizar cantidades
    productoNodo.inicial += cantidad;
    productoNodo.saldo += cantidad;
    marcaNodo.inicial += cantidad;
    marcaNodo.saldo += cantidad;
    estiloNodo.inicial += cantidad;
    estiloNodo.saldo += cantidad;
    raiz.inicial += cantidad;
    raiz.saldo += cantidad;

    // Agregar tallas
    const tallas = row.grada.split("/").map((t) => t.trim());
    for (const talla of tallas) {
      if (talla && !productoNodo.tallas!.includes(talla)) {
        productoNodo.tallas!.push(talla);
      }
    }
  }

  return [raiz];
}

/**
 * 3. Análisis por Ente → Marca → Estilo → SKU
 */
function construirArbolMarcaEstilo(rows: DatoRow[], ente: string): AnalisisNodo[] {
  const raiz: AnalisisNodo = {
    key: ente,
    label: ente,
    nivel: "pp",
    inicial: 0,
    vendido: 0,
    saldo: 0,
    skus: 0,
    hijos: [],
  };

  for (const row of rows) {
    const cantidad = parseFloat(row.cantidad);

    // Nivel 1: Marca
    const marcaKey = `${ente}|${row.marca}`;
    let marcaNodo = raiz.hijos!.find((h) => h.key === marcaKey);
    if (!marcaNodo) {
      marcaNodo = {
        key: marcaKey,
        label: row.marca,
        nivel: "marca",
        inicial: 0,
        vendido: 0,
        saldo: 0,
        skus: 0,
        hijos: [],
      };
      raiz.hijos!.push(marcaNodo);
    }

    // Nivel 2: Estilo
    const estiloLabel = row.estilo || "Sin estilo";
    const estiloKey = `${marcaKey}|${estiloLabel}`;
    let estiloNodo = marcaNodo.hijos!.find((h) => h.key === estiloKey);
    if (!estiloNodo) {
      estiloNodo = {
        key: estiloKey,
        label: estiloLabel,
        nivel: "estilo",
        inicial: 0,
        vendido: 0,
        saldo: 0,
        skus: 0,
        hijos: [],
      };
      marcaNodo.hijos!.push(estiloNodo);
    }

    // Nivel 3: Producto (SKU)
    const productoLabel = `${row.linea_codigo}-${row.ref_codigo}-${row.material_code}-${row.color_code}`;
    const productoKey = `${estiloKey}|${productoLabel}`;
    let productoNodo = estiloNodo.hijos!.find((h) => h.key === productoKey);
    if (!productoNodo) {
      productoNodo = {
        key: productoKey,
        label: productoLabel,
        nivel: "producto",
        inicial: 0,
        vendido: 0,
        saldo: 0,
        skus: 1,
        linea: row.linea_codigo,
        referencia: row.ref_codigo,
        material: row.material_code,
        color: row.color_code,
        tallas: [],
      };
      estiloNodo.hijos!.push(productoNodo);
      estiloNodo.skus++;
      marcaNodo.skus++;
      raiz.skus++;
    }

    // Actualizar cantidades
    productoNodo.inicial += cantidad;
    productoNodo.saldo += cantidad;
    estiloNodo.inicial += cantidad;
    estiloNodo.saldo += cantidad;
    marcaNodo.inicial += cantidad;
    marcaNodo.saldo += cantidad;
    raiz.inicial += cantidad;
    raiz.saldo += cantidad;

    // Agregar tallas
    const tallas = row.grada.split("/").map((t) => t.trim());
    for (const talla of tallas) {
      if (talla && !productoNodo.tallas!.includes(talla)) {
        productoNodo.tallas!.push(talla);
      }
    }
  }

  return [raiz];
}
