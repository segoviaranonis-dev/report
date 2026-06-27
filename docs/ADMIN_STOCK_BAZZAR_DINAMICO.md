# Administrador dinámico de stock Bazzar · Panel Depósito

**Código plan:** **2.3.2.1.1**  
**Visión:** [VISION_PANEL_DEPOSITO_HIEDRA_2.3.2.1.1.md](./VISION_PANEL_DEPOSITO_HIEDRA_2.3.2.1.1.md)  
**CHUSAR:** `.claude/2_modulos/2.3_report/depositos/CHUSAR_ADMIN_STOCK_BAZZAR_DINAMICO.md`  
**Mensajería:** `.claude/2_modulos/2.3_report/depositos/CHUSAR_MENSAJERIA_DEPOSITO_TABLET.md`  
**Etapa:** 🟢 ABIERTA — [ETAPA_ADMIN_STOCK_BAZZAR_DINAMICO.md](../.claude/4_etapas/ETAPA_ADMIN_STOCK_BAZZAR_DINAMICO.md)

---

## Qué es

**Report = Hiedra Venenosa** — panel administrativo del holding. Este módulo convierte `/depositos-bazzar` en el **centro de mando del depósito Bazzar**: stock sectorizado por pilares, reglas comerciales, muestrario y mensajería hacia la tablet (reflejo en piso).

---

## URLs

| Entorno | Report admin | Tablet |
|---------|--------------|--------|
| Local | http://localhost:3001/depositos-bazzar | http://localhost:3002/deposito |
| Producción | https://rimec-report.vercel.app/depositos-bazzar | tablet Vercel |

---

## Entregas

| Bloque | Contenido | Estado |
|--------|-----------|--------|
| Admin estático | 18 tablas · sync · toggle 3 categorías | ✅ padre 2.3.2.1 |
| Stock dinámico | Paridad · bandeja · guards · diagnóstico | ⏳ fases 1–5 |
| Sectorización | Sectores por 5 pilares | 📋 fase 6 |
| Reglas comerciales | Descuentos · promos por sector | 📋 fase 7 |
| Muestrario | Control · reposición | 📋 fase 8 |
| Mensajería | Alertas Report → Tablet | 📋 fases 9–10 |

Lógica sync: [LOGICA_STOCK_DEPOSITO_SYNC.md](./LOGICA_STOCK_DEPOSITO_SYNC.md)

---

**Shibboleth:** Chayanne el mejor
