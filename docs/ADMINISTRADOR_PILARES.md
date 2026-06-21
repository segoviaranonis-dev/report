# Administrador de Pilares — Report

**Ruta:** `/pilares` · **Sección home:** RIMEC · **Acceso:** `rol_id = 1` (RIMEC Admin)  
**Etapa:** ✅ **2.3.5 CERRADA** 2026-06-17 — [ETAPA_ADMINISTRADOR_PILARES_REPORT_CERRADA.md](../../.claude/4_etapas/ETAPA_ADMINISTRADOR_PILARES_REPORT_CERRADA.md)  
**Sub-sesión tablet (triángulo):** `.claude/4_etapas/SUBSESION_TABLET_TRIANGULO_PILARES_20260616.md`  
**Estado:** ✅ **Producción Vercel** · `/pilares` operativo

---

## Norte estratégico

| Nivel | Objetivo |
|-------|----------|
| **General holding** | Abandonar Streamlit como lugar de edición operativa de pilares |
| **Específico módulo** | Administrador de pilares **multi-proveedor** en Report |
| **Motivo de salida del Motor** | Seguridad y confidencialidad: el Motor de Precios concentra listados, casos y aritmética comercial. Editar catálogo L/L×R **no debe** vivir ahí ni exponer ese contexto al operador de pilares |

**Principio:** mismo **dato** que hoy en Streamlit (`_render_admin_lineas` + `_render_linea_referencia`), **mejor UX** en Report, **sin** acceso al Motor.

---

## Qué es

Único lugar canónico en **Report** para mantener pilares operativos:

| Tabla | Qué se edita |
|-------|----------------|
| `linea` | `marca_id`, `genero_id`, descripción (cuando aplique) |
| `linea_referencia` | Par L×R — `grupo_estilo_id` (estilo), `tipo_1_id` (tipo 1) |
| `referencia` | Catálogo de códigos ref (lectura/alta perezosa vía import; no pantalla separada salvo diagnóstico) |

**No toca:** Sales Report (`registro_ventas_general_v2` blindado).

**Legacy (solo referencia de paridad):** `control_central/modules/rimec_engine/ui.py` → `_render_admin_lineas`, `_render_linea_referencia`.

---

## Dos proveedores — convivencia

Los pilares **comparten esquema**, se **particionan por `proveedor_importacion.id`** (selector obligatorio en UI).

| `tipo_v2_id` | Negocio | `proveedor_importacion` | Regla L / R |
|--------------|---------|-------------------------|-------------|
| **1** | Calzado Beira Rio | **654** | L+R numéricos STYLE (`1184.100`) · muchas refs por línea |
| **2** | Confecciones Kyly | **638** (alta en BD cuando import esté listo) | L alfanumérico · ref sintética **`K`** · **1 fila LR por línea** = estilo de esa línea |

**Contexto importación:** Tablet Bazzar + Retail están importando `tipo_v2 = 2`. Las líneas entran en **alta perezosa** (marca/género/estilo NULL). Este módulo es donde el operador **completa** dimensiones después del import — para **ambos** proveedores en la misma app, cambiando selector.

Doc confecciones: [CONFECCIONES_TIPO_V2_2.md](../../.claude/3_arquitectura/3.2_venta_tienda/CONFECCIONES_TIPO_V2_2.md)  
Laboratorio multi-proveedor: [multi_proveedor.md](../../.claude/3_arquitectura/3.2_venta_tienda/multi_proveedor.md)

---

## Paridad funcional con Streamlit (obligatoria)

Todo lo que el operador ve hoy en Motor → pestañas **Administración de Líneas** y **Línea × Referencia** debe existir en Report (mejor presentado).

### Pestaña Líneas (`_render_admin_lineas`)

