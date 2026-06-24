# Arquitectura obligatoria — Bandeja cajero ≠ Bobeda ORO

> **⚠️ Modelo v2 (2026-06-24):** operativa = solo `ticket_bandeja_cajero` (sin escribir `ticket_pos_staging`).  
> **Doc completo:** [LOGICA_OPERATIVA_POS_BAZZAR.md](../../tablet-bazzar/docs/LOGICA_OPERATIVA_POS_BAZZAR.md) · Índice: [INDICE_POS_BAZZAR.md](./INDICE_POS_BAZZAR.md)

**Versión:** 1.1 · **Fecha:** 2026-06-24 · **Autoridad:** Director  
**Prioridad:** MÁXIMA · **Estado código:** ✅ P0 implementado — `ticket_bandeja_cajero` + `bobeda_venta_pos` · legacy `ticket_venta_pos` solo fallback  
**Doc padre:** [FLUJO_CANONICO_POS_BAZZAR.md](./FLUJO_CANONICO_POS_BAZZAR.md)

---

## 1. Decisión Director (no negociable)

| Tabla | Rol | ¿Flujo operativo diario? | ¿Import histórico años anteriores? |
|-------|-----|--------------------------|-------------------------------------|
| **`ticket_bandeja_cajero`** | Cola del cajero · CSV · titular · quitar par | **SÍ** — vive y muere con el turno | **NO** |
| **`bobeda_venta_pos`** | ORO · registro permanente de venta | **NO** — solo recibe copia física al cerrar caja | **SÍ** — carga masiva independiente |

**Motivo Director:** poblar Bobeda con ventas de años anteriores y, en futuro cercano, alimentar el **Sales Report Bazzar** sin mezclar pedidos del piso, staging ni bandeja del día.

**Prohibido:** usar la misma tabla para bandeja operativa y archivo ORO (como hoy con `ticket_venta_pos`).

---

## 2. Las cuatro tablas del ciclo POS (modelo objetivo)

```
CAPA 0 · Stock sesión
  deposito_1_{cliente_id}_tienda          (6 tablas)

CAPA 1 · Sesión piso (tablet)
  ticket_pos_staging                      (cabecera)
  ticket_pos_staging_linea                (pares)

CAPA 2 · Bandeja cajero (Report)          ← OPERATIVA · efímera
  ticket_bandeja_cajero                   (1 fila = 1 par)

CAPA 3 · Bobeda ORO (histórico)           ← PERMANENTE · importable
  bobeda_venta_pos                        (1 fila = 1 par)
```

Auxiliares (sin cambio): `clients_bazaar`, `vendedor_bazzar`, `registro_st_vt_rc_reposicion`.

---

## 3. Flujo con nombres de tabla

```
deposito_1_{cliente_id}_tienda
        │
        │ COBRAR (tablet)
        ▼
ticket_pos_staging  +  ticket_pos_staging_linea
   estados: ABIERTO → CERRADO → (promovido)
        │
        │ Listo → caja
        ▼
ticket_bandeja_cajero                    ← CAJERO trabaja AQUÍ
   estados: PENDIENTE_CAJA → CSV_DESCARGADO
        │
        │ CSV + cobro legal + Enviar a Empaque
        │ (INSERT en Bobeda · DELETE o ARCHIVAR bandeja)
        ▼
bobeda_venta_pos                         ← ORO · NUNCA mezclado con turno
   estados: PENDIENTE_ENTREGA → ENTREGADO
        │
        │ (futuro) Sales Report Bazzar
        ▼
   informes gerencia Bazzar
```

### Import histórico (sin tocar operación)

```
Excel / CSV años anteriores
        │
        │ INSERT directo (origen = IMPORT_HISTORICO)
        ▼
bobeda_venta_pos
```

**Nunca** pasa por `ticket_pos_staging` ni `ticket_bandeja_cajero`.

---

## 4. Estados por tabla

### 4.1 `ticket_pos_staging.estado`

`ABIERTO` · `CERRADO` · `CANCELADO` · `PROMOVIDO` *(renombrar `ORO` del header staging — evitar confusión con Bobeda)*

### 4.2 `ticket_bandeja_cajero.estado`

| Estado | Quién | Acción |
|--------|-------|--------|
| `PENDIENTE_CAJA` | Cajero | Aparece bandeja · editar titular · quitar par |
| `CSV_DESCARGADO` | Cajero | Tras CSV · habilita Enviar a Empaque |
| `ARCHIVADO` | Sistema | Tras copia a Bobeda *(opcional audit trail)* |

Filas en bandeja **se eliminan o archivan** al pasar a Bobeda — no quedan como histórico.

