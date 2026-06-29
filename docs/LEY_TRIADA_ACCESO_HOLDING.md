# Ley triada acceso — Ente × Rol × Categoría

**Migración:** `130_triada_acceso_holding.sql`  
**Admin local:** `/pilares/usuarios` (solo dev)  
**Acreditación Report:** `src/lib/auth/ente-acceso.ts`

---

## Tres ejes (AND)

| Eje | Campo | Significado |
|-----|-------|-------------|
| **Ente** | `usuario_v2.ente_id` → `entes.codigo` | Scope sesión · qué **grupo** de módulos Report ve |
| **Rol orgánico** | `usuario_v2.rol_id` → `maestro_rol_acceso.nivel` | 1 Gerente · 2 Admin · 3 Ejecutor · 4 Externo |
| **Categoría** | `usuario_v2.categoria_id` → `usuario_categoria.nivel` | 1 DIOS · 2 ADMIN · 3 VENDEDOR · 4 OPERARIO |

**Menor número = más poder.**

---

## Leyes

1. **Categoría no superior al rol:** `categoria.nivel >= rol.nivel`.

2. **DIOS:** ente cod **1** (RIMEC) + rol nivel **1** + categoría nivel **1**.

3. **Usuario independiente de RRHH:** `funcionario_id` **no** es requisito para usuario. Trigger `fn_validar_usuario_triada` actualizado 2026-06-10.

4. **Acreditación por ente (Report):**

| Ente cod | Grupos hub |
|----------|------------|
| 1 | RIMEC |
| 2–4 | Bazzar tienda |
| 5 | Bazzar Web |
| rol_id 1 | Todos |

5. **Ente árbol:** `entes.parent_id_ente` — hojas con `cliente_id` (2100…5000) para tablet/RRHH, no para `usuario_v2.ente_id` (usar ente **principal**).

---

## Ejemplos Report (post-cierre)

| Usuario | Ente | Rol | Cat | Header |
|---------|------|-----|-----|--------|
| Guido | 1 RIMEC | 1 | DIOS | RIMEC + Bazzar + Bazzar Web |
| BZZSN | 3 San Martín | 2 | ADMIN | **Solo BAZZAR** (Retail, Depósitos, Caja) |
| BZZPN | 4 Palma | 2 | ADMIN | Idem |

---

## Aplicar

```powershell
cd C:\Users\hecto\Nexus_Core\report
python scripts/aplicar_migracion_130.py
python scripts/fix_fn_validar_usuario_triada.py
```

Tras cambios: **logout + login** (`REPORT_SESSION_VERSION=4`).
