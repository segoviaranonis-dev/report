# HOTFIX — Menú Report BZZ · rol_id y columnas hub

**Código:** `HOLD-BZZ-MENU-REPORT-20260626`  
**Fecha:** 2026-06-26  
**Director:** documentación + deploy Report + Tablet  
**Matriz:** `.claude/1_fundamentos/1.3_politicas/MATRIZ_ROLES_ACCESOS_HOLDING.md`

---

## Problema

Usuarios `BZZ*` (ej. **BZZF**) entraban a Report con **`rol_id=1`** en BD → header mostraba **RIMEC** (RRHH) y **BAZZAR WEB** (Compra, Depósito Web). Violaba matriz ADMIN BAZZAR: solo columna **BAZZAR tienda**.

---

## Causa raíz

| Capa | Fallo |
|------|--------|
| **BD** | `BZZF`, `BZZFN`, `BZZPN` tenían `rol_id=1`; `BZZP`/`BZZS` tenían `rol_id=3` |
| **Hub** | `bazzarAdminOnly` dejaba pasar BAZZAR WEB a `rol_id=2` + ADMIN |
| **Sesión** | JWT viejo conservaba `rol_id=1` tras fix BD |

---

## Solución

### 1 · Base de datos

Script: `report/scripts/corregir_rol_bzz_usuario_v2.py`

- Todo `BZZ*` → **`rol_id=2`**
- Ente inferido por sede: `F→2`, `S→3`, `P→4`, `BZZF→2`

Estado final BD (2026-06-26):

| Usuario | rol_id | categoria | ente |
|---------|--------|-----------|------|
| BZZF | 2 | ADMIN | 2 |
| BZZFN | 2 | ADMIN | 2 |
| BZZPN | 2 | ADMIN | 4 |
| BZZSN | 2 | ADMIN | 3 |
| BZZP | 2 | VENDEDOR | 4 |
| BZZS | 2 | VENDEDOR | 3 |

### 2 · Report — enforcement código

| Archivo | Función |
|---------|---------|
| `src/lib/auth/bzz-acceso.ts` | `aplicarAccesoCanonicoBzz()` — BZZ* nunca rol 1/3 |
| `src/lib/auth/validateUsuario.ts` | Corrige en login + persiste UPDATE |
| `src/middleware.ts` | Corrige JWT en vuelo; rutas rol 2 sin `/bazzar-web` ni `/rrhh` |
| `src/app/api/auth/me/route.ts` | Header lee rol corregido sin re-login |
| `src/lib/auth/ente-acceso.ts` | `rol_id=2` → solo grupo `bazzar` |
| `src/lib/report/hub-modules.ts` | Rol 2: solo Retail · Depósitos · Caja |

**Menú visible BZZ ADMIN:** Stock/Retail · Depósitos · Caja — **nada más**.

### 3 · Tablet — paridad login

| Archivo | Función |
|---------|---------|
| `lib/auth/bzz-acceso.ts` | Misma regla BZZ → rol 2 |
| `app/api/auth/login/route.ts` | Corrige rol; permite `VENDEDOR` rol 2 (POS) |

---

## Operación

```powershell
# Corregir BD (idempotente)
cd C:\Users\hecto\Nexus_Core\report
python scripts/corregir_rol_bzz_usuario_v2.py

# Passwords depósito
python scripts/sincronizar_password_bzz_deposito.py
```

Tras deploy: **logout + login** (o F5 si `/api/auth/me` ya corrige).

---

## Deploy

| App | Prod | Repo |
|-----|------|------|
| Report | https://rimec-report.vercel.app | `segoviaranonis-dev/report` |
| Tablet | Vercel tablet-bazzar | `tablet-bazzar` |

---

## Referencias

- [ACCESOS_BZZ_RIMEC_WEB.md](./ACCESOS_BZZ_RIMEC_WEB.md)
- [AYUDA_MEMORIA_USUARIOS_ACCESOS_BZZ.md](./AYUDA_MEMORIA_USUARIOS_ACCESOS_BZZ.md)
- Moria: `.claude/4_etapas/ETAPA_ACCESOS_HOLDING_BZZ_CERRADA.md` (addendum 2026-06-26)

**Shibboleth:** Chayanne el mejor
