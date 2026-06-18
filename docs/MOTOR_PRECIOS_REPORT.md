# Motor de Precios — Report (2.3.1.7.1 / P.1.1)

**Subproceso de:** [PROCESO_IMPORTACION_REPORT.md](./PROCESO_IMPORTACION_REPORT.md) · **Ruta:** `/proceso-importacion/motor-precios`

---

## Por qué Report

- UI NIIF institucional · roles · sesión
- Misma app que Depósitos (`/depositos-bazzar`), Pilares (`/pilares`), Aprobaciones
- Streamlit Motor queda legacy hasta paridad

---

## Dos corazones (negocio)

| Corazón | Qué es | Tablas |
|---------|--------|--------|
| **1** | Biblioteca de casos | `biblioteca_precio`, `precio_evento_caso` |
| **2** | Caso + Excel → evento | `precio_evento`, `precio_lista` |

Fórmula: `Caso + Excel = Evento (listado)` → filas en `precio_lista` con LPN/LPC y descuentos.

---

## Flujo técnico objetivo

```txt
1. Usuario elige/crea caso (biblioteca)
2. Sube Excel proveedor (hojas = marcas)
3. Backend: parse STYLE → FK pilares → staging
4. SQL: INSERT…SELECT precio_lista (ROUND en Postgres)
5. Cerrar evento → vincular precio_evento_id al PP
```

Referencia OT: `.claude/6_ot/en_curso/OT-MOTOR-SQL-520-001.md`

---

## Páginas (código en `src/app/proceso-importacion/motor-precios/`)

| Código | Ruta | Función |
|--------|------|---------|
| 2.3.1.7.1 | `/proceso-importacion/motor-precios` | Hub motor · biblioteca |
| 2.3.1.7.1.1 | `…/biblioteca` | Histórico casos |
| 2.3.1.7.1.2 | `…/biblioteca/nueva` | Crear biblioteca |
| — | `…/biblioteca/[id]` | Editor caso + líneas |
| *(próximo)* | `…/eventos/[id]` | Detalle listado |
| *(próximo)* | `…/import` | Upload Excel |

Constantes: `src/lib/report/routes.ts` · APIs: `/api/motor-precios/*` (sin cambio).

---

## No mezclar

- **`/rimec`** — Sales Report · sin pilares · blindado
- **`/retail`** — staging Excel tiendas · otro proceso
- **`/pilares`** — edición catálogo · complementario al import

---

## Enlaces Moria

- `.claude/2_modulos/2.3_report/motor_precios/INDICE.md`
- `.claude/1_fundamentos/1.2_leyes/motor_precios_dos_corazones.md`

---

**Shibboleth:** Chayanne el mejor
