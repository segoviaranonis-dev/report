# Las 8 tablas del informe de ventas — guía para diseño

Este documento describe **las ocho superficies de datos** del Sales Report (Streamlit hoy, Next.js mañana) en el **orden que usa dirección**: qué muestran, cómo se agrupan y qué debe poder ver el usuario sin perder contexto.

---

## Convención de numeración (oficial)

| Nº | Ubicación en la app | Nombre funcional |
|----|---------------------|------------------|
| **1** | Pestaña **Dashboard** | Evolución **semestral / mensual** |
| **2** | Pestaña **Clientes** | Cartera — **crecimiento** |
| **3** | Pestaña **Clientes** | Cartera — **riesgo** (decrecimiento) |
| **4** | Pestaña **Clientes** | Cartera — **sin compra** reciente *(en reuniones a veces se habla de “oportunidad” de recupero; en código es `sin_compra`)* |
| **5** | Pestaña **Marcas** | Ranking de marcas |
| **6** | Pestaña **Marcas** | Matriz detallada de marcas |
| **7** | Pestaña **Vendedores** | Ranking de vendedores |
| **8** | Pestaña **Vendedores** | Gestión detallada (jerarquía profunda) |

En código Streamlit: la tabla **1** es `pkg['evolucion']`; las **2–4** son `pkg['cartera']['crecimiento'|'decrecimiento'|'sin_compra']`; **5–6** son `pkg['marcas'][0]` y `pkg['marcas'][1]`; **7–8** son `pkg['vendedores'][0]` y `pkg['vendedores'][1]`.

**Alineación de nombres (dirección vs código):** en pantalla hoy el orden de las tres tablas de Clientes es **Crecimiento → Riesgo → Sin compra**. Si en dirección decís **“oportunidad”** para una de las tres, conviene **fijar en una línea** si equivale a **Sin compra** (objetivo sin venta) u otra regla, para que diseño y desarrollo usen el mismo término en copy y leyendas.

---

## Tabla 1 — Evolución semestral / mensual (Dashboard)

**Para qué sirve:** ver el **ritmo en el tiempo** del universo filtrado: objetivo vs real y variación **por mes**, con etiqueta de **semestre** (1er / 2do) para lectura gerencial.

**Agrupación en datos:** una fila por **`mes_idx`** (agregación simple). La columna **Semestre** es derivada (no es un segundo nivel de `groupby` en Python).

**Columnas típicas:** Semestre, Mes, Monto Obj, Monto 26, Variación %.

**Subtotales:** en Streamlit la grilla puede agrupar por **Semestre** para mostrar bloques; el **total** del período suele leerse en KPIs globales más arriba.

**Notas de diseño:** ideal para **sparkline** o mini-serie detrás del KPI de variación global; meses sin actividad pueden mostrar 0 y variaciones extremas — conviene criterio visual (gris / “sin movimiento”) sin contradecir el número si dirección pide paridad.

---

## Tabla 2 — Clientes en crecimiento (Clientes)

**Para qué sirve:** clientes (y desglose cadena/marca si aplica) donde **hay venta actual** y la **variación % ≥ 0** frente al objetivo.

**Agrupación:** `cliente` + `cadena` y `marca` **si existen** en el pivot (hasta **tres claves** en el `groupby`). Jerarquía en pantalla vía **`_path`**: típicamente **Cadena → Cliente → Marca** (con reglas si “cadena” es placeholder).

**Columnas típicas:** Cadena, Cliente, Marca (ocultas en árbol si se usa `treeData`), Monto Obj, Monto 26, Variación %, `_path` oculto.

**Subtotales:** AgGrid con **treeData** + pies de grupo: montos en **suma**; **Variación %** en nodos intermedios recalculada desde **sumas** de hijos (no promedio de porcentajes).

**Notas de diseño:** semáforo verde coherente con “crecimiento”; **sticky** de cabeceras recomendable en listas largas.

---

## Tabla 3 — Clientes en riesgo (Clientes)

**Para qué sirve:** mismas dimensiones que la tabla 2, pero solo filas con **venta actual > 0** y **variación % < 0** (objetivo cumplido por debajo).

**Agrupación y columnas:** iguales en estructura a la **tabla 2**; cambia solo el **subconjunto** de negocio.

**Notas de diseño:** lectura de **alerta** (rojo / ámbar) sin mezclar emocionalmente con la tabla 2; mismo patrón de árbol y subtotales.

---

## Tabla 4 — Sin compra reciente (Clientes)

**Para qué sirve:** clientes con **Monto 26 = 0** pero **Monto Obj > 0** (había expectativa u oportunidad y no se materializó venta en el período filtrado).

**Agrupación:** misma lógica de **cliente (+ cadena + marca)** que 2 y 3.

