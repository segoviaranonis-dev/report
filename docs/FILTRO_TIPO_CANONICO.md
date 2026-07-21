# Filtro canónico «Tipo»

Ver memoria holding:
- `.claude/2_modulos/2.3_report/gestion_compra/CHUSAR_REPOSICION_SIDEBAR_MULTISELECT_TONO.md` §4
- `.claude/2_modulos/2.2_rimec_web/CHUSAR_FILTRO_TIPO_HERMANOS_SIAMESES_20260720.md` (**2.2.1.18**)

Módulo: `report/src/lib/filtros/filtro-tipo-canonico.ts`  
Paridad Web: `rimec-web/lib/filtros/filtro-tipo-canonico.ts`

| Opción | Regla |
|--------|--------|
| Todos | `tipoGrupos` vacío |
| Normal | `ACT-BRSPORT` · `BR-VZ-MD-MKA-O` · alias `BR-VZ-MD-ML-MKA-O` |
| Carteras | `CARTERAS` |
| Promo | `PROMOCIONAL` · **`es_promo`** · cadena `PROMOCIONAL` (gana sobre caso Normal) |
| Liquidación | `es_liquidacion` / `cadena_comercial=LIQUIDACION` |

Prioridad: **LIQ > Promo > Carteras/Normal**.

Posición UI: Categoría → AB-CR → Marca → **Tipo** → …
