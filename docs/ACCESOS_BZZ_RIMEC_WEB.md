# Accesos Bazzar · RIMEC Web · Report · Tablet

> **Etapa:** `.claude/4_etapas/ETAPA_ACCESOS_HOLDING_BZZ_CERRADA.md`  
> **Hotfix menú Report (2026-06-26):** [HOTFIX_BZZ_MENU_REPORT_20260626.md](./HOTFIX_BZZ_MENU_REPORT_20260626.md)  
> **Ayuda memoria Director:** [AYUDA_MEMORIA_USUARIOS_ACCESOS_BZZ.md](./AYUDA_MEMORIA_USUARIOS_ACCESOS_BZZ.md)  
> **Matriz canónica:** `.claude/1_fundamentos/1.3_politicas/MATRIZ_ROLES_ACCESOS_HOLDING.md`

---

## Regla rápida

- **Contraseña tienda BZZ** = número depósito (`BZZSN` → **2700**, `BZZPN` → **3200**, `BZZFN` → **2900**).
- **Todos BZZ\*** → **`rol_id=2`** (nunca 1 ni 3).
- **Report BZZ ADMIN:** solo **Stock/Retail · Depósitos · Caja** — sin RIMEC ni BAZZAR WEB.
- **RIMEC Web:** solo **ADMIN** tienda (`rol_id=2` + `ADMIN`). Vendedor tienda bloqueado.
- **Tablet:** ADMIN + VENDEDOR tienda (`rol_id=2`).

---

## Scripts administración

```powershell
cd C:\Users\hecto\Nexus_Core\report

# Rol + ente BZZ*
python scripts/corregir_rol_bzz_usuario_v2.py

# Password = depósito
python scripts/sincronizar_password_bzz_deposito.py
```

---

## Enforcement código

| App | Archivos clave |
|-----|----------------|
| **Report** | `src/lib/auth/bzz-acceso.ts` · `validateUsuario.ts` · `middleware.ts` · `hub-modules.ts` · `ente-acceso.ts` · `/api/auth/me` |
| **Tablet** | `lib/auth/bzz-acceso.ts` · `app/api/auth/login/route.ts` |
| **RIMEC Web** | `rimec-web/lib/auth/roles.ts` → `puedeAccederRimecWeb()` |

---

## Organigrama visual

http://localhost:3004/accesos (Navegador Holding)

---

## Prod

| App | URL |
|-----|-----|
| Report | https://rimec-report.vercel.app |
| Tablet | Vercel proyecto tablet-bazzar |

Tras deploy: **logout + login** usuario BZZ.
