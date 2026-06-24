# Pedido proveedor — Report (2.3.1.7.5)

**Subproceso de:** [PROCESO_IMPORTACION_REPORT.md](./PROCESO_IMPORTACION_REPORT.md) · **Ruta:** `/proceso-importacion/pedido-proveedor`  
**Moria CHUSAR:** [CHUSAR_PEDIDO_PROVEEDOR.md](../../.claude/2_modulos/2.3_report/proceso_importacion/CHUSAR_PEDIDO_PROVEEDOR.md)  
**Inventario:** [PEDIDO_PROVEEDOR.md](../../.claude/2_modulos/2.3_report/proceso_importacion/PEDIDO_PROVEEDOR.md)  
**Lista · 5 botones:** [MAPA_ACCESO_RAPIDO_PP_LISTA.md](../../.claude/2_modulos/2.3_report/proceso_importacion/MAPA_ACCESO_RAPIDO_PP_LISTA.md)  
**Detalle · 3 pestañas:** [MAPA_ACCESO_RAPIDO_PP_DETALLE.md](../../.claude/2_modulos/2.3_report/proceso_importacion/MAPA_ACCESO_RAPIDO_PP_DETALLE.md)  
**Estado:** ▶ En curso (maratón 7.5)

---

## Regla de negocio

**El PP no se crea desde «Nuevo pedido».** Solo nace en **Digitación** al asignar una IC autorizada. La lista muestra preventas agrupadas por **FECHA DE EMBARQUE** (quincena · dato duro).

Formato: **`PP-YYYY-XXXX`**

---

## URLs dev

| Recurso | URL |
|---------|-----|
| Lista (acordeón quincena) | http://localhost:3001/proceso-importacion/pedido-proveedor |
| Detalle PP | http://localhost:3001/proceso-importacion/pedido-proveedor/[ppId] |
| Deep link pestaña | `…/[ppId]?tab=ics\|stock\|fi` *(mudanza UI)* |

`/pedido-proveedor/nuevo` → redirect **Digitación**.

---

## Rutas (`src/lib/report/routes.ts`)

```typescript
PEDIDO_PROVEEDOR
pedidoProveedorDetalle(ppId)
```

---

## Lista (paridad Streamlit `_render_lista_pp`)

| Elemento | Report |
|----------|--------|
| Agrupación | Acordeón por `quincena_arribo` / fallback IC |
| KPI grupo | N preventas · pares · % ejecutado |
| Fila PP | PP · marcas · cliente · ICs · pares/vendido |
| Acceso rápido | 5 botones — ver MAPA lista *(pendiente UI)* |

Lib: `src/lib/pedido-proveedor/list-query.ts` · `groupPedidosPorQuincena()`

---

## Detalle PP (3 hijos Streamlit)

| Pestaña | Key Streamlit | Contenido |
|---------|---------------|-----------|
| ICs asignadas | `hijo_adoptado` | Puente IC · desasignar |
| Importación / Stock | `hijo_mayor` | Proforma/F9 · Ala Norte · listado precios |
| Facturas internas | `hijo_menor` | FI · arribo · Compra Legal · CSV |

Lib detalle: `src/lib/pedido-proveedor/detail-query.ts`  
UI: `PedidoProveedorDetalleClient` *(cabecera + ICs + placeholders Ala N/S)*

---

## APIs

| Método | Ruta |
|--------|------|
| GET | `/api/proceso-importacion/pedido-proveedor/lista` |
| GET | `/api/proceso-importacion/pedido-proveedor/[ppId]` |
| POST | `/api/proceso-importacion/pedido-proveedor/[ppId]` | Cerrar digitación (factura import.) |

CSV ventas *(pendiente)*: spec `MAPA_CSV_VENTAS_PP.md` en Streamlit.

---

## Listado precios ↔ FI

Un `precio_evento_id` por PP (vía ICs). Reglas: `.cursor/rules/rimec-listado-pp-fi.mdc`  
PP `ENVIADO` → listado bloqueado (Compra Legal).

---

## Orden mudanza 7.5 (código)

1. ✅ Lista agrupada quincena + detalle cabecera/ICs + 5 botones  
2. ⚠️ Tab Stock — tabla plana (falta acordeón marca · grada · precios · motor)  
3. 🔴 Tab FI cards + CSV API  
4. 🔴 Upload proforma  

**Docs Stock:** [CHUSAR_PP_TAB_STOCK.md](../../.claude/2_modulos/2.3_report/proceso_importacion/CHUSAR_PP_TAB_STOCK.md)

---

**Shibboleth:** Chayanne el mejor
