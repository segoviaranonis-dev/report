# Administrador Pilar Color — Report

**Ruta:** `/pilares/color` · **Código Moria:** **2.3.5.3**  
**CHUSAR:** `.claude/2_modulos/2.3_report/pilares/CHUSAR_PILAR_COLOR_TONO_CANON.md`  
**Búsqueda canales:** `.claude/2_modulos/2.3_report/pilares/CHUSAR_BUSQUEDA_COLOR_CANALES.md`

---

## Problema

Las descripciones de color del proveedor son compuestas (`NEGRO/BLANCO`, códigos internos). Los filtros no pueden usar `nombre` crudo ni listas checkbox en UI.

## Solución (BD)

| Artefacto | Rol |
|-----------|-----|
| `color.tono_canon` | Etiqueta filtro + hex por código color |
| `color_tono_estandar` | Catálogo estándar · orden por dominancia · aliases |

Admin Report asigna tonos; consumidores (RIMEC Web, Tablet) filtran por **etiqueta canónica**.

## Dos vías de búsqueda (consumidores)

1. **Círculos / iconos** — clic en tono de `color_tono_estandar`.
2. **Texto + Enter** — busca predominante proveedor y etiqueta canónica (ej. `bronce`). **Prohibido** mostrar opciones multi-select.

Ver CHUSAR búsqueda para reglas completas y SQL.

---

Ver CHUSAR pilar para API, migraciones y roadmap código.
