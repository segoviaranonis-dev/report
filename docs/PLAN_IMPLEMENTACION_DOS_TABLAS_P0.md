# Plan de implementación P0 — Dos tablas: Bandeja cajero + Bobeda ORO

**ID:** `IMPL-DOS-TABLAS-P0-20260616`  
**Estado:** ✅ **P0 código implementado** (2026-06-16) · migración 005 · smoke manual pendiente Director  
**Autoridad:** Director · **Prioridad:** MÁXIMA  
**Arquitectura:** [ARQUITECTURA_DOS_TABLAS_CAJA_BOBINA.md](./ARQUITECTURA_DOS_TABLAS_CAJA_BOBINA.md)  
**Flujo:** [FLUJO_CANONICO_POS_BAZZAR.md](./FLUJO_CANONICO_POS_BAZZAR.md)

---

## 1. Objetivo

Separar **operación diaria de caja** de **ORO histórico importable** para:

1. Bandeja cajero efímera (`ticket_bandeja_cajero`) — turno, CSV, titular, quitar par.
2. Bobeda permanente (`bobeda_venta_pos`) — entrega, import años anteriores, futuro **Sales Report Bazzar**.
3. Deprecar uso híbrido de `ticket_venta_pos`.

---

## 2. Tablas BD — estado objetivo

| Tabla | Rol | Ciclo de vida |
|-------|-----|---------------|
| `deposito_1_{cliente_id}_tienda` | Stock sesión (×6) | Reemplazado al sync fin de día |
| `ticket_pos_staging` | Cabecera piso | ABIERTO→CERRADO→PROMOVIDO |
| `ticket_pos_staging_linea` | Pares piso | Con staging |
| **`ticket_bandeja_cajero`** | Cola cajero | DELETE/ARCHIVAR al handoff |
| **`bobeda_venta_pos`** | ORO histórico | Permanente |
| `clients_bazaar` | Cliente POS | Maestra |
| `vendedor_bazzar` | Vendedor PIN | Maestra |
| ~~`ticket_venta_pos`~~ | Legacy | Migrar → deprecar |

---

## 3. Migración SQL (orden)

**Archivo propuesto:** `control_central/migrations/121_pos_bandeja_bobeda_split.sql` (o `tablet-bazzar/supabase/migrations/005_*.sql`)

### 3.1 Crear `ticket_bandeja_cajero`

```sql
CREATE TABLE public.ticket_bandeja_cajero (
  codigo_bandeja     TEXT PRIMARY KEY,
  cliente_id         INT NOT NULL,
  staging_id         INT REFERENCES ticket_pos_staging(id),
  marca              TEXT NOT NULL,
  vendedor_bazzar_id INT,
  vendedor_nombre    TEXT,
  vendedor_id        INT,
  cedula_cliente     TEXT,
  clients_bazaar_id  INT,
  linea_id           INT NOT NULL,
  referencia_id      INT NOT NULL,
  material_id        INT NOT NULL,
  color_id           INT NOT NULL,
  grada              TEXT NOT NULL,
  cantidad           INT NOT NULL DEFAULT 1 CHECK (cantidad = 1),
  estado             TEXT NOT NULL DEFAULT 'PENDIENTE_CAJA',
  snapshot_json      JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  csv_descargado_at  TIMESTAMPTZ
);
CREATE INDEX idx_tbc_cliente_estado ON ticket_bandeja_cajero (cliente_id, estado);
CREATE INDEX idx_tbc_staging ON ticket_bandeja_cajero (staging_id);
```

Estados: `PENDIENTE_CAJA` · `CSV_DESCARGADO` · `ARCHIVADO`.

### 3.2 Crear `bobeda_venta_pos`

```sql
CREATE TABLE public.bobeda_venta_pos (
  codigo_oro         TEXT PRIMARY KEY,
  cliente_id         INT NOT NULL,
  staging_id         INT,
  bandeja_codigo     TEXT,
  marca              TEXT NOT NULL,
  vendedor_bazzar_id INT,
  vendedor_nombre    TEXT,
  cedula_cliente     TEXT,
  clients_bazaar_id  INT,
  linea_id           INT NOT NULL,
  referencia_id      INT NOT NULL,
  material_id        INT NOT NULL,
  color_id           INT NOT NULL,
  grada              TEXT NOT NULL,
  cantidad           INT NOT NULL DEFAULT 1 CHECK (cantidad = 1),
  estado             TEXT NOT NULL DEFAULT 'PENDIENTE_ENTREGA',
  origen             TEXT NOT NULL DEFAULT 'POS_VIVO',
  fecha_venta        DATE NOT NULL,
  snapshot_json      JSONB,
  import_batch_id    UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  entregado_at       TIMESTAMPTZ
);
CREATE INDEX idx_bvp_cliente_estado ON bobeda_venta_pos (cliente_id, estado);
CREATE INDEX idx_bvp_fecha ON bobeda_venta_pos (cliente_id, fecha_venta);
CREATE INDEX idx_bvp_origen ON bobeda_venta_pos (origen);
```

