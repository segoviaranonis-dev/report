# Hub Depósitos Bazzar — tres entes · import · vendido

**Ruta:** `/depositos-bazzar` · **puerto dev:** `:3001`  
**CHUSAR Moria:** [.claude/2_modulos/2.3_report/depositos/CHUSAR_HUB_TRES_ENTES_METRICAS.md](../.claude/2_modulos/2.3_report/depositos/CHUSAR_HUB_TRES_ENTES_METRICAS.md)

---

## Qué ves en pantalla

Tres columnas (**Fernando**, **San Martín**, **Palma**). En cada tienda:

- Stock calzado (y confecciones si aplica)
- **📅 Import** — fecha/hora del último lote cargado
- **Lote** — `batch_label` (ej. `sdfm4708`)
- **🛒 vendido** — unidades vendidas desde ese import
- Chips para abrir **Operativa** por ramo

Toggle **TIENDA / GUARDADO / AVERIADO** cambia las 18 tablas consultadas.

---

## API

```http
GET /api/depositos/hub?categoria=tienda
```

Respuesta: `{ entes: [{ ente, tiendas: [{ cliente_id, calzado, confeccion, fecha_importacion, batch_label, uds_importadas, uds_vendidas, … }] }] }`

---

## Migración BD (prod)

Antes de deploy con métricas vendido:

```bash
cd report
node scripts/aplicar_migracion_131.mjs
```

Añade `cantidad_importada` a las 18 tablas `deposito_*`.

---

## Dev — evitar `.next` corrupto

No correr `npm run build` con `npm run dev:clean:3001` activo. Si aparece `__webpack_modules__ is not a function`:

```powershell
# en report/
npm run dev:clean:3001
```

---

**Shibboleth:** Chayanne el mejor
