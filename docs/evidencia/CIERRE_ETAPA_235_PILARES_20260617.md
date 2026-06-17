# Evidencia cierre — Etapa 2.3.5 Administrador Pilares (Report)

**Fecha:** 2026-06-17  
**Director:** Chusar  
**Maratón:** Etapa 1 de Report · 2/5  
**Estado:** ✅ CERRADA · deploy Vercel vía push `main`

---

## Smoke checklist (post-deploy)

| # | Prueba | Esperado |
|---|--------|----------|
| 1 | Login RIMEC Admin (`rol_id=1`) | Acceso `/pilares` |
| 2 | Login VENDEDOR / BAZZAR | 403 / redirect home |
| 3 | `/pilares` hub | Tarjetas Líneas + L×R · selector 654/638 |
| 4 | `/pilares/lineas` | Filtros chip · guardar marca/género fila |
| 5 | `/pilares/linea-referencia` | Filtro Estilo=Otros → marcas atenuadas salvo involucradas |
| 6 | Buscador multi-línea | Grilla filtra por códigos elegidos |
| 7 | Editor rango 1122–1184 + estilo | PATCH ok · filas actualizadas |
| 8 | Tablet / RIMEC Web refresh catálogo | Header refleja cambio sin re-import |

---

## Archivos entregados (repo `report`)

```
src/app/pilares/
  page.tsx, lineas/page.tsx, linea-referencia/page.tsx
  components/  (Hub, Lineas, L×R, Filtros, Editor, Buscador, …)
src/app/api/pilares/
  lineas/route.ts, lineas/codigos/route.ts
  linea-referencia/route.ts, maestras/route.ts
src/lib/pilares/
  queries.ts, types.ts, constants.ts, auth-api.ts
middleware.ts · src/middleware.ts  (/pilares matcher)
src/app/page.tsx                   (tarjeta home)
docs/ADMINISTRADOR_PILARES.md
docs/EVIDENCIA_SESION_PILARES_TRIANGULO_20260616.md
docs/evidencia/CIERRE_ETAPA_235_PILARES_20260617.md
```

---

## APIs — contrato resumido

### GET `/api/pilares/linea-referencia`

Query: `tipo_v2_id`, `marca`, `estilo_id`, `tipo_1_id`, `linea_codigos` (csv), `limit`, `offset`  
Response: `{ rows, total, cascada: { marcas, estilos, tipos1, lineas } }`

### PATCH `/api/pilares/linea-referencia`

| Modo | Body |
|------|------|
| Fila | `{ id, grupo_estilo_id?, tipo_1_id? }` |
| Rango | `{ rango: true, desde, hasta, genero_id?, grupo_estilo_id?, tipo_1_id? }` |
| Scope | `{ scope: true, marca?, estilo_id?, tipo_1_id?, … }` |
| Líneas | `{ lineas: string[], … }` |

---

## Build local

```text
npm run build  → ✓ Compiled successfully (Next.js 15.5.18)
```

---

## Doc holding

- `.claude/4_etapas/ETAPA_ADMINISTRADOR_PILARES_REPORT_CERRADA.md`
- `.claude/4_etapas/ACTUAL.md` — 2.3.5 → últimas cerradas

---

**Sales Report:** no modificado · blindado.
