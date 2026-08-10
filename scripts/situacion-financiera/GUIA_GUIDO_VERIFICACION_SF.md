# Guía Guido — verificación Sit Fin

**Fecha:** 2026-08-10 · doc Moria **2.3.1.50.17**  
**Gate:** `node scripts/situacion-financiera/_audit_ejecucion_sf_cadena.mjs` → **ok: true**

---

## Canones

| Mes | Archivo |
|-----|---------|
| Julio | `Z:\hector\SF\07.SITUACION FINANCIERA 01072026.xlsx` |
| Agosto | `Z:\hector\SF\08.SITUACION FINANCIERA 01082026.xlsx` |

---

## Burbujas ⚠ Δ

Solo si el concepto es **Jul o Ago** y el monto del **canon** ≠ **TXT**.  
La burbuja muestra **solo** esos dos archivos.  
Meses sep… → **sin burbuja**.

## Activar comparación

Columnas Julio USD · Agosto USD · % = **solo** montos USD de los dos canones.

---

## Regenerar

```text
cd report
python scripts/situacion-financiera/_gen_comparacion_ago_jul.py
node scripts/situacion-financiera/_audit_ejecucion_sf_cadena.mjs
```
