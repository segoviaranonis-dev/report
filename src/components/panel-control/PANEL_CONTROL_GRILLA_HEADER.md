# CABECERA DE FILTROS — Panel de Control · grilla moléculas

**Módulo:** Alejandro Magno · Report `:3000`  
**Componente:** `PanelControlTrianguloHeader` → `TrianguloHeaderDeposito`  
**Config:** `lib/panel-control/panel-control-grilla-header.ts`

---

## Regla (indiscutible)

Toda pantalla con **grilla de moléculas** que sale del Panel de Control **debe** usar el stack:

```
BibliotecaCasoBar
  → PanelControlTrianguloHeader  (CABECERA DE FILTROS)
  → GrillaPeImportadora
```

Implementación: `PanelControlGrillaStack.tsx`.

---

## Rutas obligatorias

| Entidad Panel | Ruta |
|---------------|------|
| STOCK · Pronta entrega | `/stock-pronta-entrega` |
| COMPRA PREVIA · Tránsito | `/stock-transito` · `/disponible` · `/ventas` |
| PROGRAMADO | `/stock-programado` |

---

## Props selladas (`PANEL_CONTROL_GRILLA_HEADER`)

| Prop | Valor | Motivo |
|------|-------|--------|
| `gradaVariant` | `importadora` | Curva caja cerrada importadora |
| `filtersDefaultOpen` | `false` | Cabecera compacta al entrar |
| `hideVitalesHero` | `true` | Sin bloque hero duplicado |
| `hideProductosVital` | `true` | KPI pares/Gs en barra |
| `categoriaEnCabecera` | `true` | Toggle 👟 Calzado / 👕 Confecciones arriba |
| `summaryLayout` | `vitales-first` | Pares + vitales entidad antes de expandir filtros |
| `tonoCatalog` | `COLORES_ESTANDAR_DEFAULT` | Fila TONO canónica |

---

## Filas visibles (al expandir)

Género · Marca · Estilo · Tipo 1 · Línea · Buscar · TONO (+ Grada importadora).

`extraFilters` por entidad (solo debajo del acordeón):

| Entidad | Extra |
|---------|-------|
| PE | Depósito legal D1/D2/D3 |
| Tránsito / Programado | Filtro Llegada (quincena) |

`summaryTrailing` por entidad: vitales vendido/saldo (PE · CP · Programado).

---

## Prohibido

- Grilla moléculas **sin** CABECERA DE FILTROS en rutas Panel CP.
- Duplicar props del header con valores distintos por módulo.
- Embeber grilla en tarjetas del hub compacto (drill-down = hoja independiente).

---

## Referencias Moria

- `.claude/2_modulos/2.3_report/gestion_compra/CHUSAR_PANEL_CONTROL_GRILLA_HEADER.md` · **2.3.1.20**
- `.claude/3_arquitectura/3.2_venta_tienda/CABECERA_DE_FILTROS.md`
- `.claude/2_modulos/2.3_report/gestion_compra/CHUSAR_PANEL_CONTROL_HUB_NAVEGACION.md`
