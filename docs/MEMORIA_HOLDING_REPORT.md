# Memoria holding — Report (Vercel) · Sales Report + Retail multi-tienda

> **Línea 1 — dogma de producto:** El encargo central es el **reporte de venta diario asociado a stock y disponibilidad de la importadora**. El idioma único del holding es **proveedor + línea + referencia + material + color + distribución/grada** (caja cerrada `34(1 2 3 3 2 1)` vs curva abierta, ej. 34=1, 35=2, 36=3, 37=3, 38=2, 39=1). **Sales Report** —misma lógica y representación visual que Streamlit— es la **estrella absoluta**. La **portada** de esta app es **misión, visión y políticas**; no compite con la analítica. **Secundario:** gestión de **stock** (retail). Orígenes tipo Tienda_1/2/3 en Excel son **puente** hasta normalizar en **nuestras** tablas de stock y movimiento, absorber la empresa importadora RIMEC y sustituir su sistema operativo actual. **No importa el nombre de la columna** en cada fuente: identificamos por pilares para fusionar todas las empresas del holding.

Documento vivo para alinear producto, seguridad y entregas. **ADMIN** = referencia operativa sin restricciones; el Maestro de obras ejecuta contra este texto.

---

## 1. Identidad y roles (fuente: `usuario_v2`)

### 1.1 Paridad con Streamlit (`core/auth.py` · `AuthManager.login`)

- **Query de login:**  
  `SELECT id_usuario, descp_usuario, categoria FROM usuario_v2 WHERE descp_usuario = :usuario AND password = :pass LIMIT 1`  
  Misma semántica que Streamlit: la columna `password` se compara **tal cual** está guardada (sin capa Supabase Auth intermedia).
- **Sesión lógica (equivalente a `st.session_state.user`):**
  - `id` ← `id_usuario`
  - `name` ← `descp_usuario`
  - `raw_role` ← `categoria` (texto en BD)
  - `role` ← normalizado: `DIRECTOR`, `ROOT`, `ADMINISTRADOR`, `GERENTE` → **`ADMIN`**; el resto (ej. `SU`) queda en mayúsculas.
- **Rate limit:** Streamlit bloquea 5 intentos / 15 min vía `session_state`; en Report se puede replicar después (cookie + store o tabla de intentos).

**Nota holding:** contraseña en claro en tabla es riesgo conocido; **no cambiar el contrato** en la demo sin plan de migración a hash acordado.

- **Fuente única de verdad:** usuarios y categorías salen de la misma base que Streamlit (`usuario_v2` y campo `categoria`).
- **ADMIN** (ej. usuario `DIRECTOR`, `id_usuario` 5, categoría `ADMIN`): **sin restricciones** en Report; ve todos los módulos y scopes.
- **SU** (ej. usuario `IVO`, `id_usuario` 6, categoría `SU`):
  - Tras validarse en Vercel, **por defecto no ve ningún módulo** hasta que **ADMIN** habilite explícitamente módulos (matriz rol → módulo).
  - **Regla de negocio dada:** SU **no** debe ver el **Sales Report de la importadora RIMEC** (scope `sales_report_importadora` u homónimo en UI). El resto se define en tabla de permisos (ver §4).

**Contraseñas y emails no se documentan en código ni se duplican en repos públicos.** Este archivo solo referencia categorías y reglas.

---

## 2. Módulos V1 (entrega < 24 h)

| Módulo | Ruta app | Rol en el paquete |
|--------|----------|-------------------|
| **Sales Report** | `/sales-report` | **Estrella** — paridad lógica y visual con Streamlit (`QueryCenter`, `SalesLogic`, PDF, filtros). |
| **Stock / Retail** | `/retail` | **Secundario** — multi-tienda / importadora, pilares y grada hasta absorción en tablas propias. |
| **Ventas con fotos** | `/ventas-fotos` | Absorbe `info_ventas_fotos`: compras/tránsito por cliente, marca, período y referencia con miniaturas desde Storage. |
| **Portada** | `/` | **Misión, visión y políticas** — una herramienta del paquete; idioma de pilares. |
| Anexo documental | `/informes` | Formato informe institucional (PE); no sustituye a Sales Report. |

---

## 3. Mapa de datos Sales Report (emulación “8 tablas”)

Objetos en Postgres que el pivot usa (en código son **9** si se cuenta la vista; si el convenio holding es “8 tablas”, se excluye la vista del conteo):

1. `v_ventas_pivot` (vista)
2. `registro_ventas_general_v2`
3. `tipo_v2`
4. `marca_v2`
5. `cliente_v2`
6. `vendedor_v2`
7. `categoria_v2`
8. `cliente_cadena_v2`
9. `cadena_v2`

