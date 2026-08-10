# Guía Guido — verificación Sit Fin (antes de validar números)

**Fecha:** 2026-08-10  
**Gate automático:** `node scripts/situacion-financiera/_audit_ejecucion_sf_cadena.mjs` → debe ser **ok: true**  
**Artefacto:** `src/lib/situacion-financiera/audit-ejecucion-sf-cadena.json`

---

## Qué mirar en Report (`/situacion-financiera`)

1. Pestaña **Excel AL** → botón **Activar comparación**
   - Julio = info base (Excel admin ratificado)
   - Agosto = Nexus mapeado (no copiado del Excel)
   - Δ % = Agosto Nexus vs Julio
2. Acordeón **PAGO LUISITO** (verde TXT):
   - Nivel 1: **Cadena · DIAZ E HIJOS S.A** (`cliente_cadena_v2`)
   - Nivel 2: 12 clientes
   - Nivel 3: 284 facturas con `Linea_Limpia` del TXT
   - Total Gs: **2.015.617.848** (stock TXT × tipo cobro LUISITO)
3. Pestaña **Auditoría** → sección **0 · Ejecución real + cliente_cadena_v2**
   - Gate Guido: **PASS**

---

## Parámetros correctos (corte actual)

| Parámetro | Valor esperado | Evidencia |
|-----------|----------------|-----------|
| Julio base mes | 2026-07 | `referencia-admin-jul-0107.json` |
| Julio tasa | 6085 | idem |
| Agosto tasa Nexus | 5970.96 | `referencia-admin-ago` / Excel AL |
| Luisito molecular Gs | 2.015.617.848 | `molecular-al-0308` `luisito:cuadro` |
| Luisito cadenas | 1 (DIAZ E HIJOS S.A) | cliente_cadena_v2 id=5 |
| Luisito clientes / fac | 12 / 284 | audit ejecución |
| Cobertura cadena Luisito | 12 con / 0 sin | BD live |
| Fidelidad Nexus↔Admin Ago | 50% (7/14) | **no parchear** — Δ semánticos (Luisito stock≠proyección) |

---

## Ley anti-parche (para Guido y admin)

- Excels `Z:\hector\SF\07…` y `08…` = **referencia**, no fuente del molecular.
- Molecular = TXT ERP + `clientes.xlsx` col C + **`cliente_cadena_v2`**.
- Si hay descuadre vs Excel: **reportar**, no editar JSON a mano.

---

## Regenerar LAB

```text
cd report
node scripts/situacion-financiera/_export_cliente_cadena_snapshot.mjs
python scripts/situacion-financiera/_gen_molecular_al.py
python scripts/situacion-financiera/_audit_mapa_excel_txt.py
python scripts/situacion-financiera/_gen_comparacion_ago_jul.py
node scripts/situacion-financiera/_audit_ejecucion_sf_cadena.mjs
```

---

## Pendiente de producto (siguiente ola, no bloquea esta verificación)

1. Luisito **mes** = explosión cuotas (cuadro) filtrada cadena/tipo — distinto del stock acordeón.
2. Aging Sit Fin alineado al universo Guido (OK vs total).
3. Completar más filas en `cliente_cadena_v2` (hoy ~96/3140 con cadena).
