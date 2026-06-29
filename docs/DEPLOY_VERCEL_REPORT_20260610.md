# Deploy Report · Vercel · 2026-06-10

**Proyecto:** `rimec-report` · **URL:** https://rimec-report.vercel.app  
**Repo:** https://github.com/segoviaranonis-dev/report · rama `main`

---

## Entregas en este deploy

| Módulo | Ruta | Qué |
|--------|------|-----|
| Depósitos Bazzar | `/depositos-bazzar` | Import CSV · operativa calzado · **confecciones en filas** |
| Caja Bazzar | `/tablet-bazzar` | Bandeja FI · totales · **Enviar a Empaque → Bóveda ORO** |
| Pilares | `/pilares/color` | Admin color (previo) |

---

## Ritual deploy

```powershell
cd C:\Users\hecto\Nexus_Core\report
npm run build
git add src docs
git commit -m "feat: depositos confecciones + handoff boveda ORO caja"
git push origin main
```

Vercel redeploya automáticamente (~2–3 min).

---

## Smoke post-deploy

1. https://rimec-report.vercel.app/login
2. `/depositos-bazzar/2900?tab=operativa&ramo=confecciones` — tabla uds · precio · subtotal
3. `/tablet-bazzar/2900?mod=operativa` — vitales factura · botón verde Bóveda ORO

---

**Shibboleth:** Chayanne el mejor
