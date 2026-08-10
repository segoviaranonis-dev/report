# Guía Guido — verificación Sit Fin (antes de validar números)

**Fecha:** 2026-08-10 · doc Moria **2.3.1.50.15**  
**Gate automático:** `node scripts/situacion-financiera/_audit_ejecucion_sf_cadena.mjs` → **ok: true**

---

## Canones (única verdad de comparación)

| Mes | Archivo |
|-----|---------|
| Julio | `Z:\hector\SF\07.SITUACION FINANCIERA 01072026.xlsx` |
| Agosto | `Z:\hector\SF\08.SITUACION FINANCIERA 01082026.xlsx` |

**Excluido de la comparativa:** `SF AL 03-08.xlsx` (errores conocidos · solo contexto de grilla).

Si otro archivo del legajo no calza → verificar contra los dos canones.

---

## Qué mirar en Report (`/situacion-financiera`)

1. Pestaña **Excel AL**
2. **Activar comparación** → columnas **Julio USD · Agosto USD · % var.** = montos de los canones (no de Sit Fin isla).
3. Panel muestra las rutas `Z:\hector\SF\…`.
4. ⚠ Δ / TXT → burbuja con archivos reales del intake (otro tema: Excel↔TXT).
5. Pestaña **Auditoría** → Gate Guido **PASS**.

---

## Parámetros

| Ítem | Valor |
|------|--------|
| Comparación UI | Solo Jul↔Ago · modo `usd_vs_usd_canon_admin` |
| Tasa Jul / Ago | 6085 / 5970,96 |
| Luisito stock TXT | Cadena DIAZ E HIJOS · auditoría vs canon (no define %) |

---

## Regenerar LAB

```text
cd report
python scripts/situacion-financiera/_gen_comparacion_ago_jul.py
node scripts/situacion-financiera/_audit_ejecucion_sf_cadena.mjs
```
