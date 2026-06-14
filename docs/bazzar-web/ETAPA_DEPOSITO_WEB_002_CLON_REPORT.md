# ETAPA DEPOSITO-WEB-002 — Clon funcional en Report

**Estado:** IMPLEMENTADO  
**Ruta:** `/bazzar-web/deposito-web`  
**Gemelo Streamlit:** `control_central/modules/deposito_web/`

## Portado

| Función Streamlit | Report |
|-------------------|--------|
| `get_resumen_web()` | `src/lib/bazzar-web/deposito-web/queries.ts` |
| `get_stock_web()` | idem |
| UI acordeón por marca + pivot tallas | `DepositoWebClient.tsx` |
| API | `GET /api/bazzar-web/deposito-web` |

## Fuente de datos (igual que Streamlit)

Stock desde movimientos **`INGRESO_COMPRA`** confirmados en **`ALM_WEB_01`** (id=1), join `traspaso` por `documento_ref` para marca en `snapshot_json`.

**Nota:** No usa `v_stock_web` (esa vista resta `VENTA_WEB`). Depósito Web Streamlit muestra ingresos confirmados; catálogo público usa `v_stock_web`.

## Paridad UI

- Métricas: artículos disponibles, pares en depósito
- Acordeón por marca → tabla Línea / Ref / Material / Color / Stock
- Sub-acordeón desglose por talla (pivot o tabla plana fallback)
