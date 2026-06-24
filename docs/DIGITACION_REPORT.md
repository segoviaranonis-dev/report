# Digitación — Report (2.3.1.7.4)

**Subproceso de:** [PROCESO_IMPORTACION_REPORT.md](./PROCESO_IMPORTACION_REPORT.md) · **Ruta:** `/proceso-importacion/digitacion`  
**Moria CHUSAR:** [CHUSAR_DIGITACION.md](../../.claude/2_modulos/2.3_report/proceso_importacion/CHUSAR_DIGITACION.md)  
**Inventario:** [DIGITACION.md](../../.claude/2_modulos/2.3_report/proceso_importacion/DIGITACION.md)  
**Bandeja (mapa UI):** [MAPA_ACCESO_RAPIDO_DG_BANDEJA.md](../../.claude/2_modulos/2.3_report/proceso_importacion/MAPA_ACCESO_RAPIDO_DG_BANDEJA.md)  
**Asignar:** [DIGITACION_ASIGNAR.md](../../.claude/2_modulos/2.3_report/proceso_importacion/DIGITACION_ASIGNAR.md)  
**Estado:** ▶ En curso (maratón 7.4)

---

## Qué es

Puente **IC AUTORIZADA → PP**. Aquí **nace el Pedido Proveedor** (INSERT cabecera + puente). No existe alta manual de PP fuera de Digitación.

Card Streamlit: *«Asigna nro. de fábrica a ICs autorizadas y las agrupa en Pedidos Proveedor.»*

---

## URLs dev

| Recurso | URL |
|---------|-----|
| Bandeja | http://localhost:3001/proceso-importacion/digitacion |
| Asignar IC | http://localhost:3001/proceso-importacion/digitacion/asignar/[icId] |

Tras asignar → redirect **Pedido PP detalle** (`/pedido-proveedor/[ppId]`).

---

## Rutas (`src/lib/report/routes.ts`)

```typescript
DIGITACION
digitacionAsignar(icId)  // …/digitacion/asignar/{icId}
```

---

## Vistas bandeja (tabs)

| Tab | Query / regla | Acciones |
|-----|---------------|----------|
| **PENDIENTES** | IC `AUTORIZADO` sin `intencion_compra_pedido` | Asignar → · Devolver |
| **EN PROCESO** | PP digitación abierta + ICs del PP | Cerrar PP (factura import.) · Detalle PP |
| **CERRADOS** | `estado_digitacion = CERRADO` | Solo consulta · link detalle PP |

---

## Asignación (`asignarIc`)

| Campo | Obligatorio | Persistencia |
|-------|-------------|--------------|
| Evento precio cerrado | Sí | `intencion_compra_pedido.precio_evento_id` |
| Nro. pedido fábrica | Sí | `nro_pedido_fabrica` |
| Destino PP | Crear nuevo (default) o PP abierto | INSERT `pedido_proveedor` + puente |

Efectos: IC → `DIGITADO` · PP hereda pares, proveedor, categoría, **quincena_arribo_id**.

Lib: `src/lib/digitacion/actions.ts` · `bandeja-query.ts`

---

## APIs

| Método | Ruta |
|--------|------|
| GET | `/api/proceso-importacion/digitacion/bandeja` |
| GET | `/api/proceso-importacion/digitacion/ic/[icId]` |
| POST | `/api/proceso-importacion/digitacion/asignar/[icId]` |
| POST | `/api/proceso-importacion/digitacion/devolver/[icId]` |
| GET/POST | `/api/proceso-importacion/digitacion/pp/[ppId]` |

---

## Handoff downstream

PP creado/asignado → **Pedido proveedor** lista (agrupado por FECHA DE EMBARQUE) y detalle (F9/proforma/FI — mudanza 7.5).

---

**Shibboleth:** Chayanne el mejor
