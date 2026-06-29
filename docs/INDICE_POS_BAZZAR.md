# Índice documentación POS Bazzar

**Actualizado:** 2026-06-24 · Modelo **bandeja única v2**

---

## Leer primero (orden obligatorio agente)

| # | Documento | Repo | Contenido |
|---|-----------|------|-----------|
| 1 | **[LOGICA_OPERATIVA_POS_BAZZAR.md](../../tablet-bazzar/docs/LOGICA_OPERATIVA_POS_BAZZAR.md)** | tablet | **Doc canónico** — estados, flujos, funciones §16–18 |
| 2 | [LOGICA_STOCK_DEPOSITO_SYNC.md](./LOGICA_STOCK_DEPOSITO_SYNC.md) | report | Sync DELETE+INSERT · guard 409 · paridad Retail |
| 3 | [FLUJO_CANONICO_POS_BAZZAR.md](./FLUJO_CANONICO_POS_BAZZAR.md) | report | Visión Director · 6 tiendas · permisos |
| 4 | [CHECKLIST_AGENTE_POS_BAZZAR.md](./CHECKLIST_AGENTE_POS_BAZZAR.md) | report | Shibboleth diseño · smoke |

---

## Índices por repo

### Tablet (`tablet-bazzar/docs/`)

| Doc | Rol |
|-----|-----|
| [REGLAS_BANDEJA_UNICA_POS.md](../../tablet-bazzar/docs/REGLAS_BANDEJA_UNICA_POS.md) | Reglas inviolables resumidas |
| [ARQUITECTURA_SESION_STOCK_ORO.md](../../tablet-bazzar/docs/ARQUITECTURA_SESION_STOCK_ORO.md) | Diagrama capas |
| [MICRO_ECOSISTEMA_POS_BAZZAR.md](../../tablet-bazzar/docs/MICRO_ECOSISTEMA_POS_BAZZAR.md) | Tablet ↔ Report ↔ BD |
| [TRIANGULO_HEADER_PILARES.md](../../tablet-bazzar/docs/TRIANGULO_HEADER_PILARES.md) | Filtros género · tipo1 · categoría |
| [BACKEND_POS.md](../../tablet-bazzar/docs/BACKEND_POS.md) | SQL catálogo · cookies · APIs depósito |

### Report (`report/docs/`)

| Doc | Rol |
|-----|-----|
| [DEPOSITOS_BAZZAR_ADMIN.md](./DEPOSITOS_BAZZAR_ADMIN.md) | Admin sync · UI `/depositos-bazzar` |
| [ARQUITECTURA_DOS_TABLAS_CAJA_BOBINA.md](./ARQUITECTURA_DOS_TABLAS_CAJA_BOBINA.md) | Bandeja ≠ Bobeda (parcial legacy §2) |
| [PROTOCOLO_CAJA_BAZZAR_CAJERO.md](./PROTOCOLO_CAJA_BAZZAR_CAJERO.md) | Rol cajero P-12 |

---

## Docs históricos (superseded — no implementar)

Estos describen modelo dual `ticket_pos_staging` + «Listo → caja». **Solo referencia histórica.**

- `ETAPA_TICKETS_POS_STOCK.md` (tablet)
- `FLUJO_P12_P13_CAJA_BAZZAR.md` § staging
- `PLAN_IMPLEMENTACION_DOS_TABLAS_P0.md`

---

## Código fuente canónico

| Pieza | Ruta |
|-------|------|
| Motor bandeja tablet | `tablet-bazzar/lib/server/tickets-staging.ts` |
| SQL stock catálogo | `tablet-bazzar/lib/server/catalogo-sql.ts` |
| Query caja | `report/src/lib/caja-bazzar/tickets-db.ts` |
| Handoff Empaque | `report/src/lib/caja-bazzar/handoff-bobeda.ts` |
| Sync depósito | `report/src/app/api/depositos/sync/route.ts` |
| Migraciones | `tablet-bazzar/supabase/migrations/007–009` |

---

## Scripts diagnóstico (`report/scripts/`)

```bash
node scripts/diag_pre_sync_pos.mjs 2100
node scripts/diag_bandeja_caja_2100.mjs
node scripts/smoke_primera_factura_bandeja.mjs
node scripts/reset_pos_bazzar_ventas.mjs
node scripts/run_migration_009.mjs
```

---

## Módulos Moria (`.claude/`)

| Doc | Contenido |
|-----|-----------|
| [MODULO_POS v2 tablet](../../.claude/2_modulos/2.4_tablet_bazzar/MODULO_POS_BANDEJA_UNICA_V2.md) | 2.4.2.3 |
| [MODULO_POS v2 caja](../../.claude/2_modulos/2.3_report/caja_bazzar/MODULO_POS_BANDEJA_UNICA_V2.md) | 2.3.2.2 |
| [ETAPA cierre doc](../../.claude/4_etapas/ETAPA_POS_BAZZAR_DOCUMENTACION_CERRADA.md) | Formal 2026-06-24 |
| [ACTUAL.md](../../.claude/4_etapas/ACTUAL.md) | Etapa activa holding |
