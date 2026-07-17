# Primera palabra · etiqueta filtro pilares Material / Color

**Paridad código:** `report/src/lib/pilares/primera-palabra-pilar.ts` · `colorPredominante` en `color-canon.ts`

## Regla

De la **descripción** del pilar (`descp_material` / `descp_color`), tomar solo la **primera palabra**.

Separadores (el primero que aparezca corta):

| Separador | Ejemplo entrada | Etiqueta |
|-----------|-----------------|----------|
| espacio | `NAPA TURIM` | `Napa` |
| `/` | `NEGRO/BLANCO` | `Negro` |
| `-` | `SINT-ECO` | `Sint` |
| también `–` `,` `\|` | (paridad tono) | — |

El **filtro** sigue siendo **FK** (`material_id` / `color_id`). La 1ª palabra es solo etiqueta UI.

## Uso

Herramienta reposición · bloque **Molécula** (Documenta 2026-07-17 · etapa **2.3.1.26**).
