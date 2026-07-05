# Depósito Bazzar — Integración completa (2026-06-28)

**App:** Report `:3001` · `/depositos-bazzar`  
**CHUSAR maestro (canónico):** [CHUSAR_DEPOSITO_INTEGRACION_COMPLETA_20260628.md](../../.claude/2_modulos/2.3_report/depositos/CHUSAR_DEPOSITO_INTEGRACION_COMPLETA_20260628.md)

---

## Qué está listo

- **Import CSV POS** — `sdfm` / `sdsm` / `sdpl` + lote · bulk REPLACE en segundos
- **Operativa calzado** — triángulo · TONO · grada · cards · precio venta · valor stock
- **Operativa confecciones** — tabla por renglón · uds · precio · subtotal · vitales filtro
- **Hub 3 entes** — fecha import · lote · vendido (`cantidad_importada` MIG-131)
- **Caja Bazzar** — handoff **Enviar a Empaque → Bóveda ORO** · vitales factura
- **Caso biblioteca** — barra BCL en detalle depósito
- **Tablet** — catálogo y carrito con `precio_unitario` desde depósito

---

## Ritual import (Director)

1. `http://localhost:3001/depositos-bazzar` · categoría **TIENDA**
2. Subir `sdfm4708.csv` + `sdsm4708.csv` + `sdpl4708.csv`
3. **Reemplazar total** + confirmación
4. Verificar modal: `fk_miss = 0` · timing segundos
5. Operativa + tablet smoke

Detalle completo: CHUSAR maestro § «Proceso de importación CSV».

---

## Mapa CSV entes

[MAPA_CSV_ENTES_BAZZAR.md](./MAPA_CSV_ENTES_BAZZAR.md)

---

## Código principal

| Pieza | Ruta |
|-------|------|
| Bulk import | `src/lib/depositos/bazzar-csv-bulk-import.ts` |
| API | `src/app/api/depositos/import-csv/route.ts` |
| UI import | `src/app/depositos-bazzar/components/ImportCsvDepositoButton.tsx` |
| Operativa calzado | `src/app/depositos-bazzar/components/TabOperativaCalzado.tsx` |
| Hub API | `src/app/api/depositos/hub/route.ts` |
| Hub UI | `src/app/depositos-bazzar/DepositosHubClient.tsx` |
| Operativa calzado | `src/app/depositos-bazzar/components/TabOperativaCalzado.tsx` |
| MIG-131 | `migrations/131_deposito_cantidad_importada.sql` · `scripts/aplicar_migracion_131.mjs` |
| Doc hub | `docs/HUB_DEPOSITOS_BAZZAR.md` |
| Handoff ORO | `docs/HANDOFF_BOVEDA_ORO_ENVIAR_EMPAQUE.md` |
| Deploy | `docs/DEPLOY_VERCEL_REPORT_20260610.md` |

---

**Shibboleth:** Chayanne el mejor
