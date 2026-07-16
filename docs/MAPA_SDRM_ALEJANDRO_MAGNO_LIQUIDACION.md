# Mapa SDRM → Pilares → Alejandro Magno (PE)

> Batch referencia: `sdrm0849` · Excel Kyly 638 + Beira 654  
> Migración: `report/migrations/163_alejandro_magno_comercial_ppd.sql`

## Columnas Excel (fila 0)

| Col | Nombre xlsx | Uso |
|-----|-------------|-----|
| F | TIPO0 | **Género** Kyly 638 |
| G | TIPO1 | **Temporada** Kyly 638 · **LIQUIDACIÓN** Beira 654 |
| H | TIPO2 | **LIQUIDACIÓN** Kyly 638 |

## Género — Kyly 638 (col F)

| Excel | Pilares `genero.codigo` | `linea.genero_id` |
|-------|-------------------------|-------------------|
| MASC / MASCULINO | NINOS | FK género |
| FEM / FEMENINO | NINAS | FK género |

**No** usar CABALLEROS/DAMAS en confecciones infantil Kyly.

Motor: `report/src/lib/pilares/sdrm-pilares-map.ts` → `SDRM_GENERO_TIPO0`.

## Temporada — Kyly 638 (col G)

| Excel TIPO1 | Pilares | UI cabecera |
|-------------|---------|-------------|
| VERANO | `tipo_1.descp_tipo_1 = VERANO` → `linea_referencia.tipo_1_id` | **Temporada** |
| INVIERNO | idem INVIERNO | **Temporada** |

Estilo (grupo_estilo): **pendiente Director** — el mapa no escribe estilo en lr para 638.

## LIQUIDACIÓN — regla crítica

| Proveedor | Ramo | Columna Excel | Campo derivado |
|-----------|------|---------------|----------------|
| **654** Beira | Calzados | **G · TIPO1** | `LIQUIDACION` en TIPO1 |
| **638** Kyly | Confecciones | **H · TIPO2** | `LIQUIDACION` en TIPO2 |

Resolución en import (`control_central/scripts/import_sdrm_comercial_xlsx.py`):

- `sdrm_articulo_comercial.es_liquidacion`
- `sdrm_articulo_comercial.cadena_comercial` (`LIQUIDACION` | `REGULAR` | …)

### Alejandro Magno — campos en PPD

Cada molécula PE (`pedido_proveedor_detalle`) recibe columnas propias:

| Columna PPD | Tipo | Origen |
|-------------|------|--------|
| `am_cadena_comercial` | text | SDRM xlsx |
| `am_es_liquidacion` | boolean | regla 654-G / 638-H |
| `am_temporada` | text | col G (638) o FK `tipo_1` post mapa |
| `am_cod_grupo` | text | COD.GRUPO |

Sync post mapa: `syncAmComercialPpd()` en `aplicar-mapa-sdrm.ts` y  
`report/src/lib/stock-pronta-entrega/sync-am-comercial-ppd.ts`.

Vista: `v_stock_pe_rimec` prioriza `ppd.am_*` sobre join SDRM.

## Filtros Panel Alejandro Magno (`/stock-pronta-entrega`)

| Filtro | Estado | Campo fila |
|--------|--------|------------|
| Género | `OperativaFilterState.generoIds` | `genero_id` (pilares) |
| Temporada | `tipo1Ids` | `tipo_1_id` / label VERANO·INVIERNO |
| **Liquidación** | `cadenaComercial = 'LIQUIDACION'` | `es_liquidacion` / `am_es_liquidacion` |
| Regular | `cadenaComercial = 'REGULAR'` | excluye liquidación |

Cabecera: fila **Comercial** en `TrianguloHeaderDeposito` (`showComercialFilter`).

Web catálogo `:3001`: `pe_catalogo_filtro_web` + barra `PeComercialWebFiltroBar` (sincroniza mismo argumento).

## Pipeline operativo

1. Import xlsx → `sdrm_articulo_comercial` + `sdrm_cod_grupo_dim`
2. Administrador Pilares → **Aplicar mapa SDRM** (638 tipo_v2=2)
3. Auto sync `am_*` en PPD
4. Panel PE: género · temporada · liquidación activos

CLI mapa: `npx tsx report/scripts/aplicar_mapa_sdrm_cli.ts sdrm0849 2`

Migración: `node report/scripts/aplicar_migracion_163.mjs`

## Archivos clave

- `report/src/lib/pilares/sdrm-pilares-map.ts`
- `report/src/lib/pilares/aplicar-mapa-sdrm.ts`
- `report/src/lib/stock-pronta-entrega/stock-pe-filters.ts`
- `report/src/lib/deposito-rimec/queries-productos-grilla.ts`
- `report/migrations/161_sdrm_comercial_cod_grupo.sql`
- `report/migrations/163_alejandro_magno_comercial_ppd.sql`