**Notas de diseño:** tono **neutro o gris** (no es “malo” en el mismo sentido que riesgo con venta caída); puede convivir en una **cartera unificada** con prefijo de estado en el árbol (como hace Streamlit al ampliar cartera completa).

---

## Tabla 5 — Ranking de marcas (Marcas)

**Para qué sirve:** **quién vende más** en el universo filtrado: una fila por **marca**, orden descendente por monto real.

**Agrupación:** **un solo nivel** — `marca`.

**Columnas típicas:** Marca, Monto Obj, Monto 26, Variación %.

**Subtotales:** tabla plana; total general al pie si aplica.

**Notas de diseño:** buen candidato a **barras horizontales** o ranking visual; pocas columnas → densidad alta en móvil/tablet.

---

## Tabla 6 — Matriz detallada de marcas (Marcas)

**Para qué sirve:** bajar de **marca** al detalle: **cadena, cliente, vendedor** (los que existan en datos), con montos y variación por **combinación**.

**Agrupación en datos:** desde **marca** hasta **1 + N** niveles: mínimo `marca`; se añaden `cadena`, `cliente`, `vendedor` si están en columnas.

**Jerarquía UI:** `_path` tipo **Marca → Cadena → Cliente → Vendedor** (segmentos con `|||`).

**Subtotales:** como en tablas 2–4: suma en dinero/cantidad; % recalculado en agrupaciones.

**Notas de diseño:** **BATCH PDF** por marca en Streamlit; diseño debe prever **export por rama** o vista ampliada sin perder columnas.

---

## Tabla 7 — Ranking de vendedores (Vendedores)

**Para qué sirve:** comparar **vendedores** por desempeño agregado en el filtro actual.

**Agrupación:** **un solo nivel** — `vendedor`.

**Columnas típicas:** Vendedor, Monto Obj, Monto 26, Variación %, y si el pivot trae cantidades: Cant. Obj, Cant. 2026, Cant. V. %.

**Subtotales:** pie de tabla / total.

**Notas de diseño:** paralela conceptual a la tabla 5 (ranking limpio antes del detalle profundo).

---

## Tabla 8 — Gestión detallada de vendedores (Vendedores)

**Para qué sirve:** la vista **operativa máxima**: misma información agregada que importa a dirección, pero desglosada en **árbol de cinco niveles** cuando los datos lo permiten:

1. **Vendedor**  
2. **Cadena**  
3. **Cliente**  
4. **Marca**  
5. **Mes**

**Agrupación en datos:** un `groupby` con `vendedor` + dimensiones opcionales + **`mes_idx`** (luego **Mes** legible).

**Jerarquía UI:** `_path` = esos niveles unidos por `|||`; columna visible **«ESTRUCTURA DE ANÁLISIS»**; el resto de dimensiones de texto suele **ocultarse** porque ya están en el árbol.

**Subtotales:** generados por la grilla (no son filas extra en el DataFrame Python): **suma** en montos/cantidades; **variación %** por **recomposición** desde sumas de hijos; caso **sin objetivo** → tratamiento **∞** en UI.

**Notas de diseño:** aquí más que nunca **sticky headers**, scroll horizontal si hay muchas columnas, **AMPLIAR** y **BATCH PDF** por vendedor; densidad alta — la diseñadora puede proponer **panel lateral** o **drill** en Next sin reducir el contrato de datos.

---

## Resumen en una frase por tabla (para copy de UI)

| Nº | Frase |
|----|--------|
| 1 | Cómo evoluciona el negocio **mes a mes** y por **semestre**. |
| 2 | Dónde el cliente **está arriba** del objetivo con venta. |
| 3 | Dónde el cliente **vende pero por debajo** del objetivo. |
| 4 | Dónde **debería haber vendido** (objetivo) y **no hubo** venta. |
| 5 | **Ranking** de quién es la marca que más factura. |
| 6 | **Cómo se reparte** cada marca en cadenas, clientes y vendedores. |
| 7 | **Ranking** de vendedores en el período. |
| 8 | **Operación fina**: del vendedor al **mes**, pasando por cadena, cliente y marca. |

---

## Coherencia global para la diseñadora

- Las **ocho** tablas leen el **mismo universo filtrado** (misma consulta base + mismo `objetivo_pct` aplicado a filas).
- **Tablas 1, 5 y 7** son vistas más **“agregadas / resumen”**.  
- **Tablas 2–4 y 6–8** combinan **jerarquía** y/o **más dimensiones**; las **6 y 8** son las más densas para UI y exportación.
- Donde hay **árbol**, los **subtotales de %** deben diseñarse como **derivados de totales**, no como promedio de porcentajes de hijos.

---

*Numeración alineada a la convención de dirección. Contrato técnico: `modules/sales_report/logic.py` + `ui.py` (Streamlit).*
