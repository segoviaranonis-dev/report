# Flujo P-12 / P-13 — Caja Bazzar · Bobeda · Entregas

**Actualizado:** 2026-06-16 · **Etapa:** Caja Bazzar (`2.3.2.2`)  
**Doc canónico Director (leer primero):** [FLUJO_CANONICO_POS_BAZZAR.md](./FLUJO_CANONICO_POS_BAZZAR.md)  
**Memoria secundaria:** [MEMORIA_SECUNDARIA_CONEXIONES_INTERNAS.md](../.claude/2_modulos/2.3_report/caja_bazzar/MEMORIA_SECUNDARIA_CONEXIONES_INTERNAS.md) · código **2.3.2.2.10**  
**Docs canónicos Moria:** [P-12](../.claude/2_modulos/2.3_report/caja_bazzar/P-12_PROTOCOLO_CAJERO_BOBINA.md) · [P-13](../.claude/2_modulos/2.3_report/caja_bazzar/P-13_MODULO_ENTREGAS_BOBINA.md)  
**Índice Moria:** [caja_bazzar/INDICE.md](../.claude/2_modulos/2.3_report/caja_bazzar/INDICE.md)  
**App Report:** `:3001/tablet-bazzar` · **App Tablet:** `:3000/cadena`

---

## 1. Qué cubre este flujo

Ciclo **venta piso → caja → facturador legacy → Bobeda → entrega física**, sin tocar Sales Report RIMEC (`2.3.1.1`).

| Protocolo | Rol | Bandeja ideal |
|-----------|-----|---------------|
| **P-12** | Cajero Report | **VACÍO** — sin `PENDIENTE_CAJA` / `CSV_DESCARGADO` |
| **P-13** | Entregas / Empaque tablet | **VACÍO** — sin `PENDIENTE_ENTREGA` |

**Bobeda = `ticket_venta_pos`** (permanente). **Intermedia = `ticket_pos_staging`** (sesión del día, mueve stock).

---

## 2. Flujo end-to-end (orden operativo)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ CIMIENTO — antes del turno                                              │
│  Retail Excel → registro_st_vt_rc_reposicion                           │
│  Report 2.3.2.1 → sync → deposito_1_{cliente_id}_tienda (solo calzado) │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ TABLET 2.4.2 · Venta piso                                               │
│  /cadena → INGRESAR → /cadena/vista                                     │
│  PIN vendedor (2.4.2.3) → carrito → COBRAR                              │
│  ticket_pos_staging (ABIERTO) — stock ± en depósito sesión              │
│  Cerrar ticket → staging CERRADO → promover                             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ P-12 · CAJERO Report (2.3.2.2.x · card A operativa)                      │
│  ticket_venta_pos → PENDIENTE_CAJA (bandeja)                            │
│  Cajero: «¿Cuál es su nombre?» → match fila                             │
│  Descargar CSV → import facturador legacy → cobro real                   │
│  Enviar a Bobeda → PENDIENTE_ENTREGA                                    │
│  Bandeja cajero: VACÍO                                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ P-13 · ENTREGAS (2.4.2.4 Empaque tablet + rol entregas Report ⏳)         │
│  Consulta Bobeda PENDIENTE_ENTREGA · miniaturas · QC                    │
│  Confirmar → ENTREGADO · bandeja entregas: VACÍO                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ FIN SESIÓN — Report 2.3.2.1                                             │
│  Actualizar stock (sync) — bloqueado si staging ABIERTO/CERRADO (409)   │
│  Bobeda intacta · depósito reimportado desde Retail                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Estados Bobeda (`ticket_venta_pos`)

| Estado | Quién | UI |
|--------|-------|-----|
| `PENDIENTE_CAJA` | Promoción desde staging | Bandeja cajero · LED **Pendiente** |
| `CSV_DESCARGADO` | Tras descargar CSV | Habilita **Enviar a Bobeda** |
| `PENDIENTE_ENTREGA` | Cajero post-check | Bobeda · módulo entregas |
| `ENTREGADO` | Operador entregas | Sale de pendientes |
| `ANULADO` | Solo Director ⏳ | — |

**Hoy en código (transición):** se usa `EMITIDO` → `FACTURADO` como paso intermedio hasta migrar nombres canónicos P-12.

---

## 4. Índice contable — módulos que implementan P-12/P-13

### 4.1 Árbol Report · grupo BAZZAR (`2.3.2.x`)

