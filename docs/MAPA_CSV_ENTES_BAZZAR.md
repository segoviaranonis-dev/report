# MAPA CSV POS Bazzar — tres entes

**Etapa:** 2.3.2.1.1 · Hiedra Venenosa  
**CHUSAR operativo:** [CHUSAR_IMPORT_CSV_PILARES_PROVISION.md](../../.claude/2_modulos/2.3_report/depositos/CHUSAR_IMPORT_CSV_PILARES_PROVISION.md)  
**Registro maestro:** [CHUSAR_DEPOSITO_INTEGRACION_COMPLETA_20260628.md](../../.claude/2_modulos/2.3_report/depositos/CHUSAR_DEPOSITO_INTEGRACION_COMPLETA_20260628.md)  
**Navegador:** http://localhost:3004/modulos/report/import-csv-pilares  
**Dual ramo calzado/confección:** [DEPOSITO_DUAL_RAMO_CALZADO_CONFECCIONES.md](./DEPOSITO_DUAL_RAMO_CALZADO_CONFECCIONES.md)  
**Código:** `report/src/lib/depositos/bazzar-csv-ente-map.ts`

---

## Regla clave

**Las columnas stock son iguales en los 3 entes** (`S00_D1` · `S00_D2` · `S00_NINHOS`).  
**La ente viene del nombre del archivo**, no del header.

| Archivo | Prefijo | Ente | Lote ejemplo |
|---------|---------|------|--------------|
| `sdfm4708.csv` | `sdfm` | **Fernando** | `4708` |
| `sdsm4708.csv` | `sdsm` | **San Martín** | `4708` |
| `sdpl4708.csv` | `sdpl` | **Palma** | `4708` |

Patrón: **`sd` + `{fm|sm|pl}` + `{lote}` + `.csv`**

---

## Palma — tienda única (1 caja tablet)

| Concepto | Valor |
|----------|-------|
| Local físico | **1** (no hay tienda niños separada) |
| `cliente_id` operativo | **3100** |
| Caja tablet | **`/tablet-bazzar/3100`** |
| Depósito venta | `deposito_1_3100_tienda` |
| `3200` | Tabla legacy en BD · **sin POS · sin import CSV** |

**Mapeo CSV Palma (`sdpl####.csv`):**

| Columna | Tabla | Marcas permitidas |
|---------|-------|-------------------|
| `S00_D1` | `deposito_1_3100_tienda` | Calzado adultos: 1, 2, 3, 4, 7, 8, 9 |
| `S00_D2` | `deposito_2_3100_guardado` | Idem adultos |
| `S00_NINHOS` | **`deposito_1_3100_tienda`** (misma caja) | Calzado niños 5, 6 + confección 10–15 |

En el lote 4708, `S00_NINHOS` = 0 porque ese día no hubo stock niños/confección en el export — no porque exista otro depósito.

---

## Fernando · San Martín — dos locales (2 cajas)

| Columna CSV | Rol físico | Fernando | San Martín | Palma |
|-------------|------------|----------|------------|-------|
| `S00_D1` | Tienda **adultos** (principal) | 2100 · `deposito_1_2100_tienda` | 2400 · `deposito_1_2400_tienda` | 3100 · `deposito_1_3100_tienda` |
| `S00_D2` | **Guardado** adultos (bodega) | 2100 · `deposito_2_2100_guardado` | 2400 · `deposito_2_2400_guardado` | 3100 · `deposito_2_3100_guardado` |
| `S00_NINHOS` | Tienda **niños** (+ confección) | 2900 · `deposito_1_2900_tienda` | 2700 · `deposito_1_2700_tienda` | **3100** · `deposito_1_3100_tienda` |

**Un archivo = hasta 3 tablas** del mismo ente (9 tablas si importás los 3 archivos del mismo lote).

---

## Volúmenes lote 4708 (análisis 2026-06-28)

| Archivo | Filas CSV | S00_D1 uds | S00_D2 uds | S00_NINHOS uds |
|---------|-----------|------------|------------|----------------|
| `sdfm4708.csv` | 15.222 | 10.046 | 4.263 | 6.322 |
| `sdsm4708.csv` | 22.488 | 16.306 | 8.589 | 5.877 |
| `sdpl4708.csv` | 9.230 | 10.300 | 2.261 | **0** |

Palma niños vacío en este export — normal si el POS no movió stock niños ese día o tienda niños usa otro ritual.

---

## Esquema columnas (7 + 3 · inmutable)

1. `CODIGO ARTICULO` · 2. `COD.ART.PROVEEDOR` · 3. `COD.GRUPO` · 4. `COD.MATERIAL` · 5. `COD.COLOR` · 6. `DESCRIPCION GRADA` · 7. `LPN` · 8–10. stock arriba.

Delimitador: **pipe `|`** · encoding **latin-1**.

---

## Import web (Report)

| Acción | Dónde |
|--------|-------|
| Hub 3 entes | http://localhost:3001/depositos-bazzar |
| API | `POST /api/depositos/import-csv` |
| Pilares + stock | Transacción única · ver CHUSAR 2.3.2.1.1.3 |

Modos: **Reemplazar total** (bulk · segundos) · **Agregar (sumar)**. Modal muestra `pilares_ms` · `deposito_ms` · altas por pilar · `fk_miss`.

Ritual paso a paso: registro maestro § «Proceso de importación CSV».

---

## Import CLI

```powershell
cd report
node scripts/import_bazzar_csv_deposito.mjs ..\sdfm4708.csv --dry-run
node scripts/import_bazzar_csv_deposito.mjs ..\sdsm4708.csv --dry-run
node scripts/import_bazzar_csv_deposito.mjs ..\sdpl4708.csv --dry-run
```

Nombre incorrecto → **bloqueo** con mensaje canónico.

---

## Arquitectura etapas

| Etapa | Modelo stock | Motivo |
|-------|--------------|--------|
| **Actual (prueba)** | **18 tablas** `deposito_{nivel}_{cliente_id}_{categoria}` | Sync/import **molecular** · independencia total |
| **Producción futura** | **1 tabla** stock unificada + índices | Eficiencia · menos DDL |
| **Proceso futuro** | **Traspaso entre depósitos** | Envío mercadería tienda↔guardado↔ente (Palma y red completa) |

La consolidación a una tabla **no empieza hasta cierre del proyecto**; documentar traspasos ahora para no pintarnos en una esquina.

---

## Traspaso inter-depósito (futuro · OT)

Palma y el resto de la red pedirán **movimiento de mercadería** entre:

- Tienda ↔ guardado (mismo `cliente_id`)
- Ente ↔ ente (misma categoría o cross-dock)
- Averiado ← devolución tienda

Diseño previsto: tabla `deposito_movimiento` + FK molécula · **no** editar CSV manual para traspasos.

---

**Shibboleth:** Chayanne el mejor
