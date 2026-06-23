# Report — Monitoreo tickets POS Tablet

**Código:** `2.3.2.2`  
**Ruta:** `/tablet-bazzar`  
**Etapa:** `.claude/4_etapas/ETAPA_TABLET_TICKETS_POS_STOCK_REPORT.md`  
**CHUSAR:** `.claude/2_modulos/2.3_report/tickets_pos/CHUSAR_MONITOREO_TICKETS_POS.md`  
**Local:** http://localhost:3001/tablet-bazzar  
**Prod:** https://rimec-report.vercel.app/tablet-bazzar

---

## Propósito

Dashboard gerencial: ver tickets emitidos desde **Tablet Bazzar** y estado de depósitos tienda. Report **no ejecuta ventas** — solo lectura y sync admin.

---

## División de roles

| Producto | Qué hace |
|----------|----------|
| **tablet-bazzar** | POS · carrito · COBRAR · decremento stock |
| **report** | Sync Retail → depósitos · listado tickets · KPIs |

---

## Rutas Report relacionadas

| Ruta | Código | Función |
|------|--------|---------|
| `/tablet-bazzar` | 2.3.2.2 | Monitoreo tickets + enlace POS |
| `/depositos-bazzar` | 2.3.2.1 | Admin sync 6 depósitos tienda |
| `/depositos-bazzar/[cliente_id]` | 2.3.2.1 | Detalle artículos por tienda |
| `/retail` | 2.3.2.0 | Origen Excel staging (upstream) |

---

## Datos

### `ticket_venta_pos`

Escrita **solo** desde Tablet `POST /api/tickets/confirm`.

Campos clave para UI: `codigo_ticket`, `cliente_id`, `marca`, `vendedor_nombre`, `grada`, `estado`, `created_at`, `snapshot_json`.

### Depósitos tienda

API existente: `GET /api/depositos/sync` — devuelve por tienda:

- `registros` — COUNT filas
- `pares` — SUM(cantidad) · **métrica primaria**

---

## Estado implementación (2026-06-22)

| Pieza | Estado |
|-------|--------|
| Página `/tablet-bazzar` shell | ✅ |
| Listado depósitos con stock | ✅ |
| API `GET /api/tickets/pos` | ⏳ |
| Tabla tickets en UI | ⏳ |
| Filtros tienda / fecha | ⏳ |

Archivo actual: `src/app/tablet-bazzar/page.tsx`

---

## API planificada — `GET /api/tickets/pos`

Autenticación sesión Report. Query: `cliente_id`, `desde`, `hasta`, `vendedor_id`, paginación.

Respuesta: array tickets + `total` + agregado `pares_hoy`.

Implementación sugerida: `src/app/api/tickets/pos/route.ts` + query parametrizada sobre `ticket_venta_pos`.

---

## UI planificada

1. Sección **Tickets hoy** — tabla con refresh manual o poll 30 s.
2. Columnas: hora · tienda · código ticket · L.R · grada · vendedor · estado.
3. Totales header: pares vendidos hoy por tienda seleccionada.
4. Mantener bloque enlace POS + cards depósitos (pares + registros).

---

## Roles

- RIMEC DIOS / ADMIN: acceso completo acordeón Bazzar.
- RIMEC VENDEDOR: sin acceso.
- BAZZAR ADMIN: acordeón Bazzar según matriz.

Ver `.claude/1_fundamentos/1.3_politicas/MATRIZ_ROLES_ACCESOS_HOLDING.md`

---

## Smoke test (post-implementación)

1. Tablet COBRAR 1 par en cliente_id 2100.
2. Report `/tablet-bazzar` → ticket visible.
3. `/depositos-bazzar` → pares Fernando Adultos −1.

---

## Fuera de alcance

- `registro_ventas_general_v2` (Sales Report blindado).
- Escritura tickets desde Report.
- Facturación legal / CSV export (fase posterior).

---

## Referencias

- Tablet doc: `tablet-bazzar/docs/ETAPA_TICKETS_POS_STOCK.md`
- Admin depósitos: [DEPOSITOS_BAZZAR_ADMIN.md](./DEPOSITOS_BAZZAR_ADMIN.md)
- Evidencia apertura: `tablet-bazzar/docs/evidencia/ETAPA_TICKETS_POS_APERTURA_20260622.json`

---

**Doc Report — apertura etapa 2026-06-22**
