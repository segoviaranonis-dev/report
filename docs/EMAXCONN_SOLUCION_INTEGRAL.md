# EMAXCONN — Solución integral pool Supabase + Vercel

**Módulo:** Report (`rimec-report.vercel.app`)  
**Síntoma:** `(EMAXCONN) max client connections reached, limit: 200`  
**Afectados:** Bandeja IC (AUTORIZAR), Ventas con fotos, Sales Report snapshot, otros APIs con Postgres.

---

## 1. Qué es el error

Supabase expone Postgres vía **pooler** (PgBouncer / Supavisor) con techo ~**200 conexiones clientes** simultáneas.

Report en **Vercel** = muchas **lambdas serverless** en paralelo. Cada lambda que abre conexiones al pooler consume cupo. Cuando el holding tiene:

- Alfredo autorizando IC (decenas de clicks),
- otro usuario en **Ventas con fotos**,
- prefetch de **Sales Report** (meta + full-snapshot),
- digitación, panel, etc.,

…se llega al límite 200 y Postgres rechaza con `max client connections reached`.

**No es bug de datos del usuario** — es arquitectura serverless × pool compartido.

---

## 2. Causas raíz identificadas (2026-07-09)

| # | Causa | Impacto |
|---|--------|---------|
| A | Pool `pg` con `max: 8` por lambda + singleton que retiene conexiones idle | v1 prod |
| B | `Promise.all` con 3–5 queries paralelas por request | Multiplica conexiones por lambda |
| C | AUTORIZAR IC recargaba **toda** la bandeja pendientes tras cada click | Picos al importar programados |
| D | **Sales Report prefetch** en login/home dispara meta + full-snapshot sin estar en `/rimec` | Carga fantasma constante |
| E | Cliente efímero sin mutex: `Promise.all` en full-snapshot = 3 conexiones simultáneas por lambda | v3 parcial |
| F | Ventas-fotos caía a **modo demo** ante EMAXCONN (mensaje confuso) | Segundo reclamo usuario |
| G | `DATABASE_URL` directo `:5432` en vez de pooler `:6543` | Empeora si aplica en Vercel |

---

## 3. Solución implementada (canónica en código)

### 3.1 Capa única — `src/lib/rimec/pool.ts`

- **Vercel:** `VercelEphemeralPg` — conecta → query → **cierra** (no retiene idle).
- **Mutex por lambda:** queries en la misma instancia se **serializan** (evita 3 conexiones en `Promise.all`).
- **Reintentos:** hasta 8 intentos con backoff exponencial ante EMAXCONN.
- **URL:** `DATABASE_POOLER_URL` (preferida) o `DATABASE_URL` normalizada con `pgbouncer=true` + `connection_limit=1` si host es `*.pooler.supabase.com`.
- **Local:** Pool clásico `max: 8`.

### 3.2 Helpers transversales

| Archivo | Rol |
|---------|-----|
| `pool-saturated.ts` | Detecta EMAXCONN + respuesta JSON 503 estándar |
| `fetch-api-retry.ts` | Retry cliente HTTP (IC, ventas-fotos, etc.) |
| `ic-api-error.ts` | Respuesta API IC ante saturación |

### 3.3 Módulos tocados

- **IC:** AUTORIZAR sin reload bandeja; retry cliente/servidor (`IcPendienteCard`, rutas `[id]/autorizar`).
- **Ventas-fotos:** APIs meta/ventas → 503 + code `EMAXCONN`; cliente **no** usa demo si pool saturado.
- **Sales Report:** prefetch **desactivado en Vercel** salvo `RIMEC_SALES_PREFETCH=1`.
- **full-snapshot / meta:** respuesta 503 estándar ante saturación.

### 3.4 Prefetch Panel Alejandro Magno

Desactivado en `MundoPanelControl` (3 APIs productos pesadas).

---

## 4. Variables Vercel (obligatorio verificar)

```env
# Preferido — Transaction pooler Supabase puerto 6543
DATABASE_POOLER_URL=postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres

# Fallback si no hay pooler URL separada (debe ser :6543, no :5432)
DATABASE_URL=...

# Opcional — tuning
RIMEC_PG_POOL_MAX=1
RIMEC_PG_RETRY_MAX=8
RIMEC_SALES_PREFETCH=0   # default implícito en Vercel; =1 solo si Director autoriza
```

**Prohibido en prod serverless:** `db.*.supabase.co:5432` (conexión directa, sin pooler).

---

## 5. Operación — qué decir al usuario

1. **Ctrl+F5** tras deploy.
2. Si banner amarillo/rojo «pool saturado»: esperar **15–30 s** — retry automático.
3. **No** confundir modo demo (solo sin `DATABASE_URL`) con error real de pool.
4. Picos mañana (IC + ventas-fotos + report): escalonar usuarios si persiste.

---

## 6. Historial hotfixes

| Commit | Cambio |
|--------|--------|
| `26f1e5c` | pool max 1; pendientes secuencial |
| `d67a5e0` | pgbouncer; devueltas secuencial; retry bandeja |
| `d224dd8` | cliente efímero; AUTORIZAR sin reload |
| *(integral)* | mutex lambda; prefetch off; ventas-fotos; DATABASE_POOLER_URL |

---

## 7. Próximo escalón (infra — decisión Director)

Si tras solución integral sigue EMAXCONN en hora pico:

1. Subir plan Supabase / pool size.
2. Migrar driver a **Supabase serverless** (`@supabase/supabase-js` HTTP) para lecturas pesadas.
3. Cola Redis (Upstash) para serializar escrituras IC en hora pico.
4. Separar BD lectura report vs escritura operativa (read replica).

---

**Shibboleth doc:** Andrés, el que viene.  
**Mantenimiento:** Cursor hotfix · Claude Code deploys · Director valida Vercel env.