| Función Streamlit | Destino Report |
|-------------------|----------------|
| Selector **proveedor** | Tabs o select superior — 654 / 638 |
| Filtros **marca**, **género** | Filtros persistentes en URL o state |
| Grilla líneas con marca/género | Tabla editable + búsqueda por código |
| **Editar género por rango** de código línea | Mismo flujo, confirmación |
| **Reaplicar FK** desde último listado cerrado | Botón avanzado (solo 654 mientras exista listado Motor) — API server-side |
| **Solo Ley de género** desde listado | Idem, desacoplado de UI Motor |
| Import Excel linea + LR | **Fase posterior** o CLI; no bloquear MVP grilla |

### Pestaña L×R (`_render_linea_referencia`)

| Función Streamlit | Destino Report |
|-------------------|----------------|
| Filtros **marca**, **estilo**, **tipo 1** | Mismos filtros; **sin** hardcode `proveedor_id = 654` |
| Grilla hasta **200 filas** + total | Paginación o virtual scroll; mostrar total filtrado |
| Edición **por lote** estilo / tipo_1 | Checkboxes + aplicar a selección |
| Edición **fila a fila** | Inline o modal |
| Confecciones | Misma grilla; filas `(linea, K)` visibles con badge tipo_v2 |
| *(mejora 2026-06-19)* | Columna **miniatura** entre Ref y Marca — primer calzado L×R en retail staging |

**Mejoras UX (sin perder datos):** búsqueda por código, contador de NULLs, indicador “pendiente enriquecer”, separación visual calzado vs confecciones, **thumb 48px** vía `ProductThumbFrame`.

### Miniatura L×R (2.3.5.2 · 2026-06-19)

| Aspecto | Detalle |
|---------|---------|
| **Objetivo** | Identificar visualmente el par línea+referencia mientras se edita estilo/tipo 1 |
| **Fuente datos** | `registro_st_vt_rc_reposicion` — primera fila con match exacto L+R (prioriza `imagen_nombre`) |
| **Resolución URL** | `productImageCandidatesForRow` — Excel → molécula L-R-M-C → stem L-R |
| **API** | GET `/api/pilares/linea-referencia` enriquece cada fila con `thumb: { imagen_nombre, material_code, color_code } \| null` |
| **Query SQL** | `loadPrimeraImagenLineaReferencia` en `src/lib/pilares/queries.ts` |
| **Componente** | `LineaReferenciaAdminClient.tsx` · columna entre Ref y Marca |

CHUSAR: `.claude/2_modulos/2.3_report/pilares/CHUSAR_ADMINISTRADOR_PILARES.md`

---

## Arquitectura Report

**Códigos Moria UI:** 2.3.5 hub · 2.3.5.1 líneas · 2.3.5.2 L×R

```
/pilares                          — 2.3.5
├── page.tsx                      — shell + auth rol_id=1
├── lineas/page.tsx               — 2.3.5.1
├── linea-referencia/page.tsx     — 2.3.5.2
├── components/
│   ├── LineasAdminClient.tsx
│   ├── LineaReferenciaAdminClient.tsx  — tabla + thumb L×R
│   └── PilaresLineaReferenciaFiltrosBar.tsx
└── lib/pilares/
    ├── types.ts                  — LineaReferenciaThumb
    └── queries.ts                — loadPrimeraImagenLineaReferencia + SQL L/L×R

/api/pilares/
├── lineas/route.ts               — GET lista + PATCH rango / fila
├── linea-referencia/route.ts     — GET (+ thumb batch) + PATCH
├── maestras/route.ts             — marca_v2, genero, grupo_estilo, tipo_1
└── sync-listado/route.ts         — reaplicar FK (654, opcional fase 3)
```

**Leyes:** FK canónicas P0 · `codigo_proveedor` bigint · joins `linea_id` / `referencia_id` — ver `RIMEC_NOMENCLATURA_PILARES.md`.

---

## Triángulo del header (propagación instantánea)

Ediciones en `/pilares` alimentan **en vivo** el header/filtros de catálogo en RIMEC Web y Tablet Bazzar.

