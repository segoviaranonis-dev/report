# Módulo Compra — BAZZAR WEB

## Propósito

Recepcionar mercadería enviada desde **Facturación RIMEC** hacia el depósito web **ALM_WEB_01**. Es la estación 4 del ciclo de abastecimiento Bazar.

## Origen Streamlit

| Campo | Valor |
|-------|--------|
| Paquete | `control_central/modules/compra_web/` |
| UI | `ui.py` → `render_compra_web()` |
| Registry key | `compra_web` (order 8) |
| Roles | ADMIN, ROOT |

## Flujo

1. Lista traspasos en estado **ENVIADO** desde Facturación.
2. Operador revisa detalle (FI, líneas 5 pilares).
3. Acción **Confirmar recepción** → traspaso **CONFIRMADO** + movimiento `INGRESO_COMPRA` en ALM_WEB_01.
4. Stock pasa a visible en **Depósito Web** y eventualmente `v_stock_web`.

## Dependencias lógicas (Streamlit)

- `modules.compra_legal.logic` — traspasos, procesar ingreso bazar
- `modules.facturacion.logic` — FI y líneas
- `modules.pedido_proveedor.logic` — detalle canónico

## Ruta Report

`/bazzar-web/compra`

## Mapeo de tablas (ETAPA COMPRA-WEB-001)

Ver **[ETAPA_COMPRA_WEB_001_MAPEO_TABLAS.md](./ETAPA_COMPRA_WEB_001_MAPEO_TABLAS.md)** — inventario completo.

## Filtro cliente 5000 (ETAPA COMPRA-WEB-003)

Compra Web **solo** lista traspasos cuya FAC-INT es del cliente **5000** (`factura_interna.cliente_id` o legacy `venta_transito.codigo_cliente`). Ver **[ETAPA_COMPRA_WEB_003_CLIENTE_5000.md](./ETAPA_COMPRA_WEB_003_CLIENTE_5000.md)**.

**Escritura (solo confirmar recepción):** `traspaso`, `movimiento`, `movimiento_detalle`  
**Lectura núcleo:** `traspaso_detalle`, `compra_legal`, pilares vía `combinacion`  
**Lectura FI:** `factura_interna`, `factura_interna_detalle`, `pedido_proveedor` (+ legacy `venta_transito`)

## Criterios de aceptación migración

- [ ] Listar traspasos ENVIADO sin Streamlit
- [ ] Confirmar recepción idempotente (mismo resultado que Streamlit)
- [ ] Movimiento en ALM_WEB_01 trazable por `pedido_web` / traspaso
- [ ] UI NIIF: sin `yellow-*`, fondos `card-bg`, acento navy web `#1E3A5F`
