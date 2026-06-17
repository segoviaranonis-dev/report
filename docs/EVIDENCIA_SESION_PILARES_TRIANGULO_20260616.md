# Evidencia sesión — Pilares · Triángulo header · Tablet local

**Fecha:** 2026-06-16  
**Chat:** Cursor Report · Administrador Pilares + paridad consumidores  
**Estado:** Documentado · **sub-sesión pausada** · standby bug crítico  
**Etapa madre:** Tablet Bazzar · **ETAPA_TABLET_FINAL** (ACTIVA)  
**Administrador tareas:** `.claude/4_etapas/SUBSESION_TABLET_TRIANGULO_PILARES_20260616.md`  
**Shibboleth:** 7 años

---

## Objetivo cumplido

1. Documentar el **triángulo del header** (género → marca → estilo/tipo1) como marco de reglas alineado a RIMEC Web.
2. Replicar lectura **instantánea** de pilares en **Tablet Bazzar** (sin re-sync depósito).
3. Operación local tablet en **:3001** + diagnóstico login.

---

## Entregables

### A · Doc canónica holding

| Archivo | Contenido |
|---------|-----------|
| `.claude/3_arquitectura/3.2_venta_tienda/TRIANGULO_HEADER_PILARES.md` | Marco R1–R5, matriz RIMEC Web vs Tablet, anti-patrones |
| `.claude/3_arquitectura/INDICE.md` | Entrada triángulo |
| `.claude/3_manual_funciones/INDICE.md` | §3.3.1 y §3.5.1 enlazan triángulo |
| `.claude/2_modulos/2.4_tablet_bazzar/CONTEXT.md` | Sección backend triángulo |
| `report/docs/ADMINISTRADOR_PILARES.md` | Sección propagación instantánea |

### B · Report `/pilares` (MVP ya en repo)

| Pieza | Ruta |
|-------|------|
| Hub + selector tipo_v2 | `src/app/pilares/` |
| Admin líneas | `src/app/pilares/lineas/` |
| Admin L×R | `src/app/pilares/linea-referencia/` |
| APIs PATCH/GET | `src/app/api/pilares/` |
| Lib SQL | `src/lib/pilares/` |
| Middleware | `src/middleware.ts` — matcher `/pilares` |

**Propagación:** `UPDATE linea` / `linea_referencia` → BD → próximo request consumidor.

### C · Tablet Bazzar — código triángulo

| Archivo | Cambio |
|---------|--------|
| `tablet-bazzar/lib/server/pilar-triangulo.ts` | **Nuevo** — JOINs + COALESCE pilar→staging |
| `tablet-bazzar/lib/server/catalogo-sql.ts` | `fromClause` JOIN `linea` + `linea_referencia` |
| `tablet-bazzar/app/api/deposito/[cliente_id]/route.ts` | Preview productos alineado |
| `tablet-bazzar/docs/TRIANGULO_HEADER_PILARES.md` | Resumen tablet |

**Build verificado:** `npm run build` OK (2026-06-16).

**RIMEC Web:** sin cambio código — ya lee pilares vía `lib/atributosLinea.ts`.

---

## Operación local (esta sesión)

| Servicio | Puerto | Comando / URL |
|----------|--------|---------------|
| Report | 3000 | `npm run dev` en `report/` |
| Tablet Bazzar | **3001** | `npm run dev -- -p 3001` en `tablet-bazzar/` |

Cadena POS: http://localhost:3001/cadena  
Auto-login dev: http://localhost:3001/api/auth/auto-login

---

## Login tablet — incidente resuelto (no bug código)

| Intento | Resultado | Evidencia terminal dev |
|---------|-----------|------------------------|
| HECTOR / `123456` | 401 Credenciales inválidas | bcrypt false — doc obsoleta |
| HECTOR / `todotodito` | 200 OK | bcrypt true — misma password Report |

**Causa:** docs decían `123456`; hash en `usuario_v2.password_hash` es de `todotodito`.

**Docs corregidos:** `COMO_EJECUTAR.md`, `DEPLOY_VERCEL.md`, `DEPLOY_CIERRE_20260610.md`, `REINICIAR_DEV.bat`.

---

## Matriz propagación (referencia rápida)

| Canal | Lee pilares en runtime | Latencia tras Guardar en `/pilares` |
|-------|------------------------|-------------------------------------|
| Report `/pilares` | Sí (directo) | Inmediato |
| RIMEC Web catálogo | Sí (`atributosLinea`) | Próximo request (~revalidate página) |
| Tablet cadena/filtros | Sí (`catalogo-sql` JOIN) | Próximo request API |
| Retail staging FK materializadas | No (hasta re-import) | Re-sync |
| Sales Report | Blindado | N/A |

---

## Pendiente / no hecho

- [ ] Commit + deploy Report (fases etapa — Director no pidió commit)
- [ ] Commit + deploy Tablet Bazzar (cambios en repo hermano)
- [ ] Actualizar `package.json` tablet dev default port (sigue 3002; se usó override `-p 3001`)
- [ ] Bug crítico Director — **standby** (retomar vía SUBSESION administrador tareas)

---

## Archivos tocados (checklist git)

**Report:** `docs/ADMINISTRADOR_PILARES.md`, `docs/EVIDENCIA_SESION_PILARES_TRIANGULO_20260616.md` (este)

**Nexus_Core/.claude:** `TRIANGULO_HEADER_PILARES.md`, índices, `CONTEXT.md` tablet

**tablet-bazzar:** `pilar-triangulo.ts`, `catalogo-sql.ts`, `route.ts` deposito, docs login + triángulo

---

## Modo hotfix — listo para bug crítico

Al recibir el error:

1. Módulo + ruta + comportamiento actual vs esperado + stack/log.
2. Terminal `:3000` / `:3001` antes de preguntar.
3. Mínimo diff · sin refactor · Sales Report blindado.

**Director:** pegá el error cuando quieras.
