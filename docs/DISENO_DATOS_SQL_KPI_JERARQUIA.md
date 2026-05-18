# Datos, SQL y KPIs — respuestas para diseño (RIMEC / Sales Report)

Este documento responde con precisión **qué hace la base**, **qué hace la API** y **qué hace el frontend**, para que diseño sepa dónde poner subtotales, drill-down y tratamiento visual de ceros / −100%.

---

## 1. ¿Dónde está el SQL de `v_ventas_pivot`?

**En este repositorio no está el `CREATE VIEW` completo** de `v_ventas_pivot`. Esa definición vive en **PostgreSQL / Supabase** (migraciones o scripts del equipo de datos).

Lo que **sí** está versionado es el **query de lectura** que usa la app:

```sql
SELECT * FROM v_ventas_pivot
WHERE <condiciones dinámicas>
```

Implementación: `src/lib/rimec/pivot-query.ts` → `buildPivotSql()`.

Condiciones posibles (mismas reglas que el clon de Streamlit / `queries.py`):

| Filtro UI | Columna / forma en SQL |
|-----------|-------------------------|
| Meses elegidos | `mes_idx = ANY($n::int[])` (si no son los 12 meses) |
| Departamento / tipo | `tipo = $n` |
| Categorías | `id_categoria = ANY($n::int[])` |
| Cliente exacto | `codigo_cliente = $n` |
| Vendedores / marcas / cadenas / clientes | `vendedor` / `marca` / `cadena` / `cliente` `= ANY($n::text[])` |

**Cómo obtener el DDL “hasta el último detalle”:** en Supabase o `psql`:

```sql
SELECT pg_get_viewdef('v_ventas_pivot'::regclass, true);
```

O pedir al DBA el archivo de migración que crea la vista. Referencia de tablas que suelen alimentarla (contrato documentado): `registro_ventas_general_v2`, `tipo_v2`, `marca_v2`, `cliente_v2`, `vendedor_v2`, `categoria_v2`, `cliente_cadena_v2`, `cadena_v2` (ver `src/modules/sales-report/constants.ts` y `OT-INFORME-001_COMPLETADO.md`).

---

## 2. ¿Cómo se calculan “Monto Obj” vs “Monto 26”?

### Lo que viene de la vista (filas crudas)

Cada fila del pivot incluye al menos los campos numéricos que usa el post-proceso, entre otros **`monto_25`** y **`monto_26`** (nombres en snake_case en la respuesta de `pg`).

### Lo que **no** calcula solo la vista en el flujo Next

Los alias de presentación **`Monto 26`**, **`Monto Obj`**, **`Variación %`** se calculan **en aplicación**, después del `SELECT`, en:

`src/lib/rimec/pivot-query.ts` → **`enrichPivotRows(rows, objetivo_pct)`**

Fórmulas (resumen):

- `mult = 1 + objetivo_pct / 100`
- **`Monto 26`** = valor numérico de `monto_26` (año / período “actual” en el modelo).
- **`Monto Obj`** = `monto_25 * mult`  
  Es decir: **objetivo = base año anterior (monto_25) escalado por el % de crecimiento** elegido en la barra lateral (ej. 20% → ×1,2), **no** un “presupuesto fijo” distinto salvo que la vista ya haya modelado `monto_25` así.
- **`Variación %`**:  
  - si `Monto Obj > 0` → \((Monto26 - MontoObj) / MontoObj × 100\)  
  - si `Monto Obj == 0` y `Monto 26 > 0` → `null` (en código puede representarse como ausencia o NaN tratado).  
  - si ambos son 0 → `0`.

**Conclusión para diseño:** la tabla “tipo Streamlit” de montos/variación **no** viene como subtotales pre-armados desde SQL para esos alias; el **objetivo y la variación por fila** son **post-SQL**. Los subtotales de **semestre** en la UI se arman **agregando meses** en el cliente (ver siguiente sección).

---

## 3. “1er SEMESTRE” colapsable: ¿SQL o frontend?

1. **En el motor de paquete (TypeScript clonado de la lógica Python)**  
   Tras agregar por `mes_idx`, cada fila de evolución lleva una columna **`Semestre`**: `"1er SEMESTRE"` si `mes_idx <= 6`, si no `"2do SEMESTRE"` (`src/lib/rimec/sales-logic.ts`, arteria evolución).  
   Eso es **etiqueta por mes**, no una fila SQL extra de subtotal.

2. **En la pantalla `/rimec` (agrupación visual)**  
   La agrupación tipo **“1er SEMESTRE (n)”** con fila sumada y meses hijos suele construirse con **`evolucionPorSemestre`** en `src/app/rimec/rimec-view-utils.ts`: toma la evolución mensual ya calculada y los **meses seleccionados en filtros**, suma `Monto Obj` / `Monto 26` por bloque semestre y calcula variación del bloque.

**Conclusión:** los **subtotales de semestre** son **capa de presentación / agregación en app**, no un `ROLLUP` en el `SELECT` actual documentado en repo.

---

## 4. Jerarquía del pivot: ¿profundidad? ¿Mes → Marca → Cliente en una tabla?

