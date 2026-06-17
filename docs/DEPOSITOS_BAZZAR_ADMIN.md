# Depósitos Bazzar — Administrador (Report 2.3.6)

**CHUSAR:** `.claude/2_modulos/2.6_depositos_bazzar/CHUSAR_ADMIN_DEPOSITOS_REPORT.md`  
**Índice Moria:** `.claude/2_modulos/2.3_report/depositos/INDICE.md`  
**Etapa:** ✅ CERRADA 2026-06-17

---

## URLs

| Entorno | URL |
|---------|-----|
| Local | http://localhost:3000/depositos-bazzar |
| Producción | https://rimec-report.vercel.app/depositos-bazzar |

---

## Funcionalidad entregada

1. **18 tablas** en Supabase — nomenclatura `deposito_{1|2|3}_{ente}_{adultos|ninos}_{tienda|guardado|averiado}`
2. **Toggle TIENDA / GUARDADO / AVERIADO** — cambia las 6 cards al instante
3. **Sync Retail** — solo depósito **tienda** (6 tablas · ~30k registros)
4. **Tablet Bazzar** — consume únicamente nivel 1 · tienda

---

## Matriz tienda (sync activo)

| cliente_id | Tabla |
|------------|--------|
| 2100 | `deposito_1_fernando_adultos_tienda` |
| 2900 | `deposito_1_fernando_ninos_tienda` |
| 2400 | `deposito_1_sanmartin_adultos_tienda` |
| 2700 | `deposito_1_sanmartin_ninos_tienda` |
| 3100 | `deposito_1_palma_adultos_tienda` |
| 3200 | `deposito_1_palma_ninos_tienda` |

Guardado y averiado: ver [NOMENCLATURA](../../.claude/2_modulos/2.6_depositos_bazzar/NOMENCLATURA_DEPOSITOS_BAZZAR.md)

---

## API

```
GET  /api/depositos/sync?categoria=tienda|guardado|averiado
POST /api/depositos/sync                    # todos tienda
POST /api/depositos/sync  { "cliente_id": 2100 }
GET  /api/depositos/[cliente_id]?categoria=tienda&limit=30
```

---

## Evidencia

- `docs/evidencia/MIGRACION_113_DEPOSITOS_20260617.json`
- Script conteo: `scripts/check_deposit_counts.mjs`

---

**Shibboleth:** Chayanne el mejor
