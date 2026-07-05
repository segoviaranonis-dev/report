# Report — Cómo ejecutar (dev)

**App:** `report/` · **Puerto:** **3001** · **Prod:** https://rimec-report.vercel.app

---

## Arranque

```powershell
cd C:\Users\hecto\Nexus_Core\report
npm run dev
```

Abrir http://localhost:3001 — login con usuario `usuario_v2` (misma BD que Streamlit).

---

## Rutas maratón IC → PP (2026-07-03)

| Ruta | Código |
|------|--------|
| `/proceso-importacion/intencion-compra/nueva` | 2.3.1.7.3.2 |
| `/proceso-importacion/intencion-compra/bandeja` | 2.3.1.7.3.1 |
| `/proceso-importacion/digitacion` | 2.3.1.7.4 |
| `/proceso-importacion/pedido-proveedor` | 2.3.1.7.5 |
| `/proceso-importacion/pedido-proveedor/[ppId]?tab=stock` | 2.3.1.7.5.3.1 |

---

## Error `.next` corrupto

**Síntoma:** `ENOENT routes-manifest.json` · `Cannot find module './1331.js'` · GET 500.

**Causa típica:** `npm run build` concurrente con `next dev`.

**Fix:**

```powershell
# Matar proceso en 3001 (ajustar PID de netstat)
Stop-Process -Id <PID> -Force
Remove-Item -Recurse -Force C:\Users\hecto\Nexus_Core\report\.next
cd C:\Users\hecto\Nexus_Core\report
npm run dev
```

---

## Validación mínima

```powershell
cd C:\Users\hecto\Nexus_Core\report
npx tsc --noEmit
npm run build   # solo con dev detenido
```

---

## Memoria Moria

- Inventario PP: [MUDANZA_PP_DETALLE_INVENTARIO.md](./MUDANZA_PP_DETALLE_INVENTARIO.md)
- CHUSAR padre: `.claude/2_modulos/2.3_report/proceso_importacion/CHUSAR_PEDIDO_PROVEEDOR.md`
