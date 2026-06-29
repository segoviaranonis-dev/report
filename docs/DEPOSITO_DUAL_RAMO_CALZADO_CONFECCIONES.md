# Depósito Bazzar — dual ramo · base operativa

**Etapa:** 2.3.2.1.1 · Hiedra Venenosa  
**Ratificado:** Director · 2026-06-28  
**CHUSAR calzado:** [CHUSAR_VISTA_OPERATIVA_DEPOSITO.md](../../.claude/2_modulos/2.3_report/depositos/CHUSAR_VISTA_OPERATIVA_DEPOSITO.md)  
**CHUSAR confecciones:** [CHUSAR_VISTA_OPERATIVA_CONFECCIONES.md](../../.claude/2_modulos/2.3_report/depositos/CHUSAR_VISTA_OPERATIVA_CONFECCIONES.md)  
**Import CSV:** [CHUSAR_IMPORT_CSV_HIEDRA_VENENOSA.md](../../.claude/2_modulos/2.3_report/depositos/CHUSAR_IMPORT_CSV_HIEDRA_VENENOSA.md)  
**Mapa entes:** [MAPA_CSV_ENTES_BAZZAR.md](./MAPA_CSV_ENTES_BAZZAR.md)  
**Código índice:** `report/src/lib/depositos/pilar-proveedor-index.ts`

---

## Base de todo

El stock Bazzar se muestra **por pilares FK** — nunca por texto suelto. Dos ramos independientes en el **mismo depósito físico** (misma tabla BD), distinta **presentación** según negocio:

```
CSV POS (7 cols + S00_D1/D2/NINHOS)
        ↓
classifyRamo(COD.GRUPO · COD.ART)
        ↓
    ┌───┴───┐
  654       638
 calzado   confección
 tipo_v2=1 tipo_v2=2
    ↓         ↓
deposito_1_{cliente_id}_tienda  (18 tablas · etapa prueba)
    ↓
Operativa Report / Tablet
```

**Velocidad operativa:** el operador entra al hub → elige ente/segmento → ve **calzado** (cards) o **confección** (tabla L/R/color) en un click.

---

## Ramo calzado (654)

| Concepto | Valor |
|----------|-------|
| `proveedor_id` | **654** |
| `tipo_v2_id` | **1** |
| Marcas adultos | 1, 2, 3, 4, 7, 8, 9 |
| Marcas niños | 5, 6 |
| Molécula | L + R numéricos + material + color + **grada calzado** |
| UX | **Grilla cards** · CABECERA triángulo · tabla grada × pares por caja |
| CSV columna adultos | `S00_D1` / `S00_D2` |
| CSV columna niños | `S00_NINHOS` |

---

## Ramo confecciones (638)

| Concepto | Valor |
|----------|-------|
| `proveedor_id` | **638** |
| `tipo_v2_id` | **2** |
| Marcas | **10–15** (Kyly, Milon, Amora, Lemon, Nanai, Pipa) |
| Tiendas | Solo **niños** (2900, 2700) + **Palma 3100** |
| Molécula | L alfanumérico + ref **`K`** + material `{linea}K` + color + **talle ropa** |
| UX | **Tablas filtrantes** · ejes **Línea · Referencia · Color** |
| CSV | Solo **`S00_NINHOS`** (o Palma misma columna → 3100) |
| Fotos | `imagen_nombre` en staging · convención Storage L-K-material-color |

---

## Mapa ente × depósito × marca

### Fernando / San Martín — 2 cajas

| Columna CSV | Destino | Marcas calzado | Marcas confección |
|-------------|---------|----------------|-------------------|
| `S00_D1` | 2100 / 2400 tienda | Adultos 1–4,7–9 | — |
| `S00_D2` | guardado mismo cliente | Adultos | — |
| `S00_NINHOS` | 2900 / 2700 tienda | Niños 5–6 | 10–15 |

### Palma — 1 caja (`3100`)

| Columna CSV | Destino | Marcas |
|-------------|---------|--------|
| `S00_D1` | `deposito_1_3100_tienda` | Calzado adultos 1–4,7–9 |
| `S00_D2` | `deposito_2_3100_guardado` | Idem |
| `S00_NINHOS` | **`deposito_1_3100_tienda`** (misma caja) | Niños 5–6 + confección 10–15 |

**3200** = legacy BD · sin tablet · sin import.

Código: `bazzar-csv-ente-map.ts` → `PALMA_TIENDA_UNICA`.

---

## Hub UI — conteos rápidos (objetivo)

```
┌─ FERNANDO ──────────────────────────────────────┐
│  ADULTOS 2100              NIÑOS 2900           │
│  👟 8.875 p                 👟 2.226 p          │
│  [Operativa calzado]        👕 2.866 u            │
│                             [Operativa conf.]     │
└─────────────────────────────────────────────────┘
┌─ PALMA ─────────────────────────────────────────┐
│  TIENDA ÚNICA 3100  (1 caja tablet)              │
│  👟 adultos · 👟 niños · 👕 confección           │
│  [Operativa] → toggle ramo dentro                 │
└─────────────────────────────────────────────────┘
```

Clic 👟 → Operativa `ramo=calzado` · clic 👕 → `ramo=confecciones` con filtros tabla.

---

## Pilares — lookup canónico

Import y UI usan **solo FK**:

```sql
JOIN linea l ON l.proveedor_id = :prov AND l.codigo_proveedor = :linea_bigint
JOIN referencia r ON r.proveedor_id = :prov AND r.codigo_proveedor = :ref_bigint
-- idem material, color
```

| Ramo | `:prov` | Ref especial |
|------|---------|--------------|
| Calzado | 654 | R numérico STYLE |
| Confección | 638 | **`K` → 11** |

**GRUPO → marca hint:** `01`–`09` calzado · `10`–`15` confección (`GRUPO_ID_MARCA` en pilar-proveedor-index).

---

## Volúmenes referencia lote 4708 (dry-run)

| Archivo | Ente | Calzado uds | Confección uds | Columna confección |
|---------|------|-------------|----------------|-------------------|
| sdfm4708 | Fernando | ~12.309 | ~2.866 | S00_NINHOS → 2900 |
| sdsm4708 | San Martín | ~24.895 | *(en NINHOS)* | S00_NINHOS → 2700 |
| sdpl4708 | Palma | ~11.544 | ~900 | S00_NINHOS → **3100** |

---

## Implementación actual vs pendiente

| Pieza | Estado |
|-------|--------|
| Clasificador 654/638 + matriz marca | ✅ `pilar-proveedor-index.ts` |
| Mapa CSV 3 entes + Palma única | ✅ `bazzar-csv-ente-map.ts` |
| Import CLI REPLACE dual INSERT | ✅ `import_bazzar_csv_deposito.mjs` |
| Doc vista calzado (cards) | ✅ CHUSAR operativa |
| Doc vista confecciones (tablas) | ✅ este paquete 2026-06-28 |
| UI toggle ramo + tabla confección | 📋 |
| Hub conteos 👟/👕 clicables | 📋 |
| MERGE import · preview API | 📋 |
| Auditoría fotos Kyly | ⏳ Director |

---

## Reglas intocables

1. **Sales Report** blindado — no pilares.
2. **Bóveda ventas** — import stock no borra `bobeda_venta_pos`.
3. **Adultos** — nunca confección en matriz ni UI.
4. **Palma** — un solo `cliente_id` operativo 3100.
5. **Sin parche cliente** — filtros por FK, no por texto marca/estilo.

---

**Shibboleth:** Chayanne el mejor