| Código | Módulo (Moria / Hub) | Rol en P-12/P-13 | Ruta app | Estado |
|--------|----------------------|-------------------|----------|--------|
| **2.3.2.1** | Depósitos Bazzar admin | Sync Retail → 18 tablas · guard 409 staging | `/depositos-bazzar` | ✅ sync + guard |
| **2.3.2.2** | **Caja Bazzar** (madre P-12) | Protocolo cajero · CSV · Bobeda | `/tablet-bazzar` | 🟡 parcial |
| **2.3.2.2.0** | Hub · 6 cajas | Selector tienda | `/tablet-bazzar` | ✅ |
| **2.3.2.2.1** | Fernando Adultos · 2100 | Caja tienda | `/tablet-bazzar/2100` | ✅ UI |
| **2.3.2.2.2** | Fernando Niños · 2900 | Caja tienda | `/tablet-bazzar/2900` | ✅ UI |
| **2.3.2.2.3** | San Martín Adultos · 2400 | Caja tienda | `/tablet-bazzar/2400` | ✅ UI |
| **2.3.2.2.4** | San Martín Niños · 2700 | Caja tienda | `/tablet-bazzar/2700` | ✅ UI |
| **2.3.2.2.5** | Palma Adultos · 3100 | Caja tienda | `/tablet-bazzar/3100` | ✅ UI |
| **2.3.2.2.6** | Palma Niños · 3200 | Caja tienda | `/tablet-bazzar/3200` | ✅ UI |

**Sub-cards por caja** (`?mod=`):

| Sub | Código doc | Nombre | P-12/P-13 | Estado |
|-----|------------|--------|-----------|--------|
| **A** | P-03 | Caja operativa | Bandeja CSV · Pendiente · Enviar Bobeda | 🟡 CSV + FACTURADO |
| **B** | P-04 | Facturable / archivo | Tickets `FACTURADO` del día | ✅ lectura |
| **C** | P-05 | Métricas | KPIs pares / pendientes | ✅ básico |

**Docs planificación enlazados:**

| Doc | Código | Contenido P-12/P-13 |
|-----|--------|---------------------|
| P-06 | Accesos solo tu depósito | Aislamiento tienda cajero |
| P-07 | Flujo CSV cajero | Columnas CSV · match nombre |
| P-09 | BD molecular tickets | `ticket_venta_pos` · FK pilares |
| P-10 | Cédula cliente nuevo | CSV cliente sin historial |
| P-11 | Roles usuarios caja | Matriz acceso por tienda |
| **P-12** | **Protocolo cajero Bobeda** | **CHUSAR cajero** |
| **P-13** | **Entregas Bobeda** | **CHUSAR entregas** |

### 4.2 Árbol Tablet (`2.4.x`) — alimenta P-12

| Código | Módulo | Rol en flujo | Ruta | Estado |
|--------|--------|--------------|------|--------|
| **2.4.1** | Panel modos | Entrada Ventas / Depósito | `/` | ✅ |
| **2.4.2** | Ventas · Cadena | Catálogo · filtros · INGRESAR | `/cadena` | ✅ |
| **2.4.2.1** | POS · Cliente cédula | Lookup `clients_bazaar` en carrito | `/cadena/vista` | ✅ |
| **2.4.2.2** | Otras tiendas · stock | Dock cross-local | `/cadena/vista` | ✅ |
| **2.4.2.3** | **Tickets POS · COBRAR** | Staging intermedia · stock sesión | `/cadena/vista` | ✅ |
| **2.4.2.4** | **Empaque** (P-13 tablet) | QC · miniaturas · `ENTREGADO` | `/empaque` ⏳ | ⏳ doc |
| **2.4.3** | Depósito fotos | Grid molécula · consulta stock | `/deposito` | ✅ |
| **2.4.4** | API Live | `/api/deposito/*` | APIs | ✅ |

### 4.3 Módulos Report RIMEC — **NO entran** en P-12/P-13

| Código | Módulo | Motivo |
|--------|--------|--------|
| 2.3.1.1 | Sales Report | Blindado · importadora |
| 2.3.1.2 | Ventas + Fotos | Gerencia RIMEC · no POS Bazzar |
| 2.3.1.3 | Aprobaciones | Nivel Dios · PP importadora |
| 2.3.1.7.x | Proceso importación | Motor / IC / PP — otro ciclo |

---

## 5. APIs y código por fase

### 5.1 Capa intermedia (Tablet · 2.4.2.3)

| Pieza | Ubicación | Estado |
|-------|-----------|--------|
| Staging CRUD | `tablet-bazzar/lib/server/tickets-staging.ts` | ✅ |
| PIN vendedor | `POST /api/vendedor/identificar` | ✅ |
| COBRAR / stock ± | `POST /api/tickets/staging/*` | ✅ |
| Promover → ORO | staging → `ticket_venta_pos` | ✅ parcial |
| UI PIN + tickets | `VendedorPinButton`, `StagingTicketsPanel` | ✅ |

### 5.2 P-12 · Caja Report (2.3.2.2)