- **Granularidad mínima de una fila** = lo que devuelve `v_ventas_pivot` para el filtro actual (puede incluir `mes_idx`, `cliente`, `marca`, `vendedor`, `cadena`, etc., según cómo esté definida la vista y los datos).
- **Evolución mensual** en el paquete actual: agregación **`_agg(df, ["mes_idx"])`** → una fila por mes (no un árbol Mes→Marca→Cliente en esa tabla sin nuevo trabajo).
- **Cartera / clientes:** la lógica agrupa por **`cliente`**, y si en datos hay **`cadena`** y/o **`marca`**, el grupo incluye esas columnas y construye **`_path`** (cadena → cliente → marca). Eso define una **jerarquía de negocio** para paths, no necesariamente un único widget de tabla anidada universal.
- **UI actual (Next):**  
  - Colapso **semestre → meses** en evolución.  
  - Bajo **clientes en crecimiento (y riesgo)**: si el pivot trae una subdimensión conocida (`cadena`, `origen_tienda`, `sucursal`, `local`, `punto_venta`), se puede **expandir cliente → sub-filas** (`pickSubdimKey`, `subrowsByCliente`).  
  - En `rimec-view-utils.ts` también existen utilidades **`subrowsByMarca`** / **`subrowsByVendedor`** para otros diseños; no implica que hoy todas estén cableadas en la misma tabla.

**¿Mes → Marca → Cliente en la misma tabla?**  
Hoy **no** está implementado como un único árbol de tres niveles bajo “mes” en una sola tabla de evolución. Sería **nueva especificación**: o bien nuevas agregaciones en TS (a partir de `pivot` filtrado por mes), o bien nueva consulta SQL agrupada por `mes_idx, marca, cliente`. El límite real lo marca **qué columnas y qué cardinalidad** trae la vista para el filtro dado.

**Sugerencia sticky headers:** válida siempre que haya **scroll vertical largo**; encaja con tablas de detalle operativo y cartera. Es independiente de si los subtotales vienen de SQL o del front.

---

## 5. “Variación global” (+7,6 %): ¿qué query? ¿mes vs año?

No es un SQL aparte. Es el campo **`variacion_total`** del paquete tipo Streamlit, calculado en **`getFullAnalysisPackage`** (`src/lib/rimec/sales-logic.ts`):

- `totalReal` = suma de **`Monto 26`** sobre **todas las filas del dataframe filtrado** `df` (es decir, el resultado ya filtrado por meses/tipo/categorías/etc. después del `SELECT` + `enrichPivotRows`).
- `totalObj` = suma de **`Monto Obj`** sobre el mismo `df`.
- **`variacion_total`** = \((totalReal - totalObj) / totalObj × 100\) si `totalObj > 0`; si no, reglas de fallback (ver código cerca de la construcción del `package_`).

**Interpretación:** es la **variación del período acotado por los filtros activos** (conjunto de filas devuelto), **no** “mes corriente vs mes anterior” ni “año calendario completo” salvo que los filtros de meses y datos lo hagan así.

**Sparkline / contexto:** hoy el KPI es un número; añadir mini-serie temporal es **capa visual** alimentada por `evolucionMes` o serie derivada (diseño + front).

---

## 6. Ceros, meses futuros y −100 %

El query **no “sabe”** si un mes es futuro: filtra por `mes_idx` si el usuario eligió esos meses. Si la base devuelve filas con **`monto_26 = 0`** y **`monto_25`** (o el objetivo derivado) **> 0**, entonces:

\[
\text{variación} = \frac{0 - MontoObj}{MontoObj} \times 100 = -100\%
\]

Eso es **matemática del modelo**, no un texto especial “futuro”.

**Propuesta de producto/diseño (alineada con lo que comentás):**

- Tratar en **UI** meses futuros o no cerrados como **“Sin dato” / “Proyectado” / gris**, y **no** usar semáforo rojo de alerta para −100% automático; o
- **Excluir** del selector por defecto meses > mes actual; o
- Pedir a datos un flag en vista (`cerrado`, `proyectado`) si quieren regla en origen.

Cualquier cambio de **regla de negocio** (no solo color) debe acordarse con quien valida paridad frente a Streamlit.

---

## Referencias rápidas en código

| Tema | Archivo |
|------|---------|
| SQL dinámico sobre la vista | `src/lib/rimec/pivot-query.ts` (`buildPivotSql`) |
| Monto Obj / Monto 26 / Variación % por fila | `src/lib/rimec/pivot-query.ts` (`enrichPivotRows`) |
| Evolución mensual + etiqueta Semestre | `src/lib/rimec/sales-logic.ts` (arteria A) |
| KPIs globales (incl. variación total) | `src/lib/rimec/sales-logic.ts` (bloque KPIs) |
| Agrupación UI semestres | `src/app/rimec/rimec-view-utils.ts` (`evolucionPorSemestre`) |
| Subfilas por cliente | `src/app/rimec/rimec-view-utils.ts` (`pickSubdimKey`, `subrowsByCliente`) |

---

*Última revisión alineada al código en `report`. El DDL exacto de `v_ventas_pivot` debe solicitarse al equipo de base de datos.*
