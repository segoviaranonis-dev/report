# Vista Operativa Confecciones — Depósito Bazzar

**App:** Report `:3001` · pestaña Operativa · ramo **Confecciones**  
**CHUSAR maestro:** [CHUSAR_VISTA_OPERATIVA_CONFECCIONES.md](../../.claude/2_modulos/2.3_report/depositos/CHUSAR_VISTA_OPERATIVA_CONFECCIONES.md)  
**Estado:** ✅ UI filas · cantidades · montos · 2026-06-10

---

## Qué muestra

Stock confección (`tipo_v2_id = 2`) en **tabla por renglón** — una fila por molécula `L+R+material+color+talle`.

| Bloque | Contenido |
|--------|-----------|
| **Vitales** | Renglones filtrados · unidades totales · valor inventario (Σ uds × precio) |
| **Tabla** | Marca · Línea · Ref · Material · Color · Talle · **Uds · Precio · Subtotal** |
| **Pie tabla** | Subtotal uds y monto de la página actual |
| **Filtros** | Acordeón inferior — marca, línea, ref, color, talle, búsqueda |

Precio: columna `precio_unitario` del depósito (LPN CSV POS). Subtotal = `uds × precio`.

---

## Dónde abrir

| Tienda | URL ejemplo |
|--------|-------------|
| Fernando Niños 2900 | `/depositos-bazzar/2900?tab=operativa&ramo=confecciones` |
| San Martín Niños 2700 | `/depositos-bazzar/2700?tab=operativa&ramo=confecciones` |
| Palma única 3100 | `/depositos-bazzar/3100?tab=operativa&ramo=confecciones` |

Toggle **👕 Confecciones** en detalle depósito (solo tiendas con matriz confección).

---

## API

| Método | Ruta | Respuesta clave |
|--------|------|----------------|
| GET | `/api/depositos/[id]/operativa/confecciones` | `filas[]`, `total`, `total_uds`, `total_valor`, paginación |
| GET | `/api/depositos/[id]/operativa/confecciones/filtros` | dropdowns agregados |

Query: `categoria`, `marca_id`, `linea_id`, `referencia_id`, `color_id`, `grada`, `q`, `page`, `pageSize`, `sort=uds|linea`.

---

## Código

| Pieza | Ruta |
|-------|------|
| Tab UI | `src/app/depositos-bazzar/components/TabOperativaConfecciones.tsx` |
| Enrutado ramo | `src/app/depositos-bazzar/[cliente_id]/DepositoDetalleClient.tsx` |
| API tabla | `src/app/api/depositos/[cliente_id]/operativa/confecciones/route.ts` |
| API filtros | `src/app/api/depositos/[cliente_id]/operativa/confecciones/filtros/route.ts` |
| Precio / valor | `src/lib/depositos/precio-venta.ts` |

---

## Criterio Director

1. Ver **cantidades por talle** en filas, no chips ni cards calzado.
2. Ver **precio unitario** y **subtotal** por renglón.
3. Barra superior con **totales del filtro activo** (uds + Gs).
4. Orden default **uds ↓**; alternativa por línea.

---

**Shibboleth:** Chayanne el mejor
