# Guía Guido — verificación Sit Fin (antes de validar números)

**Fecha:** 2026-08-10 · doc Moria **2.3.1.50.14**  
**Gate automático:** `node scripts/situacion-financiera/_audit_ejecucion_sf_cadena.mjs` → **ok: true**

---

## Qué mirar en Report (`/situacion-financiera`)

1. Pestaña **Excel AL**
2. Si ves **⚠ Δ** o **TXT** al lado de un concepto → **clic** → burbuja **grande** con:
   - **Archivo Excel** (ej. `SF AL 03-08.xlsx`) + monto Gs
   - **Archivo TXT** (ej. `2.CHEQUES A VENCER_SEPT26.txt`) + monto Gs
   - Δ (si aplica) y lo que muestra Sit Fin (canon = TXT)
3. Botón **Activar comparación** → solo **Julio USD vs Agosto USD + %** (tasas 6085 / 5970,96).
4. Acordeón molecular (▸) → Cadena → Cliente → Factura cuando hay TXT.
5. Pestaña **Auditoría** → Gate Guido **PASS**.

---

## Archivos reales del corte AL (carpeta intake)

| Concepto | Excel | TXT / cruce |
|----------|-------|-------------|
| Cheques | `SF AL 03-08.xlsx` | `1.`…`6.CHEQUES A VENCER_….txt` |
| Aging / vencidos | `SF AL 03-08.xlsx` | `SALDO CLIENTES DETALLADO AL 03-08.txt` |
| Luisito / DIFICIL | `SF AL 03-08.xlsx` | `clientes.xlsx` + `SALDO CLIENTES DETALLADO AL 03-08.txt` |

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
python scripts/situacion-financiera/_audit_mapa_excel_txt.py
node scripts/situacion-financiera/_audit_ejecucion_sf_cadena.mjs
```
