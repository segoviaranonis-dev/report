# Protocolo Caja Bazzar — Cajero · Bobeda · Entregas

> **v2 (2026-06-24):** tablet escribe solo `ticket_bandeja_cajero` · CERRAR → caja.  
> **Doc operativo:** [INDICE_POS_BAZZAR.md](./INDICE_POS_BAZZAR.md) → [LOGICA_OPERATIVA](../../tablet-bazzar/docs/LOGICA_OPERATIVA_POS_BAZZAR.md)

**Ruta app:** `/tablet-bazzar/[cliente_id]?mod=operativa` · **Local:** http://localhost:3001/tablet-bazzar  
**Doc canónico Moria:** `.claude/2_modulos/2.3_report/caja_bazzar/P-12_PROTOCOLO_CAJERO_BOBINA.md`  
**Arquitectura dos tablas:** [ARQUITECTURA_DOS_TABLAS_CAJA_BOBINA.md](./ARQUITECTURA_DOS_TABLAS_CAJA_BOBINA.md)

---

## Tablas vigentes (v2)

| Capa | Tabla | Ciclo |
|------|--------|-------|
| **Operativa tablet+caja** | `ticket_bandeja_cajero` | ABIERTO → CERRAR → PENDIENTE_CAJA → CSV → DELETE handoff |
| **Bobeda ORO** | `bobeda_venta_pos` | PENDIENTE_ENTREGA → ENTREGADO |
| Legacy (no escribir) | `ticket_pos_staging`, `ticket_venta_pos` | Solo lectura histórica |

---

## Bandeja cajero — estado ideal VACÍO

Cada fila pendiente muestra:

- Indicador **Pendiente caja**
- **Descargar CSV** → import en facturador legacy · marca `CSV_DESCARGADO`
- **Enviar a Empaque** — copia a `bobeda_venta_pos` y vacía bandeja

El cajero confirma coincidencia ticket ↔ caja real y limpia su bandeja.

---

## Protocolo cajero (resumen)

1. Login Report · rol caja · **solo su tienda**
2. Sesión caja con usuario responsable
3. Bandeja vacía al inicio
4. Cliente llega → «¿Cuál es su nombre?» / «¿A nombre de quién facturó el vendedor?»
5. Match en bandeja → CSV → factura legal → cobro
6. **Enviar a Empaque** → `bobeda_venta_pos` **`PENDIENTE_ENTREGA`**

---

## Empaque (tablet `:3000/empaque`)

Lee **`bobeda_venta_pos`** · acción única usuario: **`ENTREGADO`**.

API: `GET /api/empaque/tickets` · `POST /api/empaque/entregar`

---

## Reglas robustez

- Bandeja **sin filtro día** — todo `PENDIENTE_CAJA` / `CSV_DESCARGADO` de la tienda.
- Handoff **atómico** — INSERT Bobeda + DELETE bandeja en una transacción; si Bobeda ya tiene el par, **no** se borra bandeja.
- Sales Report histórico **blindado** — cero JOIN con pilares/Bobeda en gerencia RIMEC.
