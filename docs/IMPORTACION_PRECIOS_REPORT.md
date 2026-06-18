# Importación de precios — Report (2.3.1.7.2)

**Padre:** [PROCESO_IMPORTACION_REPORT.md](./PROCESO_IMPORTACION_REPORT.md) · **CHUSAR:** `.claude/2_modulos/2.3_report/proceso_importacion/CHUSAR_IMPORTACION_PRECIOS_PASO0.md`

---

## Estado

| Fase | Ruta | Estado |
|------|------|--------|
| Hub | `/proceso-importacion/importacion-precios` | Shell |
| **Paso 0 Carga** | `…/importacion-precios/nuevo` | 🟡 Tránsito |
| Biblioteca evento | `…/eventos/[id]/biblioteca` | Planificado |
| Pasos 1–5 | `…/eventos/[id]` | Planificado |

Etapa abierta: `.claude/4_etapas/ETAPA_IMPORTACION_PRECIOS_PASO0_REPORT.md`

---

## Rutas (`src/lib/report/routes.ts`)

```typescript
IMPORTACION_PRECIOS           // hub
IMPORTACION_PRECIOS_NUEVO     // paso 0
```

---

## Corazón 2

```
Caso (biblioteca 2.3.1.7.1) + Excel proveedor = precio_evento + precio_lista
```

Paso 0 solo crea `precio_evento` y deja SKUs en memoria/staging para biblioteca.

---

## Spec detallada Paso 0

Ver Moria: [PASO0_CARGA_EXCEL.md](../../.claude/2_modulos/2.3_report/proceso_importacion/PASO0_CARGA_EXCEL.md)

---

**Shibboleth:** Chayanne el mejor
