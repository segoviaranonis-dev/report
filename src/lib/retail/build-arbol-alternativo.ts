/**
 * Construcción de árboles jerárquicos alternativos para análisis retail
 */

import type { RetailArbolNodo } from "./arbol-snapshot-types";
import type { ArbolLeafAlternativo } from "./load-arbol-alternativo";

type Jerarquia = "ente-estilo-marca" | "ente-marca-estilo";

/**
 * Orden específico para entes (tiendas)
 */
const ORDEN_ENTES: Record<string, number> = {
  "RIMEC": 1,
  "Fernando": 2,
  "San Martín": 3,
  "San Martin": 3,  // Sin tilde también
  "Palma": 4,
};

/**
 * Ordena nodos de primer nivel (entes) según orden específico
 */
function ordenarEntes(nodos: RetailArbolNodo[]): RetailArbolNodo[] {
  return nodos.sort((a, b) => {
    const ordenA = ORDEN_ENTES[a.nombre] ?? 999;
    const ordenB = ORDEN_ENTES[b.nombre] ?? 999;
    if (ordenA !== ordenB) return ordenA - ordenB;
    return a.nombre.localeCompare(b.nombre);
  });
}

/**
 * Construye árbol según jerarquía especificada
 */
export function construirArbolAlternativo(
  leaves: ArbolLeafAlternativo[],
  tipo: Jerarquia
): RetailArbolNodo[] {
  switch (tipo) {
    case "ente-estilo-marca":
      return construirEnteEstiloMarca(leaves);
    case "ente-marca-estilo":
      return construirEnteMarcaEstilo(leaves);
  }
}

/**
 * Tabla 1: Ente → Estilo → Marca → SKU
 */
function construirEnteEstiloMarca(leaves: ArbolLeafAlternativo[]): RetailArbolNodo[] {
  const tree = new Map<string, RetailArbolNodo>();

  for (const leaf of leaves) {
    // Nivel 1: Ente
    const enteKey = leaf.ente;
    if (!tree.has(enteKey)) {
      tree.set(enteKey, {
        id: `ente:${enteKey}`,
        nombre: leaf.ente,
        nivel: 1,
        count: 0,
        stock: 0,
        venta: 0,
        total: 0,
        hijos: [],
      });
    }
    const enteNode = tree.get(enteKey)!;
    enteNode.stock += leaf.stock;
    enteNode.venta += leaf.venta;
    enteNode.total = enteNode.stock + enteNode.venta;

    // Nivel 2: Estilo
    const estiloKey = `${enteKey}|${leaf.estilo}`;
    let estiloNode = enteNode.hijos?.find((n) => n.id === `estilo:${estiloKey}`);
    if (!estiloNode) {
      estiloNode = {
        id: `estilo:${estiloKey}`,
        nombre: leaf.estilo,
        nivel: 2,
        count: 0,
        stock: 0,
        venta: 0,
        total: 0,
        hijos: [],
      };
      enteNode.hijos!.push(estiloNode);
      enteNode.count++;
    }
    estiloNode.stock += leaf.stock;
    estiloNode.venta += leaf.venta;
    estiloNode.total = estiloNode.stock + estiloNode.venta;

    // Nivel 3: Marca
    const marcaKey = `${estiloKey}|${leaf.marca}`;
    let marcaNode = estiloNode.hijos?.find((n) => n.id === `marca:${marcaKey}`);
    if (!marcaNode) {
      marcaNode = {
        id: `marca:${marcaKey}`,
        nombre: leaf.marca,
        nivel: 3,
        count: 0,
        stock: 0,
        venta: 0,
        total: 0,
        hijos: [],
      };
      estiloNode.hijos!.push(marcaNode);
      estiloNode.count++;
    }
    marcaNode.stock += leaf.stock;
    marcaNode.venta += leaf.venta;
    marcaNode.total = marcaNode.stock + marcaNode.venta;

    // Nivel 4: SKU
    const skuTotal = leaf.stock + leaf.venta;
    marcaNode.hijos!.push({
      id: `sku:${leaf.skuKey}`,
      nombre: leaf.skuLabel,
      nivel: 4,
      count: 0,
      stock: leaf.stock,
      venta: leaf.venta,
      total: skuTotal,
    });
    marcaNode.count++;
  }

  return ordenarEntes(Array.from(tree.values()));
}

/**
 * Tabla 2: Ente → Marca → Estilo → SKU
 */
function construirEnteMarcaEstilo(leaves: ArbolLeafAlternativo[]): RetailArbolNodo[] {
  const tree = new Map<string, RetailArbolNodo>();

  for (const leaf of leaves) {
    // Nivel 1: Ente
    const enteKey = leaf.ente;
    if (!tree.has(enteKey)) {
      tree.set(enteKey, {
        id: `ente:${enteKey}`,
        nombre: leaf.ente,
        nivel: 1,
        count: 0,
        stock: 0,
        venta: 0,
        total: 0,
        hijos: [],
      });
    }
    const enteNode = tree.get(enteKey)!;
    enteNode.stock += leaf.stock;
    enteNode.venta += leaf.venta;
    enteNode.total = enteNode.stock + enteNode.venta;

    // Nivel 2: Marca
    const marcaKey = `${enteKey}|${leaf.marca}`;
    let marcaNode = enteNode.hijos?.find((n) => n.id === `marca:${marcaKey}`);
    if (!marcaNode) {
      marcaNode = {
        id: `marca:${marcaKey}`,
        nombre: leaf.marca,
        nivel: 2,
        count: 0,
        stock: 0,
        venta: 0,
        total: 0,
        hijos: [],
      };
      enteNode.hijos!.push(marcaNode);
      enteNode.count++;
    }
    marcaNode.stock += leaf.stock;
    marcaNode.venta += leaf.venta;
    marcaNode.total = marcaNode.stock + marcaNode.venta;

    // Nivel 3: Estilo
    const estiloKey = `${marcaKey}|${leaf.estilo}`;
    let estiloNode = marcaNode.hijos?.find((n) => n.id === `estilo:${estiloKey}`);
    if (!estiloNode) {
      estiloNode = {
        id: `estilo:${estiloKey}`,
        nombre: leaf.estilo,
        nivel: 3,
        count: 0,
        stock: 0,
        venta: 0,
        total: 0,
        hijos: [],
      };
      marcaNode.hijos!.push(estiloNode);
      marcaNode.count++;
    }
    estiloNode.stock += leaf.stock;
    estiloNode.venta += leaf.venta;
    estiloNode.total = estiloNode.stock + estiloNode.venta;

    // Nivel 4: SKU
    const skuTotal = leaf.stock + leaf.venta;
    estiloNode.hijos!.push({
      id: `sku:${leaf.skuKey}`,
      nombre: leaf.skuLabel,
      nivel: 4,
      count: 0,
      stock: leaf.stock,
      venta: leaf.venta,
      total: skuTotal,
    });
    estiloNode.count++;
  }

  return ordenarEntes(Array.from(tree.values()));
}

/**
 * Calcula KPIs totales
 */
export function calcularKpisAlternativo(
  leaves: ArbolLeafAlternativo[],
  totalFilas: number
) {
  let stock = 0;
  let venta = 0;
  const skus = new Set<string>();

  for (const leaf of leaves) {
    stock += leaf.stock;
    venta += leaf.venta;
    skus.add(leaf.skuKey);
  }

  return {
    stock,
    venta,
    total: stock + venta,
    skus: skus.size,
    filasExcel: totalFilas,
  };
}
