# Módulo Report (RIMEC / Sales Report en Next.js) — Leyes generales de diseño

Este documento alinea al equipo (dirección, diseño y desarrollo) sobre **qué es el módulo**, **qué libertad hay** y **cómo responder preguntas técnicas** sin perder de vista el producto.

---

## Alcance del trabajo en `report`

- **Origen funcional:** el informe **Sales Report** de Streamlit (Python): mismas reglas de negocio, mismos filtros y mismas tablas de lectura sobre datos corporativos.
- **Destino técnico:** aplicación **Next.js** en este repo (`/rimec` y APIs bajo `/api/rimec/*`).
- **Contrato con dirección:** mostrar **la misma información** que en Streamlit.
- **Contrato de diseño:** **libertad total de presentación** (layout, color, motion, tipografía, componentes, gráficos). No estamos obligados a copiar la UI de Streamlit; sí a no mentir con los datos ni con los filtros.

---

## Leyes generales del módulo (diseño)

1. **Rol del asistente en esta fase:** actuar como **diseñador UI senior** (jerarquía visual, sistema de diseño, accesibilidad, estados vacíos/carga/error, consistencia entre pantallas del informe).
2. **Componentes:** usar una **librería de componentes** acordada (p. ej. shadcn/ui sobre Radix, o equivalente estable en React), en lugar de solo HTML “crudo” suelto. Los tokens (color, radio, sombra) se definen en tema y se reutilizan.
3. **Fondos:** incorporar **gradientes personalizados** (marca / ambiente ejecutivo) donde aporte jerarquía; evitar ruido que compita con tablas y cifras.
4. **Motion:** **animaciones y hover** deliberados (microinteracciones, transiciones de sección, feedback de foco) sin sacrificar legibilidad ni rendimiento en tablas grandes.
5. **Gráficos “3D”:** la ley de producto pide exploración **3D** donde tenga sentido (p. ej. volumen de venta por dimensión). A nivel técnico, “3D real” suele implicar **WebGL** (p. ej. Three.js / React Three Fiber) o gráficos con **profundidad visual** vía librerías de charts; se documentará por pantalla qué se hace en WebGL vs. qué es estilismo 3D-lite para no inflar bundle sin necesidad.
6. **Tipografía:** **dos familias** bien elegidas y roles claros (p. ej. una para titulares / marca editorial y otra para UI y cifras con buen soporte de tabular figures donde aplique).

---

## Comprensión de la situación (resumen ejecutivo)

El cliente quiere **paridad de contenido** con Streamlit Sales Report: KPIs, evolución mensual, cartera (crecimiento / riesgo / sin compra), marcas, vendedores y detalle operativo según lo acordado en el OT.

Nos da **libertad absoluta de diseño** para que el resultado se perciba como producto **premium**, no como pantalla de prototipo. La diseñadora define look & feel y patrones; desarrollo los implementa en Next sin cambiar la lógica de negocio acordada con backend/datos.

---

## Preguntas de la diseñadora — respuestas técnicas (para alinear librerías y mocks)

### 1. Stack tecnológico: ¿en qué está el “script” actual?

| Capa | Tecnología |
|------|------------|
| **Original (referencia de negocio)** | **Python + Streamlit** (módulo tipo `inteligencia_ventas` / Sales Report). |
| **Nuevo (este repo `report`)** | **TypeScript + React 19 + Next.js 15** (App Router), estilos con **Tailwind CSS**. |
| **Visualización sugerida (compatible)** | Librerías **React**: p. ej. **Recharts**, **Visx**, **ECharts (echarts-for-react)**, o **Three.js / React Three Fiber** si hay requisito firme de escenas 3D. Debe empacarse con el bundle de Next y respetar SSR/hidratación donde corresponda. |

### 2. Origen de los datos: ¿cómo llegan a la tabla?

- En **producción / local con BD:** los datos vienen de **PostgreSQL** (cadena de conexión `DATABASE_URL`, frecuentemente **Supabase**).
- La lectura principal es sobre la vista **`v_ventas_pivot`** (y tablas físicas que la alimentan), construida vía **`buildPivotSql` + `enrichPivotRows`** y agregaciones en **`sales-logic.ts`**.
- El front **no** lee un JSON estático para el informe real: llama a **`POST /api/rimec/analysis`** con el cuerpo de filtros; la API devuelve el paquete de análisis ya listo para UI.
- **Modo demo (sin BD):** puede usarse un paquete **mock** generado en cliente o vía lógica de demo para maquetar sin `DATABASE_URL` (solo para diseño/QA, no sustituye auditoría con datos reales).

### 3. Jerarquía de datos (pivots): ¿qué niveles hay además del mes?

- **Tiempo:** meses agrupables en **semestres** (1er / 2do) o año, según filtros.
- **Dimensiones típicas en filas pivot:** según columnas presentes en la vista, pueden aparecer entre otras **`cliente`**, **`marca`**, **`vendedor`**, **`cadena`** u otras columnas de ubicación (**`origen_tienda`**, **`sucursal`**, etc.). La UI ya puede **expandir cliente → sub-filas** cuando existe una subdimensión detectable en el pivot.
- **Regla:** la profundidad exacta depende del **contrato de columnas** de `v_ventas_pivot` y de los filtros; diseño debe prever **tabla jerárquica + scroll** y estados “sin subnivel”.

### 4. Interactividad: ¿gráficos estáticos o clicables?

- **Por defecto hoy:** tablas y modales con **ampliar / PDF (impresión)**; la interactividad avanzada (clic en barra → detalle del mes) es **mejora de producto** bienvenida si dirección la valida.
- **Recomendación de diseño:** gráficos **interactivos** (tooltip, brush, clic para filtrar o abrir panel lateral) mejoran el storytelling frente a Streamlit; hay que definir **qué clic hace qué** (¿solo resalta? ¿aplica filtro al dataset?).

### 5. Entorno de ejecución: ¿local o nube?

- **Desarrollo:** **local** (`npm run dev`), con frecuencia **Turbopack**; el puerto puede ser **3000** u otro si 3000 está ocupado (Next elige alternativo, p. ej. **3001**).
- **Despliegue:** documentado para **Vercel** (variables de entorno en el servidor, no en el navegador). También puede ejecutarse **build + start** en otro host Node si la organización lo requiere.

---

## Anexo técnico (SQL, KPIs, jerarquía, nulos)

Respuestas extendidas para diseño / dirección: **`docs/DISENO_DATOS_SQL_KPI_JERARQUIA.md`** (qué hace la vista vs. qué calcula la app, variación global, semestres, profundidad de pivot, ceros y −100%).

---

## Referencias internas del repo

- Ruta principal del informe: `src/app/rimec/`.
- Cliente de UI: `src/app/rimec/RimecClient.tsx`.
- Lógica de paquete de análisis: `src/lib/rimec/sales-logic.ts`.
- API análisis: `src/app/api/rimec/analysis/route.ts`.
- Memoria de contexto holding: `docs/MEMORIA_HOLDING_REPORT.md`.

---

*Documento vivo — actualizar cuando cambie el stack visual (librería de componentes o charting) o el contrato de datos.*