Constante en código: `SALES_REPORT_DB_CONTRACT` en `src/modules/sales-report/constants.ts`.

---

## 4. Permisos por módulo (pendiente de migración)

**Objetivo:** persistir “qué ve cada `id_usuario`” fuera del binario ADMIN/SU.

**Propuesta mínima (24 h):** tabla `usuario_reporte_modulo` (nombre ajustable en migración):

- `id_usuario` (FK `usuario_v2`)
- `module_key` (text: `sales_report`, `sales_report_importadora`, `retail_multitienda`, …)
- `allowed` (boolean)
- `scope` (text nullable; ej. bloquear solo importadora para SU)

**Flujo:** login → leer usuario + categoría → si `ADMIN` → todos los módulos; si `SU` → solo filas `allowed = true`; si ninguna fila → pantalla **“Pendiente de autorización”** (sin datos de negocio).

---

## 5. Datos en Vercel — decisión Maestro (máxima seguridad en poco tiempo)

| Tema | Decisión |
|------|----------|
| Lecturas agregadas (pivot, listados) | **Route Handlers** o **Server Actions** en Next.js, **solo servidor**, con `DATABASE_URL` (connection string Postgres de Supabase, **pooler**, `sslmode=require`) en variables de entorno **no** `NEXT_PUBLIC_*`. |
| Cliente navegador | Solo `NEXT_PUBLIC_SUPABASE_URL` + **anon** para cosas ya cubiertas por RLS (ej. imágenes Storage). **No** usar anon para DDL ni para “insertar pilar si falta”. |
| Insert pilar si falta | Misma política que retail: **transacción en servidor** con credencial con permiso de escritura en tablas pilares; **insert if not exists**; **no actualizar** maestros en rutas de importación (edición manual: editor por rango de línea, `linea_referencia`, motor de precios). |
| Por qué no “solo anon” en 24 h | Montar RLS completa para todas las consultas gerenciales suele ser **más lento** que servidor confiable + queries acotadas ya probadas en Python/SQL. |

Variables Vercel típicas: `DATABASE_URL` (secreto), `REPORT_SESSION_SECRET` (si cookie sesión), opcional `SUPABASE_SERVICE_ROLE_KEY` **solo** si una Server Action acotada lo requiere (evitar exponer al bundle cliente).

---

## 6. PDF — decisión Maestro (< 24 h)

- **Preferido si hay 2–3 h extra:** un **endpoint HTTP** en el monolito Python (mismo `ReportEngine` / `ExportManager`) llamado desde el servidor Next con **token compartido** (header secreto), para **paridad visual total**.
- **Plan B en seco:** PDF **mínimo viable** en Node (`@react-pdf/renderer` o similar) con mismos KPIs y tablas principales; se refina post-demo.

Orden de implementación: datos + grillas primero; PDF en la misma ventana de 24 h solo si el camino A está disponible.

---

## 7. Pilares (línea, referencia, material, color) y “cantidad”

- En **Sales Report** actual, el hecho `registro_ventas_general_v2` **no** trae columnas de línea/ref/material/color; el pivot es **comercial** (cliente, marca, tipo, categoría, vendedor, cadena, meses, montos/cantidades agregadas).
- En **Retail / stock / importaciones** sí opera el **conjunto de pilares** (y cantidades por grada donde aplique).
- **Política holding unificada:** si en una importación aparece combinación **nueva** de pilares: **insert** en el conjunto maestro correspondiente si no existe; **si existe, no actualizar** en flujo de importación (la corrección es por editores y motor de precios / rango de línea / `linea_referencia`).

---

## 8. Constantes compartidas (paridad Streamlit)

- Alias de columnas y meses: `src/modules/sales-report/constants.ts` (alineado a `core/constants.py`).
- Filtros: `SalesReportFilters` en `src/modules/sales-report/types.ts`.

---

## 9. Checklist Maestro — próximos commits

1. [ ] Migración `usuario_reporte_modulo` (o equivalente) + seed ADMIN full access.
2. [ ] Auth: validar usuario contra `usuario_v2` (hash/password según esquema actual; ideal bcrypt en medio plazo).
3. [ ] Middleware / layout: gate SU sin permisos.
4. [ ] API server: query `v_ventas_pivot` con filtros = paridad `QueryCenter`.
5. [ ] Port TypeScript de `SalesLogic.get_full_analysis_package` (o llamada server a lógica compartida).
6. [ ] Retail: rutas + reuse política FK/pilares ya definida en monolito.
7. [ ] PDF: A o B según §6.

---

*Última sincronización: memoria de roles SU/ADMIN, ejemplo IVO, módulos Sales + Retail, estrategia datos/PDF para entrega urgente.*
