# Lógica stock depósito · sync · bandeja POS

**Versión:** 2.0 · **2026-06-24  
**Complemento:** `tablet-bazzar/docs/LOGICA_OPERATIVA_POS_BAZZAR.md`  
**Admin UI:** `/depositos-bazzar` · **Sync API:** `POST /api/depositos/sync`

---

## 1. Dos mundos que no se mezclan

| Mundo | Tabla | Qué representa |
|-------|-------|----------------|
| **Verdad Retail** | `registro_st_vt_rc_reposicion` | Import Excel · no baja por venta POS |
| **Stock operativo piso** | `deposito_1_{cliente_id}_tienda` | Lo que la tablet puede vender **ahora** |
| **Reserva venta** | `ticket_bandeja_cajero` | Pares descontados del depósito · en pedido |

Ventas POS **restan** depósito operativo. Sync depósito **reemplaza** depósito desde Retail **sin** leer bandeja.

---

## 2. Sync depósito — algoritmo exacto

```sql
-- Paso 1: vaciar operativo
DELETE FROM deposito_1_{cliente_id}_tienda;

-- Paso 2: reimportar desde Retail
INSERT INTO deposito_1_{cliente_id}_tienda (...)
SELECT ... FROM registro_st_vt_rc_reposicion r
INNER JOIN tiendas_marcas tm ON tm.cliente_id = :id AND tm.marca_id = r.marca_id AND tm.activo
WHERE r.cliente_id = :id AND lower(trim(r.tipo_movimiento)) = 'stock';
```

**Efecto:** borra por completo el stock operativo y lo vuelve a cargar desde Retail.

**No hace:** restaurar reservas bandeja · no borra transaccionales · no resetea FI_FA.

---

## 3. Cuándo sync vs reset POS

| Operación | Depósito | Bandeja | Bobeda | FI_FA counter |
|-----------|----------|---------|--------|---------------|
| **Sync depósito** | Reemplaza desde Retail | Intacto | Intacto | Intacto |
| **Reset POS** | Solo +1 desde bandeja activa | DELETE | DELETE | DELETE |

**Escenario típico post-pruebas:** depósito < Retail en moléculas vendidas en POS → **sync** repone catálogo.  
**Escenario corte limpio ventas:** **reset POS** primero · luego sync si hace falta alinear Retail.

---

## 4. Guard antes de sync

`assertSinStagingPendiente(cliente_id)` — retorna 409 si:

```sql
COUNT(DISTINCT staging_id) > 0
FROM ticket_bandeja_cajero
WHERE cliente_id = :id AND estado = 'ABIERTO' AND activo = true
```

**PENDIENTE_CAJA no bloquea** — hay facturas en caja pero sync puede correr (Director decide).

---

## 5. Paridad depósito vs Retail

Diagnóstico: `node scripts/diag_pre_sync_pos.mjs 2100`

| Campo | Significado |
|-------|-------------|
| `deposito_actual.pares` | Suma `cantidad` depósito operativo |
| `retail_fuente_st.pares` | Suma desde `registro_st` filtrado |
| `paridad_pares: false` | Hubo ventas POS o decrementos sin sync |

Diff fila a fila: `node scripts/diag_diff_deposito_retail_2100.mjs`

---

## 6. Análisis Report vs tablet (género / tipo1)

| Vista | Fuente género | Filas incluidas |
|-------|---------------|-----------------|
| Report `/depositos-bazzar/…/analisis` | `d.genero_id` en fila depósito | Todas (incl. cantidad=0) |
| Tablet `/cadena` filtros | JOIN `linea` + stock `cantidad > 0` | Solo vendibles |

Report muestra DAMAS + CABALLEROS en árbol aunque operativo tenga menos pares vendibles.

---

## 8. Lógica caja Report (complemento)

Ver catálogo completo en `LOGICA_OPERATIVA_POS_BAZZAR.md` §17.

### Qué ve el cajero

- Solo filas `ticket_bandeja_cajero` con `estado IN ('PENDIENTE_CAJA', 'CSV_DESCARGADO')`.
- Agrupadas por `staging_id` + `numero_fi_fa` → una factura interna.
- **Sin filtro de fecha** en pendientes (factura de ayer sigue visible hasta Empaque).

### Quitar par en caja

1. `eliminarLineaEmitida` borra 1 fila por `codigo_bandeja`.
2. Restaura +1 en depósito operativo de esa tienda.
3. Si el lote queda sin filas → error o limpieza manual.

### Enviar a Empaque

1. Copia cada par a `bobeda_venta_pos` con `origen = POS_VIVO`.
2. DELETE filas de bandeja — **stock no vuelve** (venta cerrada).
3. Empaque tablet marca `ENTREGADO` en bobeda.

---

## 9. Scripts

```bash
cd report
node scripts/diag_pre_sync_pos.mjs 2100
node scripts/diag_diff_deposito_retail_2100.mjs
node scripts/run_migration_009.mjs   # una vez · FI_FA index
# Sync vía UI o curl POST /api/depositos/sync {"cliente_id":2100}
```

---

**Chayanne el mejor · shibboleth depósitos**
