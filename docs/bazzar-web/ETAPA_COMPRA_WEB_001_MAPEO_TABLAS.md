# ETAPA COMPRA-WEB-001 — Mapeo de tablas

**Objetivo:** migrar `modules/compra_web` (Streamlit) → Report `/bazzar-web/compra`  
**Paso 1:** inventario de tablas con interacción directa o en cadena de lectura/escritura  
**Fuente código:** `control_central/modules/compra_web/ui.py` + `compra_legal/logic.py` + `facturacion/logic.py` + `pedido_proveedor/logic.py`  
**Fecha:** 2026-06-10

---

## Flujo operativo (contexto)

```
Facturación RIMEC — "🚀 ENVIAR A WEB BAZAR"
        ↓  traspaso.estado: BORRADOR → ENVIADO
COMPRA WEB (este módulo) — lista + detalle + "📥 CONFIRMAR RECEPCIÓN"
        ↓  procesar_ingreso_bazar()
movimiento INGRESO_COMPRA (ALM_TRANSITO_01 → ALM_WEB_01)
        ↓
traspaso.estado = CONFIRMADO
        ↓
v_stock_web / Depósito Web / catálogo bazzar-web
```

**Almacenes hardcodeados en lógica** (`compra_legal/logic.py`):

| Constante | id | Nombre convención |
|-----------|----|-------------------|
| `ALM_WEB_BAZAR` | 1 | ALM_WEB_01 |
| `ALM_TRANSITO` | 3 | ALM_TRANSITO_01 |

Filtro lista Compra Web:

1. `traspaso.almacen_destino_id = 1` (ALM_WEB_01)
2. **Cliente web 5000** — `factura_interna.cliente_id = 5000` OR `venta_transito.codigo_cliente = '5000'` (ETAPA-003)

Ver **[ETAPA_COMPRA_WEB_003_CLIENTE_5000.md](./ETAPA_COMPRA_WEB_003_CLIENTE_5000.md)** — causa del exceso de facturas en panel.

---

## Funciones Python usadas por Compra Web

| Función | Archivo | Rol |
|---------|---------|-----|
| `get_traspasos` | `compra_legal/logic.py` | Lista cards (filtro estado) |
| `get_traspaso_detail` | idem | Cabecera detalle |
| `get_traspaso_detalle_lines` | idem | Vista técnica 5 pilares + talla |
| `procesar_ingreso_bazar` | idem | **Única escritura** del módulo |
| `get_fi_registro_por_numero` | `facturacion/logic.py` | Card FI en detalle |
| `get_fi_detalles_canonico` | `pedido_proveedor/logic.py` | Líneas FI (snapshot) |
| `get_factura_lineas` | `facturacion/logic.py` | Fallback legacy 5 pilares |

---

## Tablas — escritura (Compra Web)

Solo **`procesar_ingreso_bazar(id_trp)`** muta datos.

| Tabla | Operación | Campos / regla |
|-------|-----------|----------------|
| **`traspaso`** | SELECT `FOR UPDATE` + UPDATE | Valida `estado IN ('ENVIADO','BORRADOR')` → `CONFIRMADO`, `confirmado_en = NOW()` |
| **`movimiento`** | INSERT | `tipo='INGRESO_COMPRA'`, `almacen_origen_id=3`, `almacen_destino_id=1`, `documento_ref=numero_registro` traspaso, `estado='CONFIRMADO'` |
| **`movimiento_detalle`** | INSERT (N filas) | Desde `traspaso_detalle`: `combinacion_id`, `cantidad`, `signo=1` |

**Precondición crítica:** debe existir al menos una fila en `traspaso_detalle` con `combinacion_id` resuelto. Si solo hay `snapshot_json` sin detalle, el ingreso crea movimiento vacío (0 líneas).

---

## Tablas — lectura directa (UI Compra Web)

### Núcleo traspaso

| Tabla | Función | Uso |
|-------|---------|-----|
| **`traspaso`** | `get_traspasos`, `get_traspaso_detail`, detalle lines | id, numero_registro, fecha, estado, documento_ref, snapshot_json, almacen_destino_id, compra_legal_id |
| **`traspaso_detalle`** | `get_traspasos` (SUM), `get_traspaso_detalle_lines`, `procesar_ingreso_bazar` | pares por combinacion_id |
| **`compra_legal`** | `get_traspasos`, `get_traspaso_detail` | LEFT JOIN → `numero_registro` mostrado como "Compra: CL-…" |

### Pilares (vía `traspaso_detalle` → `combinacion`)

| Tabla | Función |
|-------|---------|
| **`combinacion`** | Resolución SKU web (5 FK) |
| **`linea`** | codigo_proveedor, descripcion |
| **`referencia`** | codigo_proveedor |
| **`material`** | descripcion |
| **`color`** | nombre |
| **`talla`** | talla_etiqueta |

### Factura interna (detalle visual)

