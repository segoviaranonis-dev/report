# Guía Guido — verificación Sit Fin (antes de validar números)

**Fecha:** 2026-08-10 · doc Moria **2.3.1.50.13**  
**Gate automático:** `node scripts/situacion-financiera/_audit_ejecucion_sf_cadena.mjs` → **ok: true**

---

## Qué mirar en Report (`/situacion-financiera`)

1. Pestaña **Excel AL**
2. Si ves **⚠ Δ** al lado de un concepto → **clic** → burbuja explica descuadre Excel↔TXT (canon = TXT, no parchear).
3. Botón **Activar comparación** → solo **Julio USD vs Agosto USD + %** (tasas 6085 / 5970,96).
4. Acordeón molecular (▸) → Cadena → Cliente → Factura cuando hay TXT.
5. Pestaña **Auditoría** → Gate Guido **PASS**.

---

## Parámetros (corte)

| Ítem | Valor |
|------|--------|
| Comparación | Solo Jul↔Ago · modo `usd_vs_usd` |
| Tasa Jul / Ago | 6085 / 5970,96 |
| Luisito | Cadena DIAZ E HIJOS · 12 cli · 284 fac · Gs 2.015.617.848 |
| Isla | `2.3.1.50.12` · sin resultados Nexus operativos |

---

## Regenerar LAB

```text
cd report
python scripts/situacion-financiera/_gen_comparacion_ago_jul.py
node scripts/situacion-financiera/_audit_ejecucion_sf_cadena.mjs
```
