# Proceso de importación — Report (app)

**Módulo:** `2.3.1.7` · **Ruta:** `/proceso-importacion`  
**Moria:** [.claude/2_modulos/2.3_report/proceso_importacion/INDICE.md](../../.claude/2_modulos/2.3_report/proceso_importacion/INDICE.md)  
**Etapa activa:** [.claude/4_etapas/ETAPA_MUDANZA_IC_DIG_PP_REPORT.md](../../.claude/4_etapas/ETAPA_MUDANZA_IC_DIG_PP_REPORT.md)

---

## Jerarquía en pantalla

1. **Inicio Report (RIMEC)** → tarjeta «Proceso de importación»
2. **Hub 2.3.1.7** → 4 cards (Motor · IC · Digitación · PP)
3. **Motor (7.1–7.2)** → ✅ cerrado — [MOTOR_PRECIOS_REPORT.md](./MOTOR_PRECIOS_REPORT.md) · [IMPORTACION_PRECIOS_REPORT.md](./IMPORTACION_PRECIOS_REPORT.md)
4. **IC (7.3)** → [INTENCION_COMPRA_REPORT.md](./INTENCION_COMPRA_REPORT.md)
5. **Digitación (7.4)** → [DIGITACION_REPORT.md](./DIGITACION_REPORT.md)
6. **Pedido PP (7.5)** → [PEDIDO_PROVEEDOR_REPORT.md](./PEDIDO_PROVEEDOR_REPORT.md)

Carpeta app: `src/app/proceso-importacion/` · rutas: `src/lib/report/routes.ts`

---

## URLs dev (`:3001`)

| Código | Hub / ruta |
|--------|------------|
| 2.3.1.7 | http://localhost:3001/proceso-importacion |
| 2.3.1.7.3 | http://localhost:3001/proceso-importacion/intencion-compra |
| 2.3.1.7.4 | http://localhost:3001/proceso-importacion/digitacion |
| 2.3.1.7.5 | http://localhost:3001/proceso-importacion/pedido-proveedor |

Navegador Moria: http://localhost:3004/procesos/importacion

---

## Cadena operativa (7.3 → 7.5)

```txt
Nueva IC → Bandeja → AUTORIZAR → Digitación asignar → PP detalle
```

**Regla:** PP solo nace en Digitación. `/pedido-proveedor/nuevo` redirige a Digitación.

---

## Docs app por subproceso

| Código | Archivo |
|--------|---------|
| 2.3.1.7.1 | [MOTOR_PRECIOS_REPORT.md](./MOTOR_PRECIOS_REPORT.md) |
| 2.3.1.7.2 | [IMPORTACION_PRECIOS_REPORT.md](./IMPORTACION_PRECIOS_REPORT.md) |
| 2.3.1.7.3 | [INTENCION_COMPRA_REPORT.md](./INTENCION_COMPRA_REPORT.md) |
| 2.3.1.7.4 | [DIGITACION_REPORT.md](./DIGITACION_REPORT.md) |
| 2.3.1.7.5 | [PEDIDO_PROVEEDOR_REPORT.md](./PEDIDO_PROVEEDOR_REPORT.md) |

Índice carpeta: [proceso-importacion/README.md](./proceso-importacion/README.md)

---

## Auth

Subprocesos IC/DG/PP: `requireMotorPreciosAdmin()` en APIs bajo `/api/proceso-importacion/*`.

---

**Shibboleth:** Chayanne el mejor
