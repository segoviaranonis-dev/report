/**
 * Auditoría integridad stock ALM_WEB_01 ↔ v_stock_web ↔ Stock Sano.
 */
import { getRimecPool } from "@/lib/rimec/pool";
import { ALM_WEB_BAZAR } from "@/lib/bazzar-web/compra-web/constants";
import type { AuditoriaCheck, AuditoriaStockPayload } from "./types";

export async function getAuditoriaStock(): Promise<AuditoriaStockPayload> {
  const pool = getRimecPool();
  const alm = ALM_WEB_BAZAR;

  const [proto, ssd, byEstado, vendible, porProv] = await Promise.all([
    pool.query<{
      protocolo_activo: boolean;
      lista_precio_id: number | null;
    }>(
      `SELECT protocolo_activo, lista_precio_id
       FROM stock_sano_almacen WHERE almacen_id = $1`,
      [alm],
    ),
    pool.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM stock_sano_deposito WHERE almacen_id = $1`,
      [alm],
    ),
    pool.query<{
      estado: string;
      filas: number;
      pares: string;
      con_precio: number;
    }>(
      `SELECT COALESCE(stock_sano_estado::text, 'NULL') AS estado,
              COUNT(*)::int AS filas,
              COALESCE(SUM(stock_web),0)::text AS pares,
              COUNT(*) FILTER (WHERE COALESCE(precio_web,0) > 0)::int AS con_precio
       FROM v_stock_web
       WHERE COALESCE(stock_web,0) > 0
       GROUP BY 1`,
    ),
    pool.query<{ filas: number; pares: string; modelos: number }>(
      `SELECT COUNT(*)::int AS filas,
              COALESCE(SUM(stock_web),0)::text AS pares,
              COUNT(DISTINCT (linea_codigo::text || '|' || referencia_codigo::text || '|' || COALESCE(material_code::text,'')))::int AS modelos
       FROM v_stock_web
       WHERE stock_web > 0
         AND COALESCE(precio_web,0) > 0
         AND stock_sano_estado = 'SANO'`,
    ),
    pool.query<{ prov: number; modelos: number }>(
      `SELECT COALESCE(proveedor_importacion_id, 0)::int AS prov,
              COUNT(DISTINCT (linea_codigo::text || '|' || referencia_codigo::text || '|' || COALESCE(material_code::text,'')))::int AS modelos
       FROM v_stock_web
       WHERE stock_web > 0
         AND COALESCE(precio_web,0) > 0
         AND stock_sano_estado = 'SANO'
       GROUP BY 1`,
    ),
  ]);

  const p = proto.rows[0];
  const protocoloActivo = Boolean(p?.protocolo_activo);
  const v = vendible.rows[0] ?? { filas: 0, pares: "0", modelos: 0 };
  const sano = byEstado.rows.find((r) => r.estado === "SANO");
  const otros = byEstado.rows.filter((r) => r.estado !== "SANO");
  const sinSano = otros.reduce((s, r) => s + Number(r.filas), 0);
  const filasStock = byEstado.rows.reduce((s, r) => s + Number(r.filas), 0);
  const paresStock = byEstado.rows.reduce((s, r) => s + Number(r.pares), 0);
  const sinPrecioEnSano = sano
    ? Number(sano.filas) - Number(sano.con_precio)
    : 0;

  const n654 = porProv.rows.find((r) => r.prov === 654)?.modelos ?? 0;
  const n638 = porProv.rows.find((r) => r.prov === 638)?.modelos ?? 0;

  const checks: AuditoriaCheck[] = [
    {
      id: "proto",
      label: "Protocolo Stock Sano activo",
      estado: protocoloActivo ? "PASS" : "FAIL",
      detalle: protocoloActivo
        ? "stock_sano_almacen.protocolo_activo = true"
        : "Activar en /bazzar-web/stock-sano",
      valor: protocoloActivo ? "ON" : "OFF",
    },
    {
      id: "ssd",
      label: "Filas stock_sano_deposito",
      estado: Number(ssd.rows[0]?.n ?? 0) > 0 ? "PASS" : "WARN",
      detalle: "Triplete L+R+Material con precio canónico",
      valor: ssd.rows[0]?.n ?? 0,
    },
    {
      id: "vendible",
      label: "Vendible tienda (SANO + precio>0 + stock>0)",
      estado: Number(v.filas) > 0 ? "PASS" : "FAIL",
      detalle: "Lo que ve bazzar-web/catalogo vía soloVendibleCatalogo",
      valor: `${v.modelos} modelos · ${v.pares} pares · ${v.filas} filas`,
    },
    {
      id: "sin-sano",
      label: "Stock >0 fuera de SANO",
      estado: sinSano === 0 ? "PASS" : "WARN",
      detalle: sinSano
        ? "Hay pares con stock que la tienda no vende — aplicar Stock Sano"
        : "Todo stock positivo está SANO",
      valor: sinSano,
    },
    {
      id: "sin-precio",
      label: "SANO sin precio_web",
      estado: sinPrecioEnSano === 0 ? "PASS" : "WARN",
      detalle: "Publicar en Motor precio WEB",
      valor: sinPrecioEnSano,
    },
    {
      id: "dual",
      label: "Mix proveedor 654 / 638",
      estado: "INFO",
      detalle: "Calzado vs confecciones Kyly en catálogo vendible",
      valor: `654=${n654} · 638=${n638}`,
    },
  ];

  return {
    ok: protocoloActivo && Number(v.filas) > 0,
    generado_en: new Date().toISOString(),
    almacen_id: alm,
    protocolo_activo: protocoloActivo,
    lista_precio_id: p?.lista_precio_id != null ? Number(p.lista_precio_id) : null,
    metricas: {
      modelos_sano: Number(v.modelos) || 0,
      filas_vendibles: Number(v.filas) || 0,
      pares_vendibles: Number(v.pares) || 0,
      filas_stock_positivo: filasStock,
      pares_stock_positivo: paresStock,
      sin_sano: sinSano,
      sin_precio: sinPrecioEnSano,
      calzado_654: n654,
      confecciones_638: n638,
      stock_sano_deposito_n: Number(ssd.rows[0]?.n ?? 0),
    },
    checks,
  };
}