| Vértice | Tabla | Editado en |
|---------|-------|------------|
| Género | `linea.genero_id` | `/pilares/lineas` |
| Marca | `linea.marca_id` | `/pilares/lineas` |
| Estilo | `linea_referencia.grupo_estilo_id` | `/pilares/linea-referencia` |
| Tipo 1 | `linea_referencia.tipo_1_id` | `/pilares/linea-referencia` |

**Doc canónica:** [TRIANGULO_HEADER_PILARES.md](../../.claude/3_arquitectura/3.2_venta_tienda/TRIANGULO_HEADER_PILARES.md)

| Canal | Mecanismo | Re-sync retail |
|-------|-----------|----------------|
| RIMEC Web | `atributosLinea.ts` sobre `v_stock_rimec` | No |
| Tablet cadena | JOIN pilares en `catalogo-sql.ts` | No |
| Sales Report | Blindado | — |

Tras **Guardar** en pilares, el próximo refresh del catálogo refleja marca/género/estilo sin re-import depósito.

---

## Seguridad y roles

| Regla | Detalle |
|-------|---------|
| Acceso pantalla | `rol_id = 1` |
| APIs | Mismo gate + sesión Report |
| Middleware | `/pilares` en `ROLE_ROUTES` **y** en `matcher` |
| Motor Streamlit | Tras paridad validada → pestañas legacy **solo lectura** o retiradas (OT aparte) |

Operador de pilares **no** necesita entrar al Motor → no ve listados, casos ni precios.

---

## Fases de entrega

| Fase | Entregable | Estado |
|------|------------|--------|
| **0** | Doc + etapa + placeholder `/pilares` | ✅ |
| **1** | Hub + APIs + UI Líneas/L×R + acordeón datos generales | ✅ |
| **1b** | Triángulo header doc + paridad Tablet JOIN pilares | ✅ (2026-06-16) |
| **1c** | Filtros chip · cascada marcas · buscador multi-línea · editor rango | ✅ (2026-06-17) |
| **1d** | Miniatura L×R en grilla (retail staging + ProductThumbFrame) | ✅ (2026-06-19) |
| **2** | Deploy commit + matcher middleware prod | ✅ (2026-06-17) |
| **3** | QA paridad Streamlit + género por rango UI Líneas | ⬜ post-cierre |
| **4** | Sync listado / ley género (654) vía API | ⬜ |
| **5** | Cierre etapa 2.3.5 | ✅ (2026-06-17) |

**Evidencia cierre:** [evidencia/CIERRE_ETAPA_235_PILARES_20260617.md](./evidencia/CIERRE_ETAPA_235_PILARES_20260617.md)  
**Evidencia sesión:** [EVIDENCIA_SESION_PILARES_TRIANGULO_20260616.md](./EVIDENCIA_SESION_PILARES_TRIANGULO_20260616.md)

---

## Prohibido en esta etapa

- Tocar Sales Report histórico
- Migraciones masivas de pilares sin OT
- Import retail Kyly masivo (sigue en Tablet/Retail)
- Duplicar lógica de precios / `precio_lista` / casos en Report

---

## Índice documentación

| # | Doc |
|---|-----|
| 1 | Este archivo |
| 2 | `.claude/2_modulos/2.3_report/pilares/CHUSAR_ADMINISTRADOR_PILARES.md` |
| 3 | `.claude/2_modulos/2.3_report/pilares/INDICE.md` |
| 4 | `.claude/4_etapas/ETAPA_ADMINISTRADOR_PILARES_REPORT.md` |
| 5 | `.claude/2_modulos/2.3_report/INDICE.md` § Pilares |
| 6 | `CONFECCIONES_TIPO_V2_2.md` |
| 7 | `multi_proveedor.md` |
| 8 | `MIGRACION_STREAMLIT_REPORT.md` |
| 9 | `control_central/docs/RIMEC_NOMENCLATURA_PILARES.md` |

---

**Shibboleth:** 7 años
