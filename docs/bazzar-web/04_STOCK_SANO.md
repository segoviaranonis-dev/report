# Protocolo Stock Sano — BAZZAR WEB

## Verificación previa (2026-06-10)

**No existía** tabla Stock Sano antes de migración 115. Precio de venta web usaba `precio` + `lista_precio` tipo WEB (vacía) y cálculo ad-hoc en motor de precio.

| Artefacto | Estado inicial | Tras protocolo |
|-----------|----------------|----------------|
| `stock_sano_*` | No existía | Creado |
| `lista_precio` WEB | Vacía | `Bazzar Web ALM_WEB_01` id=1 |
| `precio` vigentes ALM_WEB | 0 | 22 filas (60 pares) |
| ALM_WEB_01 | Stock 60 pares / 22 comb. | Protocolo **ACTIVO** |

## Qué es Stock Sano

Palabra clave operativa del **motor de precio aduanero**: al ingresar mercadería a un depósito, el sistema fija o valida el **precio de venta canonico** por triplete **linea + referencia + material**, usando caso comercial + indice markup (`fn_precio_venta_web`).

Si el mismo SKU ya tiene precio en depósito y el ingreso trae variacion (nuevo caso, LPN, dolar), el protocolo exige decision antes de mezclar precios — ETAPA siguiente en Compra Web.

## Tablas

| Tabla | Rol |
|-------|-----|
| `stock_sano_almacen` | Depósitos con protocolo activo + `lista_precio_id` |
| `stock_sano_deposito` | Precio vigente por almacén + triplete L+R+Material |
| `stock_sano_historial` | Auditoría: altas, conflictos, decisiones |
| `v_stock_sano_deposito` | Vista operativa stock + estado SANO |

Migración: `control_central/migrations/115_stock_sano_protocolo.sql`

## Primer depósito

**ALM_WEB_01** (id=1) — 60 pares, 22 combinaciones, 2 tripletas:

| Triplete | LPN | Caso | Markup | Precio WEB |
|----------|-----|------|--------|------------|
| 2305 · 1579 · NAPA TURIM | 132300 | BR-VZ-MD-ML-MKA-O | 50% | 198.000 |
| 2400 · 139 · NAPA FLOTER RUSTICO NEO | 105400 | BR-VZ-MD-ML-MKA-O | 50% | 158.000 |

## UI Report

`/bazzar-web/stock-sano` — rol_id=1

API: `GET /api/bazzar-web/stock-sano`

Backfill: `node scripts/aplicar_stock_sano.mjs` (desde repo report)

## Tienda bazzar-web

Vista `v_stock_web` expone `precio_web` + `stock_sano_estado`. Checkout rechaza `SIN_PROTOCOLO`.

Doc tienda: [ETAPA_BAZZAR_WEB_003_STOCK_SANO.md](../../bazzar-web/docs/ETAPA_BAZZAR_WEB_003_STOCK_SANO.md)

Aplicar vista: `cd bazzar-web && npm run db:v-stock-web`

Dev: `npm run dev:3002` → http://localhost:3002/catalogo

## Cierre ETAPA-003 (2026-06-10)

| Check | OK |
|-------|-----|
| 60 pares / 22 SKUs SANO | ✓ |
| precio_web en catálogo | ✓ |
| Checkout bloquea SIN_PROTOCOLO | ✓ |

Ver [ETAPA_STOCK_SANO_004_CIERRE.md](./ETAPA_STOCK_SANO_004_CIERRE.md)

## Pendiente post-cierre

- [ ] Interceptar **Confirmar recepción** (Compra) con preview conflicto + decision Director
- [ ] Segundo depósito bajo protocolo