Estados: `PENDIENTE_ENTREGA` · `ENTREGADO` · `ANULADO` (solo Director).  
Origen: `POS_VIVO` · `IMPORT_HISTORICO` · `MIGRACION`.

### 3.3 Migrar datos legacy

```sql
-- EMITIDO → bandeja
INSERT INTO ticket_bandeja_cajero (...)
SELECT ... FROM ticket_venta_pos WHERE upper(estado) = 'EMITIDO';

-- FACTURADO → bobeda (origen MIGRACION)
INSERT INTO bobeda_venta_pos (...)
SELECT ..., 'MIGRACION', created_at::date
FROM ticket_venta_pos WHERE upper(estado) = 'FACTURADO';
```

### 3.4 Renombrar staging `ORO` → `PROMOVIDO` (opcional misma migración)

Evita confusión con Bobeda ORO.

### 3.5 Vista compatibilidad temporal (opcional)

`CREATE VIEW ticket_venta_pos_legacy AS ...` — solo si rollback necesario 1 semana.

---

## 4. Handoff bandeja → Bobeda (función canónica)

**Ubicación propuesta:** `report/src/lib/caja-bazzar/handoff-bobeda.ts`  
**Tablet:** importar vía copia duplicada mínima o paquete `@nexus/pos-bazzar-core` futuro.

```typescript
// enviarStagingABobeda(clienteId, stagingId | codigos[])
// 1. BEGIN
// 2. SELECT * FROM ticket_bandeja_cajero WHERE ... AND estado IN ('PENDIENTE_CAJA','CSV_DESCARGADO')
// 3. INSERT bobeda_venta_pos (origen POS_VIVO, estado PENDIENTE_ENTREGA, fecha_venta = today local)
// 4. DELETE FROM ticket_bandeja_cajero WHERE staging_id = ...
// 5. COMMIT
```

**API:** `POST /api/tablet-bazzar/tickets/enviar-empaque` (Report) — reemplaza POST `facturar` semántica incorrecta.

---

## 5. Cambios por repo

### 5.1 Tablet (`tablet-bazzar`)

| Archivo | Cambio |
|---------|--------|
| `lib/server/tickets-staging.ts` → `promoverStagingAOro` | INSERT **`ticket_bandeja_cajero`** (no `ticket_venta_pos`) |
| `lib/server/tickets-caja-read.ts` | SELECT **`ticket_bandeja_cajero`** · sin filtro hoy |
| `lib/server/tickets-staging.ts` → `reabrirStagingDesdeCaja` | DELETE **`ticket_bandeja_cajero`** EMITIDO equivalente |
| `components/pos/StagingTicketsPanel.tsx` | Sin cambio UX · API caja lee bandeja |
| `docs/ARQUITECTURA_SESION_STOCK_ORO.md` | Actualizado ✅ |

### 5.2 Report (`report`)

| Archivo | Cambio |
|---------|--------|
| `src/lib/caja-bazzar/tickets-db.ts` | Queries bandeja → `ticket_bandeja_cajero` |
| `src/lib/caja-bazzar/tickets-edit.ts` | UPDATE/DELETE bandeja only |
| `src/lib/caja-bazzar/handoff-bobeda.ts` | **Nuevo** — Enviar a Empaque |
| `src/app/api/tablet-bazzar/tickets/route.ts` | Bandeja table |
| `src/app/api/tablet-bazzar/tickets/csv/route.ts` | Bandeja · marca `CSV_DESCARGADO` |
| `src/app/api/tablet-bazzar/tickets/facturar/route.ts` | **Deprecar** → redirect enviar-empaque |
| `src/app/api/tablet-bazzar/tickets/enviar-empaque/route.ts` | **Nuevo** |
| `src/components/caja-bazzar/TicketsPanel.tsx` | Botón Enviar a Empaque · estados canónicos |
| Card B facturable | Lee **`bobeda_venta_pos`** archivado |

