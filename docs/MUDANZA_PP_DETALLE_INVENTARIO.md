# Mudanza PP detalle — Inventario Streamlit → Report

**PP referencia:** PP-2026-0014 · **Ruta Report:** `/proceso-importacion/pedido-proveedor/[ppId]?tab=stock`  
**Moria espejo:** `.claude/2_modulos/2.3_report/proceso_importacion/CHUSAR_PP_TAB_STOCK.md`  
**Actualizado:** 2026-07-03

---

## Leyenda paridad

| Símbolo | Significado |
|---------|-------------|
| ✅ | Implementado en Report |
| ⚠️ | Parcial |
| 🔴 | Pendiente |
| 🔒 | Bloqueado si PP `ENVIADO` |

---

## A · Strip superior (siempre visible)

| Componente | Campo BD / lógica | Report |
|----------|-------------------|--------|
| PP-YYYY-XXXX | `numero_registro` | ✅ |
| Proforma | `numero_proforma` | ✅ cabecera + stock §1 |
| Proveedor | `proveedor_importacion_id` | ✅ readonly |
| Estado | `estado` | ✅ badge |
| Categoría | `categoria_id` | ✅ COMPRA PREVIA / PROGRAMADO |
| Creador | `asignado_por` | ✅ |
| Quincena ETA | `quincena_arribo_id` | ✅ cabecera readonly + **stock §1 editable** |
| KPI chips | agregaciones | ✅ |
| ~~Fecha ETA date~~ | `fecha_arribo_estimada` | ❌ **no usar** — reemplazado por quincena |

---

## B · Pestaña ICs Asignadas

| Componente | Report |
|------------|--------|
| ICs editables completas | ✅ |
| Desasignar / cerrar digitación | ✅ |

---

## C · Pestaña Importación / Stock

### C0 · Router

| Condición | Report |
|-----------|--------|
| Sin stock | ✅ §1–2 + listado + placeholder upload |
| Con stock | ⚠️ tabla 8 cols |

### C2 · §1 Cabecera comercial

| Campo | Report |
|-------|--------|
| Nro Proforma | ✅ |
| Nro PP externo | ✅ |
| FECHA DE EMBARQUE (quincena 1–24) | ✅ |

### C3 · §2 Descuentos D1–D4

| Campo | Report |
|-------|--------|
| Inputs + factor FOB | ✅ |

### C4 · §3 Upload proforma

| Paso | Report |
|------|--------|
| Excel upload | 🔴 Fase 4 |

### C5 · Ala Norte

| Bloque | Report |
|--------|--------|
| Tabla básica | ⚠️ |
| Acordeón marca · grades_json | 🔴 Fase 2 |

### C6 · Precios stock

| Bloque | Report |
|--------|--------|
| Join PPD × precio_lista | 🔴 Fase 2 |

### C7 · Listado RIMEC

| Elemento | Report |
|----------|--------|
| Banner vigente | ✅ |
| Selector eventos | ✅ |
| Vincular al PP | ✅ |
| Recalc FI | 🔴 Fase 3 |

---

## D · Pestaña FI

| Bloque | Report |
|--------|--------|
| FI cards | 🔴 lista básica |
| Nueva FI | 🔴 |

---

## E · Fases

| Fase | Estado |
|------|--------|
| **1** Stock §1–2 + listado vincular | ✅ 2026-07-03 |
| **2** Ala Norte + precios stock | 🔴 |
| **3** Recalc FI · borrar · CSV | 🔴 |
| **4** Upload proforma | 🔴 |

---

## F · APIs

| Método | Ruta | Estado |
|--------|------|--------|
| GET/PATCH | `…/pedido-proveedor/[ppId]` | ✅ |
| PATCH | `…/ic/[icId]` | ✅ |
| POST | `…/vincular-listado` | ✅ |
| POST | `…/proforma` | 🔴 |
| GET | `…/precios-stock` | 🔴 |

---

## G · Tablas · SQL

`pedido_proveedor.quincena_arribo_id` · `vincular_listado_a_pp()` · migración `074_fn_vincular_listado_a_pp.sql`

Join listado: `precio_evento.biblioteca_precio_id`.

---

**Gap master:** [DOC_PENDIENTE_TABLET_REPORT_20260703.md](../../../.claude/2_modulos/DOC_PENDIENTE_TABLET_REPORT_20260703.md)