| Pieza | Ubicación | Estado |
|-------|-----------|--------|
| Hub 6 cajas | `src/app/tablet-bazzar/page.tsx` | ✅ |
| Card A/B/C | `TicketsPanel` + `CajaSubNav` | ✅ |
| Listar tickets | `GET /api/tablet-bazzar/tickets` | ✅ |
| CSV bandeja | `GET /api/tablet-bazzar/tickets/csv` | ✅ |
| Marcar facturado | `POST /api/tablet-bazzar/tickets/facturar` | ✅ (`→ FACTURADO`) |
| **Enviar a Bobeda** | `POST …/bobeda` | ⏳ |
| LED Pendiente | UI bandeja | ⏳ |
| Auth solo su tienda | `lib/caja-bazzar/access.ts` | ⏳ |
| Estados PENDIENTE_CAJA / CSV_DESCARGADO | BD + queries | ⏳ |

### 5.3 P-13 · Entregas

| Pieza | Ubicación | Estado |
|-------|-----------|--------|
| Bandeja entregas tablet | `/empaque` | ⏳ |
| `GET /api/entregas-bazzar/tickets` | Report | ⏳ |
| `POST …/entregar` → `ENTREGADO` | Report / tablet | ⏳ |
| Miniaturas QC | `snapshot_json.imagen_url` | ⏳ |

### 5.4 Cimiento stock (2.3.2.1)

| Pieza | Ubicación | Estado |
|-------|-----------|--------|
| Sync depósitos | `POST /api/depositos/sync` | ✅ |
| Guard staging | `lib/caja-bazzar/staging-guard.ts` | ✅ |
| Tablas `deposito_1_{id}_tienda` | Migración 114 | ✅ |
| Filtro calzado 654 | `tipo_v2_id = 1` en sync | ✅ |

---

## 6. Protocolo cajero (P-12) — pasos operativos

1. **Login Report** — rol caja · tienda asignada (P-11).
2. **Abrir caja** — `/tablet-bazzar/{cliente_id}?mod=operativa`.
3. **Verificar bandeja VACÍA** al inicio de turno.
4. Cliente llega desde piso — vendedor ya cerró ticket tablet.
5. **Pregunta clave:** «¿Cuál es su nombre?» / «¿A nombre de quién facturó el vendedor?»
6. **Match** fila en bandeja (cédula o nombre vendedor/cliente).
7. **Descargar CSV** → import en facturador legacy → factura + cobro real.
8. **Enviar a Bobeda** (solo post-CSV) → ticket pasa a `PENDIENTE_ENTREGA`.
9. Bandeja cajero vuelve a **VACÍO**.

Legacy (fuera Nexus): emisión fiscal · formas de pago · plazos.

---

## 7. Protocolo entregas (P-13) — pasos operativos

1. Cliente presenta comprobante / factura legal.
2. Operador abre **Empaque tablet** (2.4.2.4) o módulo entregas Report ⏳.
3. Busca por **mismo criterio nombre** que cajero.
4. **QC:** artículo vs miniatura + molécula L·R·Mat·Color·grada.
5. Entrega física → marca **`ENTREGADO`**.
6. Bandeja entregas **VACÍO**.

---

## 8. Siguiente ejecución (orden)

| # | Tarea | Código | Prioridad |
|---|-------|--------|-----------|
| 1 | Migrar estados `EMITIDO/FACTURADO` → canónicos P-12 | 2.3.2.2 · P-12 | Alta |
| 2 | UI LED Pendiente + **Enviar a Bobeda** post-CSV | 2.3.2.2 · card A | Alta |
| 3 | Auth cajero solo su `cliente_id` | P-11 | Media |
| 4 | Ruta `/empaque` tablet · bandeja P-13 | 2.4.2.4 | Media |
| 5 | APIs entregas Report | P-13 | Media |
| 6 | Migración 003 vendedor en Supabase prod | 2.4.2.3 | Media |

---

## 9. Referencias cruzadas

| Tema | Doc |
|------|-----|
| CHUSAR agente caja | `.claude/2_modulos/2.3_report/caja_bazzar/CHUSAR_CAJA_BAZZAR_REPORT.md` |
| Staging + stock sesión | `tablet-bazzar/docs/ARQUITECTURA_SESION_STOCK_ORO.md` |
| Ciclo 3 módulos tablet | `.claude/2_modulos/2.4_tablet_bazzar/P-01_TRES_MODULOS_CICLO_CERRADO.md` |
| Mirror protocolo | `report/docs/PROTOCOLO_CAJA_BAZZAR_CAJERO.md` |
| Evidencia plan | `report/docs/evidencia/PLAN_CAJA_BAZZAR_20260622.json` |
| Moria árbol | `nexus-navegador-holding/config/arbol-modulos.json` § 2.3.2.2 |

---

**Flujo P-12/P-13 documentado · índice contable 2.3.2.2 + 2.4.2.3/4 · Bobeda = ticket_venta_pos**
