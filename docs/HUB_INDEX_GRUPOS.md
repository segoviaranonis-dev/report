# Hub Report — tres grupos (RIMEC · BAZZAR · BAZZAR WEB)

**Fuente única código:** `src/lib/report/hub-modules.ts`  
**UI:** `src/app/page.tsx` (acordeones) · `src/components/report/NexusHeaderZen.tsx` (header)

---

## Regla

El índice **nunca mezcla** entes en un solo acordeón. Tres categorías operativas + recursos documentales aparte.

| Grupo | Ente | Módulos Report | Códigos Moria |
|-------|------|----------------|---------------|
| **RIMEC** | Importadora | Ventas, Ventas+Fotos, Aprobaciones, Pilares, RRHH, **Proceso importación** | 2.3.1.1–2.3.1.7 |
| **BAZZAR** | Tiendas físicas | Stock/Retail, Depósitos, Tablet | 2.3.2.x |
| **BAZZAR WEB** | E-commerce | Compra, Depósito Web, Precio WEB, Stock Sano | 2.3.3.x · `/bazzar-web/*` |
| *Recursos* | Documentación | Anexo, Índice Bazzar Web doc | — |

### Jerarquía Proceso de importación (2.3.1.7)

| Código | Ruta | Notas |
|--------|------|-------|
| 2.3.1.7 | `/proceso-importacion` | Hub proceso |
| 2.3.1.7.1 | `/proceso-importacion/motor-precios` | Motor de precios |
| 2.3.1.7.1.1 | `…/motor-precios/biblioteca` | Histórico biblioteca |
| 2.3.1.7.1.2 | `…/motor-precios/biblioteca/nueva` | Crear biblioteca |
| 2.3.1.7.2 | `/proceso-importacion/motor-precios/importacion-precios` | Excel → precio_lista (hijo motor · en desarrollo) |

Rutas canónicas en `src/lib/report/routes.ts`. Legacy `/motor-precios/*` redirige en middleware.

**No confundir:** Motor de precios RIMEC (`/proceso-importacion/motor-precios`) ≠ Motor precio WEB (`/bazzar-web/motor-precio`).

---

## Mantenimiento

Al agregar módulo: editar **solo** `hub-modules.ts` con `group` correcto. No duplicar listas en page/header.

## Navegador Moria (puerto 3004)

El portal **`nexus-navegador-holding`** en `http://localhost:3004/modulos/report` usa la misma regla de tres entes.

| Archivo | Rol |
|---------|-----|
| `nexus-navegador-holding/config/arbol-modulos.json` | Árbol 2.3.1 RIMEC anidado |
| `nexus-navegador-holding/src/lib/sidebar-modulos.ts` | Sidebar recursivo |

**No confundir** `:3004/modulos/report` (Moria) con `:3000/` (app Report desplegada).

---