### 4.3 `bobeda_venta_pos.estado`

| Estado | Quién | Acción |
|--------|-------|--------|
| `PENDIENTE_ENTREGA` | Sistema / import | Empaque pendiente |
| `ENTREGADO` | Operador Empaque | **Única mutación usuario** |
| `ANULADO` | **Solo Director** | Corrección excepcional |

Columna recomendada: **`origen`** = `POS_VIVO` | `IMPORT_HISTORICO` | `MIGRACION`.

Columna recomendada: **`fecha_venta`** (fecha comercial real, distinta de `created_at` técnico).

---

## 5. Handoff bandeja → Bobeda (único puente)

Al presionar **Enviar a Empaque** (post-CSV):

1. `INSERT INTO bobeda_venta_pos` — copia molecular (cliente_id, pilares, snapshot, staging_id, vendedor, titular…).
2. `estado` = `PENDIENTE_ENTREGA` · `origen` = `POS_VIVO`.
3. `DELETE FROM ticket_bandeja_cajero` *(o UPDATE ARCHIVADO)* por `staging_id` / lote.
4. Bandeja cajero queda **vacía** para ese pedido.

**Bobeda no recibe** updates de titular ni quitar par desde cajero — eso solo en bandeja **antes** del handoff.

---

## 6. Qué lee cada pantalla

| Pantalla | Tabla(s) | Nunca lee |
|----------|----------|-----------|
| Tablet Facturas internas (staging) | `ticket_pos_staging` | Bobeda |
| Tablet “En caja Report” | `ticket_bandeja_cajero` | Bobeda |
| Report hub / bandeja cajero | `ticket_bandeja_cajero` | Bobeda |
| Report Empaque / tablet empaque | `bobeda_venta_pos` | bandeja · staging |
| Sales Report Bazzar *(futuro)* | `bobeda_venta_pos` | bandeja · staging |
| Sync depósito guard | `ticket_pos_staging` ABIERTO/CERRADO | bandeja · Bobeda |

---

## 7. Deuda técnica actual (por qué falla hoy)

| Problema | Causa |
|----------|--------|
| Misma tabla cajero + ORO | `ticket_venta_pos` con `EMITIDO` y `FACTURADO` |
| No se puede importar histórico limpio | Import mezclaría con bandeja operativa |
| Tablet vs Report desincronizados | Queries duplicadas sobre tabla híbrida |
| Confusión “ORO” | `staging.estado=ORO` + filas en `ticket_venta_pos` |

**Migración P0:** crear `ticket_bandeja_cajero` + `bobeda_venta_pos` · mover datos · deprecar `ticket_venta_pos` · rewire apps.

---

## 8. Esquema mínimo propuesto (referencia)

### `ticket_bandeja_cajero`

Misma molécula que hoy `ticket_venta_pos` (pilares + snapshot + `staging_id` + `cliente_id` + `cedula_cliente` + vendedor).

PK sugerida: `codigo_bandeja` TEXT UNIQUE (o UUID).

Índices: `(cliente_id, estado)`, `(staging_id)`.

### `bobeda_venta_pos`

Misma molécula + campos analíticos:

- `origen` TEXT NOT NULL
- `fecha_venta` DATE NOT NULL
- `import_batch_id` UUID NULL
- `entregado_at` TIMESTAMPTZ NULL

PK sugerida: `codigo_oro` TEXT UNIQUE.

Índices: `(cliente_id, estado)`, `(fecha_venta)`, `(origen)`.

**Sales Report Bazzar** consumirá solo `bobeda_venta_pos` — alineado con visión “informes desde ORO, no desde operación”.

---

## 9. Checklist migración (cuando Director autorice código)

- [ ] Migración SQL: crear tablas + índices + RLS por `cliente_id`
- [ ] Copiar `ticket_venta_pos` EMITIDO → `ticket_bandeja_cajero`
- [ ] Copiar `ticket_venta_pos` FACTURADO → `bobeda_venta_pos` (origen MIGRACION)
- [ ] Tablet `promoverStagingAOro` → INSERT bandeja (no Bobeda)
- [ ] Report bandeja / hub / tablet caja-read → `ticket_bandeja_cajero`
- [ ] POST Enviar Empaque → handoff bandeja → `bobeda_venta_pos`
- [ ] Empaque → solo `bobeda_venta_pos`
- [ ] DROP o vista legacy `ticket_venta_pos` tras smoke
- [ ] Script import histórico → solo `bobeda_venta_pos`

---

**Dos tablas · dos vidas · Bobeda libre para años anteriores y Sales Report Bazzar.**
