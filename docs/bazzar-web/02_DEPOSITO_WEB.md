# Módulo Depósito Web — BAZZAR WEB

## Propósito

Consultar y auditar el **stock real** en almacén web **ALM_WEB_01** — motor de la galería de la tienda pública (5 pilares + talla).

## Origen Streamlit

| Campo | Valor |
|-------|--------|
| Paquete | `control_central/modules/deposito_web/` |
| UI | `ui.py` → `render_deposito_web()` |
| Logic | `logic.py` → `get_stock_web`, `get_resumen_web` |
| Registry key | `deposito_web` (order 9) |
| Roles | ADMIN, ROOT |

## Flujo

1. Resumen por marca: artículos y pares totales.
2. Detalle expandible por marca con línea, referencia, material, color, stock.
3. Detalle por talla vía `get_stock_web()`.

## Fuente de datos (Streamlit = Report)

Movimientos **`INGRESO_COMPRA`** confirmados en **ALM_WEB_01**, join `traspaso` → marca en `snapshot_json`.  
Queries: `get_resumen_web`, `get_stock_web`.

## Vista relacionada (catálogo tienda)

`v_stock_web` — stock **neto** (INGRESO_COMPRA − VENTA_WEB). Distinto del panel Depósito Web.

## Implementación Report

Ver **[ETAPA_DEPOSITO_WEB_002_CLON_REPORT.md](./ETAPA_DEPOSITO_WEB_002_CLON_REPORT.md)** — `/bazzar-web/deposito-web`

## Criterios de aceptación migración

- [x] Métricas resumen = Streamlit (mismos totales)
- [x] Acordeón por marca + desglose talla
- [ ] Enlace cruzado a ficha en catálogo bazzar-web (futuro)
- [x] UI NIIF institucional