# Protocolo Caja Bazzar — Cajero · Bobeda · Entregas

**Ruta app:** `/tablet-bazzar/[cliente_id]?mod=operativa` · **Local:** http://localhost:3001/tablet-bazzar  
**Doc canónico Moria:** `.claude/2_modulos/2.3_report/caja_bazzar/P-12_PROTOCOLO_CAJERO_BOBINA.md`

---

## Bobeda = `ticket_venta_pos`

La **mina de oro** es una sola tabla. Informes de eficiencia Bazzar salen de ahí. Sobrevive al “Actualizar stock” del día.

| Capa | Tabla |
|------|--------|
| Intermedia (tablet, sesión stock) | `ticket_pos_staging` |
| Bobeda (permanente) | `ticket_venta_pos` |

---

## Bandeja cajero — estado ideal VACÍO

Cada fila pendiente muestra:

- Indicador **Pendiente** (encendido)
- **Descargar CSV** → import en facturador legacy
- **Enviar a Bobeda** — habilitado **solo después** del CSV

El cajero confirma coincidencia ticket ↔ caja real y limpia su bandeja.

---

## Protocolo cajero (resumen)

1. Login Report · rol caja · **solo su tienda**
2. Sesión caja con usuario responsable
3. Bandeja vacía al inicio
4. Cliente llega → «¿Cuál es su nombre?» / «¿A nombre de quién facturó el vendedor?»
5. Match en bandeja → CSV → factura legal → cobro
6. **Enviar a Bobeda** → `PENDIENTE_ENTREGA`

---

## Entregas

Tablet/módulo entregas consulta Bobeda · miniaturas · mismo orden por nombre · QC → `ENTREGADO`.

Ver P-13 en Moria.

---

## Implementación

| Feature | Estado |
|---------|--------|
| Hub 6 cajas + CSV + facturar | ✅ parcial |
| Estados Bobeda + Enviar a Bobeda UI | ⏳ |
| Módulo entregas | ⏳ |
