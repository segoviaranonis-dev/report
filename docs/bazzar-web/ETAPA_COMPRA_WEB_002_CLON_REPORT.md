# ETAPA COMPRA-WEB-002 — Clon funcional en Report

**Estado:** IMPLEMENTADO (2026-06-10)  
**Ruta:** `/bazzar-web/compra`  
**Gemelo Streamlit:** `control_central/modules/compra_web/`

## Portado

| Capa | Archivo Report |
|------|----------------|
| Queries | `src/lib/bazzar-web/compra-web/queries.ts` |
| Mutación TX | `src/lib/bazzar-web/compra-web/mutations.ts` |
| API lista | `GET /api/bazzar-web/compra/traspasos` |
| API detalle | `GET /api/bazzar-web/compra/traspasos/[id]` |
| API confirmar | `POST /api/bazzar-web/compra/traspasos/[id]/confirmar` |
| UI | `src/app/bazzar-web/compra/components/CompraWebClient.tsx` |

## Paridad Streamlit

- Filtro estado: TODOS / ENVIADO / CONFIRMADO / BORRADOR
- **Solo cliente 5000** (ETAPA-003) — ver `ETAPA_COMPRA_WEB_003_CLIENTE_5000.md`
- Métricas: Traspasos, Listos p/ Recibir, Confirmados
- Cards traspaso + detalle + FI card + legacy 5 pilares + vista técnica
- `procesar_ingreso_bazar`: misma transacción (movimiento INGRESO_COMPRA + detalle + traspaso CONFIRMADO)

## Requisito servidor

`DATABASE_URL` en `.env.local` / Vercel (misma BD que Nexus Streamlit).
