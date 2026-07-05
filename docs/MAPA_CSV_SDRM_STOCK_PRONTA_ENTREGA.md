# MAPA CSV sdrm — Stock pronta entrega RIMEC (tabla unificada)

**Etapa:** **2.3.1.10** · Depósito RIMEC · primer paso stock importadora completo  
**Archivo:** `Nexus_Core/csv's/stock's/sdrm0831.csv` (12.143 filas · pipe `|`)  
**Tabla BD:** `stock_pronta_entrega_rimec` (MIG-132)  
**Import CLI:** `python control_central/scripts/import_rimec_pronta_entrega_csv.py <ruta.csv>`

---

## Intención

Un **solo CSV POS importadora** alimenta **todos los depósitos físicos** en **una tabla**:

| Columna CSV | `deposito_codigo` | Rol |
|-------------|-------------------|-----|
| `S00_D1` | **D1** | Piso / depósito principal calzado |
| `S00_DEP2` | **DEP2** | Bodega (lotes grandes, pocas filas) |
| `S00_D3` | **D3** | Pronta entrega · confección + calzado Kyly |

**Diferencia vs Bazzar (18 tablas):** aquí `deposito_codigo` es **argumento de fila**, no nombre de tabla.

**Almacén lógico:** `almacen_id = 4` (`ALM_DEPOSITO_RIMEC`).

---

## Precio en guaraníes

| Regla | Ejemplo |
|-------|---------|
| LPN del CSV = **Gs directo** | `118900` → `precio_unitario_gs = 118900` |
| **Sin** ÷1000 (distinto a Bazzar sdfm) | `70100` → 70.100 Gs |
| Monto | `monto_gs = ROUND(cantidad × precio_unitario_gs)` columna generada |

Cantidad admite **0.5** (media caja POS) → `numeric(14,3)`.

---

## Ramos (prefijo código barras)

| Prefijo `CODIGO ARTICULO` | proveedor_id | tipo_v2 | Parser |
|---------------------------|--------------|---------|--------|
| `654.*` | **654** | 1 calzado | `1214.205` → L=1214 R=205 · grada `34(1 2 3 3 2 1)39` |
| `638.*` | **638** | 2 confección/Kyly | `130643` + mat `K130643` · grada `10(1)10` o `4/6/8` |

Código: `report/src/lib/deposito-rimec/rimec-csv-sdrm.ts` · import `control_central/scripts/import_rimec_pronta_entrega_csv.py`

---

## Volumen sdrm0831 (import 2026-07-04)

| deposito_codigo | Filas | Unidades | Monto Gs (calc) |
|-----------------|-------|----------|-----------------|
| D1 | 2.399 | 69.903 | calzado 654 |
| DEP2 | 32 | 28.817 | calzado 654 |
| D3 | 9.678 | 98.410 | confección 638 |
| **Total** | **12.109** | **197.130** | **~24.129.016.020** |

Import: `fk_miss = 0` · batch `sdrm0831`.

---

## Convención archivo

| Prefijo | Ente | Ejemplo |
|---------|------|---------|
| `sdrm` | RIMEC importadora pronta entrega | `sdrm0831.csv` |

Patrón: `sdrm####.(csv|txt|xlsx)`

---

## CHUSAR

[CHUSAR_STOCK_PRONTA_ENTREGA_RIMEC.md](../../.claude/2_modulos/2.3_report/deposito_rimec/CHUSAR_STOCK_PRONTA_ENTREGA_RIMEC.md)

**Shibboleth:** Chayanne el mejor
