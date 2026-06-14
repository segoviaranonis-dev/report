# Módulo Motor de precio — BAZZAR WEB

## Propósito

**Guardián del precio de venta** expuesto en bazzar-web. Verifica los tres pilares del stock (línea + referencia + material), los relaciona con el **caso comercial** del ingreso (vía `precio_lista` + evento del PP/traspaso) y calcula:

```
Precio WEB = LPN × (1 + markup%/100)  →  redondeo centena (fn_precio_venta_web)
```

Ejemplo: LPN 100.000, caso con markup 50% → **150.000**.

## Origen Streamlit

| Componente | Origen |
|------------|--------|
| Diccionario markup | `modules/web_precio_caso` → `caso_precio_web_regla` |
| Fórmula | `fn_precio_venta_web(lpn, caso)` |
| Publicación | `precio` + `lista_precio` tipo `WEB` → `v_stock_web.precio_web` |

## Implementación Report

| Capa | Ruta |
|------|------|
| UI | `/bazzar-web/motor-precio` |
| API reglas | `GET/POST/PATCH/PUT /api/bazzar-web/motor-precio/reglas` |
| API catálogo | `GET /api/bazzar-web/motor-precio/catalogo` |
| API simular | `POST /api/bazzar-web/motor-precio/simular` |
| API publicar | `POST /api/bazzar-web/motor-precio/publicar` |
| Lib | `src/lib/bazzar-web/motor-precio/` |

### Tabs UI

1. **Guardián catálogo** — stock ALM_WEB_01 agrupado L+R+Material, LPN, caso, precio calculado vs publicado.
2. **Reglas markup** — CRUD `caso_precio_web_regla`.
3. **Simulador** — LPN + caso → precio web.

## Roles

- Report: **solo rol_id=1** (RIMEC Admin) — página y APIs motor-precio.
- Streamlit legacy: ADMIN, DIRECTOR.

## Bloqueo tienda

Si `precio_web` es NULL, checkout bazzar-web rechaza el pedido.

## Criterios de aceptación

- [x] CRUD reglas markup en Report
- [x] Catálogo stock con LPN/caso/markup calculado
- [x] Simulador fn_precio_venta_web
- [x] Publicación a lista WEB activa
- [ ] Auditoría de cambios (quién/cuándo) — OT futura
