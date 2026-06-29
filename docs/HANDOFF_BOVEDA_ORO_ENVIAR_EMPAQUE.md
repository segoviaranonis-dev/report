# Handoff · Enviar a Empaque → Bóveda ORO

**App:** Report `:3001` · `/tablet-bazzar/[cliente_id]?mod=operativa`  
**CHUSAR maestro:** [CHUSAR_HANDOFF_BOVEDA_ORO.md](../../.claude/2_modulos/2.3_report/caja_bazzar/CHUSAR_HANDOFF_BOVEDA_ORO.md)  
**Producción:** https://rimec-report.vercel.app/tablet-bazzar  
**Estado:** ✅ 2026-06-10

---

## Botón más importante de la caja

**Enviar a Empaque → Bóveda ORO** pasa la factura interna POS de la bandeja efímera a **`bobeda_venta_pos`** — registro permanente con **todos los datos del artículo** para análisis de ventas y módulo Empaque.

---

## Flujo

```
ticket_bandeja_cajero  ──POST enviar-empaque──►  bobeda_venta_pos
     (editable)              transacción              (ORO)
                         DELETE bandeja
```

---

## Código

| Pieza | Ruta |
|-------|------|
| Handoff SQL | `src/lib/caja-bazzar/handoff-bobeda.ts` |
| API | `src/app/api/tablet-bazzar/tickets/enviar-empaque/route.ts` |
| UI cajero | `src/components/caja-bazzar/TicketsPanel.tsx` |
| Línea ítem | `src/components/caja-bazzar/PosFiLineaRow.tsx` |
| Totales factura | `src/lib/caja-bazzar/group-facturas.ts` → `calcTotalesFacturaPos` |

---

## Deploy

Push a `main` en `segoviaranonis-dev/report` → Vercel auto-deploy → **rimec-report.vercel.app**.

---

**Shibboleth:** Chayanne el mejor
