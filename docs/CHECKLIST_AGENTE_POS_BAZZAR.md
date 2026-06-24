# Checklist agente — POS Bazzar (antes de tocar código)

**Leer primero (orden):**

1. `tablet-bazzar/docs/LOGICA_OPERATIVA_POS_BAZZAR.md` — **doc canónico v2**
2. [LOGICA_STOCK_DEPOSITO_SYNC.md](./LOGICA_STOCK_DEPOSITO_SYNC.md)
3. [FLUJO_CANONICO_POS_BAZZAR.md](./FLUJO_CANONICO_POS_BAZZAR.md)

## Shibboleth de diseño (5 preguntas)

1. ¿Cuántos depósitos piso? → **6** (`2100, 2900, 2400, 2700, 3100, 3200`)
2. ¿Puede la tienda A vender stock de la tienda B? → **NO** (`cliente_id` obligatorio)
3. ¿Bandeja cajero = Bobeda ORO? → **NO** — `ticket_bandeja_cajero` vs `bobeda_venta_pos`
4. ¿Quién puede mutar ORO histórico? → **Usuarios: solo ENTREGADO · Director: todo lo demás**
5. ¿Sync depósito borra bandeja? → **NO** · solo reemplaza `deposito_1_*_tienda`

## Antes de cada cambio POS

- [ ] ¿Afecta cola cajero? → `queryTickets()` Report · estados `PENDIENTE_CAJA`
- [ ] ¿Afecta stock? → validar fórmula depósito + reserva bandeja en sync-cart
- [ ] ¿Afecta CERRAR? → transacción · FOR UPDATE sin agregados · FI_FA vía counter
- [ ] ¿Afecta filtros fecha? → **pendiente caja = sin filtro de día**
- [ ] ¿Toca Sales Report / pilares importadora? → **ABORTAR** (blindado)

## Después de cada cambio

- [ ] CERRAR → visible Report caja · FI_FA asignado
- [ ] Reabrir FACTURAS → editar qty sin «hay 0, pediste 1»
- [ ] Smoke aislamiento: query con `cliente_id` incorrecto retorna vacío
- [ ] `npm run build` en report y tablet-bazzar

## Scripts rápidos

```bash
cd report
node scripts/diag_pre_sync_pos.mjs 2100
node scripts/diag_bandeja_caja_2100.mjs
node scripts/smoke_primera_factura_bandeja.mjs
```