### 5.3 Empaque (nuevo tramo)

| Pieza | Tabla |
|-------|-------|
| `tablet-bazzar/app/empaque/` | UI |
| `GET /api/empaque/tickets` | `bobeda_venta_pos` PENDIENTE_ENTREGA |
| `POST /api/empaque/entregar` | UPDATE estado ENTREGADO |

### 5.4 Import histórico (Director)

| Pieza | Tabla |
|-------|-------|
| Script `scripts/import-bobeda-historico.ts` | INSERT `bobeda_venta_pos` origen IMPORT_HISTORICO |
| Sin tocar staging ni bandeja | — |

---

## 6. Funcionamiento post-implementación (operador)

### Vendedor (tablet)

1. COBRAR → `ticket_pos_staging` ABIERTO + stock −  
2. Listo→caja → staging PROMOVIDO + filas en **`ticket_bandeja_cajero`**  
3. Panel “En caja Report” lee bandeja (solo lectura)

### Cajero (Report)

1. Bandeja lista **`ticket_bandeja_cajero`** PENDIENTE_CAJA (sin filtro día)  
2. Edita titular / quita par → solo bandeja  
3. CSV → `CSV_DESCARGADO`  
4. **Enviar a Empaque** → copia a **`bobeda_venta_pos`** · vacía bandeja

### Empaque (tablet)

1. Lee **`bobeda_venta_pos`** PENDIENTE_ENTREGA  
2. QC → **ENTREGADO** (única mutación usuario en ORO)

### Director

- Import histórico → directo **`bobeda_venta_pos`**  
- ANULADO / correcciones ORO  
- Futuro Sales Report Bazzar → SELECT solo **`bobeda_venta_pos`**

---

## 7. Reglas de robustez (checks en código)

| # | Regla | Implementación |
|---|-------|----------------|
| R1 | Aislamiento tienda | `WHERE cliente_id = $1` en toda query |
| R2 | Bandeja sin filtro día | Pendiente caja = all open rows |
| R3 | Bobeda inmutable post-handoff | Trigger o middleware rechaza UPDATE salvo ENTREGADO |
| R4 | Una query bandeja compartida | Misma función Report + Tablet |
| R5 | Handoff atómico | Transaction INSERT bobeda + DELETE bandeja |
| R6 | Import histórico aislado | `origen = IMPORT_HISTORICO` · no FK staging obligatoria |
| R7 | Sales Report blindado | Cero JOIN a `registro_ventas_general_v2` |

---

## 8. Orden de ejecución código (sprints)

| Sprint | Entregable | Smoke |
|--------|------------|-------|
| **S1** | Migración SQL + backfill | Conteos bandeja/bobeda = legacy |
| **S2** | Tablet promover → bandeja | Listo→caja crea bandeja |
| **S3** | Report bandeja + hub + CSV | POS-FI-n visible |
| **S4** | Handoff Enviar a Empaque | Bandeja vacía · bobeda PENDIENTE_ENTREGA |
| **S5** | Tablet caja-read paridad | Panel “En caja Report” OK |
| **S6** | Empaque ENTREGADO | Ciclo cerrado |
| **S7** | DROP `ticket_venta_pos` o vista legacy | Build ambos repos |
| **S8** | Script import histórico (Director) | Filas IMPORT_HISTORICO |

---

## 9. Validación mínima

```bash
cd report && npm run build
cd tablet-bazzar && npm run build
```

Smoke manual: checklist en [FLUJO_CANONICO_POS_BAZZAR.md §12](./FLUJO_CANONICO_POS_BAZZAR.md).

---

## 10. Referencias

| Doc | Ruta |
|-----|------|
| Tarea pendiente etapa | `.claude/4_etapas/TAREA_PENDIENTE_DOS_TABLAS_CAJA_BOBINA.md` |
| CHUSAR Report | `.claude/2_modulos/2.3_report/caja_bazzar/CHUSAR_CAJA_BAZZAR_REPORT.md` |
| CHUSAR Tablet staging | `.claude/2_modulos/2.4_tablet_bazzar/CHUSAR_TICKETS_POS_STOCK.md` |
| Hiedra plan | `.claude/4_etapas/PLANIFICACION_CAJA_BAZZAR_HIEDRA.md` |

**Plan P0 documentado — pendiente autorización Director para S1.**
