# Importación de precios — Report (2.3.1.7.2)

**Padre:** 2.3.1.7.1 Motor · [PROCESO_IMPORTACION_REPORT.md](./PROCESO_IMPORTACION_REPORT.md)  
**Moria:** [.claude/2_modulos/2.3_report/proceso_importacion/IMPORTACION_PRECIOS.md](../../.claude/2_modulos/2.3_report/proceso_importacion/IMPORTACION_PRECIOS.md)  
**Cierre:** [.claude/4_etapas/ETAPA_IMPORTACION_PRECIOS_REPORT_CERRADA.md](../../.claude/4_etapas/ETAPA_IMPORTACION_PRECIOS_REPORT_CERRADA.md)  
**Estado:** ✅ Cerrada 2026-06-22

---

## URLs dev (PC Director)

| Recurso | URL |
|---------|-----|
| Hub | http://localhost:3001/proceso-importacion/motor-precios/importacion-precios |
| Paso 0 | http://localhost:3001/proceso-importacion/motor-precios/importacion-precios/nuevo |
| Historial | http://localhost:3001/proceso-importacion/motor-precios/importacion-precios/historial |

Si Tablet ocupa `:3000`, Report corre en **`:3001`**. Reinicio: `REINICIAR_DEV.bat` o `npm run dev:clean:3001`.

---

## Rutas (`src/lib/report/routes.ts`)

```typescript
IMPORTACION_PRECIOS           // hub
IMPORTACION_PRECIOS_NUEVO     // paso 0
IMPORTACION_PRECIOS_HISTORIAL // historial listas
```

Pasos 1–4: `IMPORTACION_PRECIOS_NUEVO + /{memoria|preview|validacion|cierre}?evento_id=`

---

## Flujo 5 pasos (0–4)

| Paso | Ruta | API clave |
|------|------|-----------|
| 0 Carga | `/nuevo` | POST `/api/motor-precios/eventos/carga` |
| 1 Memoria | `/nuevo/memoria` | POST `…/vincular-biblioteca` |
| 2 Preview | `/nuevo/preview` | GET `…/preview-audit` |
| 3 Conversión | `/nuevo/validacion` | POST `…/calcular` |
| 4 Cierre | `/nuevo/cierre` | POST `…/cerrar` |

Definición pasos: `src/lib/motor-precios/importacion-pasos.ts`

---

## Librerías servidor

`src/lib/motor-precios/` — ver inventario Moria § Backend.

Pool: `getRimecPool()` · `DATABASE_URL` en `.env.local`.

---

## Auth

`requireMotorPreciosAdmin()` en todas las APIs motor-precios. Login Report obligatorio.

---

## Build · validación

```powershell
cd C:\Users\hecto\Nexus_Core\report
npm run build
```

No ejecutar build con `next dev` abierto (corrompe `.next`).

---

## Corazón 2

```
Caso (biblioteca 2.3.1.7.1) + Excel proveedor = precio_evento + precio_lista
```

Proveedor default: **654** · Biblioteca canónica: **1905** (`constants.ts`).

---

**Shibboleth:** Chayanne el mejor