| Tabla | Función | Uso |
|-------|---------|-----|
| **`factura_interna`** | `get_fi_registro_por_numero`, joins en detalle lines | Cabecera FI por `documento_ref` |
| **`factura_interna_detalle`** | `get_fi_detalles_canonico` | Items + `linea_snapshot` JSON |
| **`pedido_proveedor`** | FI header + joins | nro PP, enlace IC |
| **`pedido_proveedor_detalle`** | `get_factura_lineas` (legacy UNION) | 5 pilares + grada |
| **`venta_transito`** | `get_factura_lineas` (legacy) | Tallas t33–t40 por FAC legacy |
| **`cliente_v2`** | `get_fi_registro_por_numero` | Nombre cliente FI |
| **`usuario_v2`** | `get_fi_registro_por_numero` | Vendedor FI |

### Precio / caso (solo display opcional)

| Tabla | Función |
|-------|---------|
| **`intencion_compra_pedido`** | Enlace PP → evento precios |
| **`precio_lista`** | `nombre_caso_aplicado` en vista técnica |

### Fallback snapshot (sin tablas extra)

| Campo | Función |
|-------|---------|
| **`traspaso.snapshot_json`** | Si `traspaso_detalle` vacío → expande `items[].tallas` en memoria (no escribe BD) |

---

## Tablas — cadena upstream (no las toca Compra Web, alimentan traspasos)

Documentar para no romper el flujo al migrar.

| Tabla | Quién escribe | Cuándo |
|-------|---------------|--------|
| **`traspaso`** | `crear_traspaso_por_factura`, `enviar_compra_a_web`, `enviar_factura_a_bazar` | Alta BORRADOR; pasa a ENVIADO desde Facturación / Compra Legal |
| **`traspaso_detalle`** | `crear_traspaso_por_factura` | Resuelve `combinacion_id` por línea/talla |
| **`combinacion`** | `_resolve_combinacion_id` | INSERT si no existe al crear traspaso |
| **`compra_legal`** | Compra Legal module | Consolidador CL-YYYY-NNNN |
| **`compra_legal_pedido`** | Compra Legal | PP ↔ CL |
| **`pedido_proveedor`** | Flujo IC/PP | Estado ENVIADO/DISTRIBUIDA |
| **`factura_interna`** / **`factura_interna_detalle`** | Facturación | Origen FAC-INT |
| **`venta_transito`** | Legacy facturación | Origen tallas legacy |

---

## Vistas / efectos downstream (post-confirmación)

| Vista / artefacto | Efecto |
|-------------------|--------|
| **`v_stock_web`** | Stock catálogo bazzar-web (`INGRESO_COMPRA` − `VENTA_WEB` en ALM_WEB_01) |
| **`v_stock_actual`** | Mencionada en comentario de `procesar_ingreso_bazar` |
| **`pedido_web` / reservas** | No interactúa Compra Web; consume stock ya ingresado |

---

## Estados `traspaso` en UI Streamlit

| BD | Label UI | Acción Compra Web |
|----|----------|-------------------|
| `BORRADOR` | En Tránsito | Puede confirmar recepción (*) |
| `ENVIADO` | Listo p/ Recibir | Puede confirmar recepción |
| `CONFIRMADO` | Recibido | Solo lectura |

(*) `procesar_ingreso_bazar` acepta BORRADOR y ENVIADO — alinear UX Report con política deseada (recomendado: solo ENVIADO).

---

## Matriz resumen para migración Report

| Prioridad | Tablas | Acción en Report |
|-----------|--------|------------------|
| **P0** | `traspaso`, `traspaso_detalle`, `movimiento`, `movimiento_detalle` | API + transacción idéntica a `procesar_ingreso_bazar` |
| **P1** | `compra_legal`, pilares (`combinacion` + 5 tablas) | Lista + detalle técnico |
| **P2** | `factura_interna`, `factura_interna_detalle`, `pedido_proveedor` | Card FI (read-only) |
| **P3** | `cliente_v2`, `usuario_v2`, `intencion_compra_pedido`, `precio_lista` | Enriquecimiento display |
| **P3 legacy** | `venta_transito`, `pedido_proveedor_detalle` | Fallback FAC antigua |
| **Fuera scope** | `compra_legal_pedido`, escritura upstream | Permanece en Streamlit Facturación / Compra Legal hasta OT posterior |

---

## Riesgos detectados para la migración

1. **Traspasos sin `traspaso_detalle`:** confirmación crea movimiento con 0 líneas → stock no sube.
2. **IDs almacén fijos (1 y 3):** Report debe usar mismas constantes o lookup por `almacen.nombre`.
3. **UI muestra BORRADOR como "En Tránsito"** pero filtro default sidebar es ENVIADO; lista "TODOS" mezcla estados (como captura actual).
4. **Sales Report blindado:** ninguna tabla `registro_ventas_general_v2` — OK, no aparece en este módulo.

---

## Próximo paso (ETAPA COMPRA-WEB-002)

- [ ] API Report `/api/bazzar-web/compra` — list + detail + confirm (port `procesar_ingreso_bazar`)
- [ ] UI lista cards + detalle FI (paridad Streamlit)
- [ ] Smoke: TRP ENVIADO → CONFIRMADO → fila en `v_stock_web`
