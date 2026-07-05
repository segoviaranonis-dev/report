# MAPA CSV sdfm — Depósitos Bazzar Fernando

**Etapa:** **2.3.2.1.1** · Admin dinámico stock Bazzar  
**Archivo ejemplo:** `Nexus_Core/csv's/stock's/sdfm4708.csv` (15.222 filas · delimitador `|`)  
**Código lib:** `report/src/lib/depositos/bazzar-csv-sdfm.ts`  
**Import CLI:** `node scripts/import_bazzar_csv_deposito.mjs <ruta.csv> [--dry-run]`

---

## Intención

Un **solo CSV del POS Bazzar** alimenta **todos los depósitos Fernando** en Report:

| Columna CSV | cliente_id | Categoría | Tabla BD |
|-------------|------------|-----------|----------|
| `S00_D1` | **2100** | tienda (piso) | `deposito_1_2100_tienda` |
| `S00_D2` | **2100** | guardado (bodega) | `deposito_2_2100_guardado` |
| `S00_NINHOS` | **2900** | tienda (piso niños) | `deposito_1_2900_tienda` |

Tablet POS lee **solo nivel 1 tienda** (`2100` adultos · `2900` niños).

Doc matriz marcas: [MATRIZ_TIENDAS_MARCAS_TIPO_V2.md](../../.claude/2_modulos/2.6_depositos_bazzar/MATRIZ_TIENDAS_MARCAS_TIPO_V2.md)  
Dual ramo + UX confecciones: [DEPOSITO_DUAL_RAMO_CALZADO_CONFECCIONES.md](./DEPOSITO_DUAL_RAMO_CALZADO_CONFECCIONES.md)

---

## Índice numérico dual (654 calzado · 638 confecciones)

**Ley holding:** el CSV trae códigos del proveedor (texto o bigint); la operación **solo** usa FK Nexus (`linea_id`, `referencia_id`, `material_id`, `color_id`). Lookup en catálogo:

```sql
SELECT id FROM linea
WHERE proveedor_id = :pid AND codigo_proveedor = :codigo;
```

| Ramo | `proveedor_id` | `tipo_v2_id` | Molécula CSV | Índice catálogo |
|------|----------------|--------------|--------------|-----------------|
| **Calzado** | **654** | **1** | `7363-122` L-R numérico | L, R, material, color = bigint STYLE |
| **Confecciones** | **638** | **2** | `206276-K` · mat `K206276` | L numérico · ref **K→11** · mat/color según `codigos.py` |

**Clasificación automática:** `COD.GRUPO` 10–15 → confecciones; ref `-K` → confecciones; L-R numérico → calzado.

**Código:** `report/src/lib/depositos/pilar-proveedor-index.ts` · espejo Retail `confecciones_fk.py`.

**Matriz tienda:** adultos (2100) **solo calzado** · niños (2900) calzado 5–6 + confección 10–15. Confección en D1 adultos se **rechaza** (~595 uds en sdfm4708).

---

## Columnas del archivo

| CSV | Ejemplo | BD depósito |
|-----|---------|-------------|
| `CODIGO ARTICULO` | `7890015069160` | `codigo_barras` |
| `COD.ART.PROVEEDOR` | `7363-122` | `linea_codigo_proveedor` + `referencia_codigo_proveedor` |
| `COD.GRUPO` | `03` | agrupación comercial (hint marca · no FK directa) |
| `COD.MATERIAL` | `25830` | `excel_material_code` / `material_id` |
| `COD.COLOR` | `15745` | `excel_color_code` / `color_id` |
| `DESCRIPCION GRADA` | `Nø35` | `grada` → `35` |
| `LPN` | `260000` | `precio_unitario` (÷1000 → 260) |
| `S00_D1` | `1` | `cantidad` en tienda adultos |
| `S00_D2` | `0` | `cantidad` en guardado adultos |
| `S00_NINHOS` | `0` | `cantidad` en tienda niños |

**Molécula Bazzar:** línea + referencia + material + color + grada (talla abierta).

---

## Volumen sdfm4708 (análisis 2026-07)

| sdfm4708 (post-matriz · calzado adultos sin conf.) | Filas | Unidades |
|----------------------------------------------------|-------|----------|
| S00_D1 · 2100 tienda | 6.362 | 9.191 (solo calzado) |
| S00_D2 · 2100 guardado | 2.183 | 2.992 |
| S00_NINHOS · 2900 tienda | 5.092 | 6.286 (2.226 calz · 2.866 conf.) |

**CSV bruto (sin filtro matriz):** S00_D1 7.153 filas · 10.054 uds · S00_D2 3.214 · 4.263 · S00_NINHOS 5.115 · 6.322.

---

## Ratificación hub · lote 4708 (2026-06-28)

Import **REPLACE** en `/depositos-bazzar` · toggle **TIENDA** · batch `sdfm4708` · fecha **28/06/2026 21:47**.

| Tarjeta hub | Columna CSV | Tabla | Hub (saldo vivo) | Importadas | Vendido |
|-------------|-------------|-------|------------------|------------|---------|
| Fernando Adultos **2100** | `S00_D1` | `deposito_1_2100_tienda` | 9.185 uds calzado · 6.359 filas | 9.188 | 3 |
| Fernando Niños **2900** | `S00_NINHOS` | `deposito_1_2900_tienda` | 2.975 calz + 3.296 conf · 5.083 filas | 6.266 | 0 |

**Coherencia:** `9.188 − 3 vendido = 9.185` calzado adultos · lote en tarjeta = nombre archivo sin extensión · mismo ritual que `sdsm4708` / `sdpl4708` en San Martín / Palma.

CHUSAR: [CHUSAR_IMPORT_CSV_HIEDRA_VENENOSA.md](../../.claude/2_modulos/2.3_report/depositos/CHUSAR_IMPORT_CSV_HIEDRA_VENENOSA.md) · hub: [CHUSAR_HUB_TRES_ENTES_METRICAS.md](../../.claude/2_modulos/2.3_report/depositos/CHUSAR_HUB_TRES_ENTES_METRICAS.md)

---

## Import (reemplazo total por tabla)

1. Bloquea si hay bandeja POS `ABIERTA` en el `cliente_id` destino.
2. `DELETE FROM deposito_*` por cada tabla destino con filas CSV.
3. `INSERT` resolviendo FK pilares con **`proveedor_id` en JOIN** (654 vs 638 — nunca mezclar índices).
4. `tipo_v2_id` **1** calzado · **2** confecciones (no inferir solo desde marca).

```powershell
cd report
node scripts/import_bazzar_csv_deposito.mjs ..\sdfm4708.csv --dry-run
node scripts/import_bazzar_csv_deposito.mjs ..\sdfm4708.csv
```

---

## Relación con sync Retail

| Fuente | Cuándo |
|--------|--------|
| **Retail** (`registro_st_vt_rc_reposicion`) | Sync estándar Report · 6 tiendas |
| **CSV sdfm** | Carga directa Fernando · fuente POS export |

No mezclar en la misma operación. Tras import CSV, Operativa en `/depositos-bazzar/2100?tab=operativa` refleja el CSV.

**Mapa 3 entes:** [MAPA_CSV_ENTES_BAZZAR.md](MAPA_CSV_ENTES_BAZZAR.md) · Fernando detalle: abajo.

---

## Pendiente

- PASS piso formal ritual 4708 (tablet venta prueba · checklist §10 integración).
- Chooser tablet: primera rama confecciones (`tipo_v2=2`) en cadena tono — UI pendiente.

---

**Shibboleth:** Chayanne el mejor
