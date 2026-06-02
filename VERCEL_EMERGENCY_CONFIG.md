# 🚨 Configuración de Emergencia Vercel — rimec-report

**Fecha**: 2026-06-01  
**Problema**: App deployada sin variables de entorno → ningún módulo funciona  
**Solución**: Configurar 4 variables críticas en Vercel

---

## PASO 1 — Acceder a Settings

1. **Vercel Dashboard** → https://vercel.com/dashboard
2. Proyecto **rimec-report**
3. **Settings** → **Environment Variables**

---

## PASO 2 — Agregar Variables (una por una)

### ✅ Variable 1: DATABASE_URL (CRÍTICA)

**Name**: `DATABASE_URL`

**Value**: 
```
postgres://postgres.extrlcvcgypwazxipvqm:IJoFJbT8Qj0Q0w5m@aws-1-sa-east-1.pooler.supabase.com:6543/postgres
```

**Environments**: ✅ Production, ✅ Preview, ✅ Development

**Notas**:
- Puerto **6543** (pooler mode, NO 5432)
- Ya incluye `sslmode=require` por defecto
- Sin esto: "Sin base configurada en servidor"

---

### ✅ Variable 2: REPORT_SESSION_SECRET (CRÍTICA)

**Name**: `REPORT_SESSION_SECRET`

**Value**: Generar uno nuevo (ejecutar en terminal local):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Ejemplo generado hoy:
```
ffb309cd0e0bbd68a1a2c22bf216db04de9c8c831828331b200910231081afac
```

**Environments**: ✅ Production, ✅ Preview, ✅ Development

**Notas**:
- Sin esto: login no funciona (error 500 en /api/auth/login)
- Usa el mismo valor en los 3 environments
- Nunca commitear a git

---

### ✅ Variable 3: NEXT_PUBLIC_SUPABASE_URL

**Name**: `NEXT_PUBLIC_SUPABASE_URL`

**Value**:
```
https://extrlcvcgypwazxipvqm.supabase.co
```

**Environments**: ✅ Production, ✅ Preview, ✅ Development

**Notas**:
- Necesario para Storage (imágenes de productos)
- Sin esto: /ventas-fotos no muestra fotos

---

### ✅ Variable 4: NEXT_PUBLIC_SUPABASE_ANON_KEY

**Name**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Value**:
```
sb_publishable_rPh5OoJ9d-i8zNJ9i0uZRw_Hy9WrIBc
```

**Environments**: ✅ Production, ✅ Preview, ✅ Development

**Notas**:
- Anon key (pública, segura para frontend)
- Nunca usar service_role en frontend

---

## PASO 3 — Redeploy Production

**Después de agregar las 4 variables**:

1. **Deployments** (tab superior)
2. Buscar **Latest Deployment** (el más reciente)
3. Click en los **3 puntos** (⋮) → **Redeploy**
4. Confirmar → **Redeploy**

⏱️ Esperar 2-3 minutos hasta que status = **Ready**

---

## PASO 4 — Verificación (Smoke Test)

Abrir en navegador privado (incógnito):

### 1. Login obligatorio
```
https://rimec-report.vercel.app/
```
- ✅ Debe redirigir a `/login`
- ✅ Login con usuario `DIRECTOR` (contraseña desde usuario_v2)
- ✅ Después de login → redirect a `/`

### 2. Dashboard RIMEC
```
https://rimec-report.vercel.app/rimec
```
- ✅ NO debe mostrar "Sin base configurada"
- ✅ Debe cargar marcas en filtros
- ✅ Botón "Sincronizar" funciona

### 3. Retail Stock
```
https://rimec-report.vercel.app/retail
```
- ✅ NO debe mostrar "self-signed certificate"
- ✅ Debe cargar batches/lotes
- ✅ Datos de stock visibles

### 4. Ventas Fotos
```
https://rimec-report.vercel.app/ventas-fotos
```
- ✅ Debe cargar marcas en dropdown
- ✅ Tabla con datos después de filtrar
- ✅ Imágenes de productos visibles

---

## ⚠️ Troubleshooting

### Problema: "Sin base configurada"
- ✅ Verificar que `DATABASE_URL` esté en Production
- ✅ Valor correcto con puerto **6543**
- ✅ Redeploy después de agregar

### Problema: Login muestra error 500
- ✅ Verificar que `REPORT_SESSION_SECRET` exista
- ✅ Debe tener al menos 32 caracteres
- ✅ Redeploy

### Problema: "self-signed certificate in certificate chain"
- ✅ Ya está corregido en código (pool.ts línea 27-30)
- ✅ Solo redeploy con DATABASE_URL correcta

### Problema: Imágenes no cargan en /ventas-fotos
- ✅ Verificar `NEXT_PUBLIC_SUPABASE_URL`
- ✅ Verificar `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- ✅ Verificar Storage bucket "productos" público en Supabase

---

## 📋 Resumen Variables Requeridas

| Variable | Environments | Crítica | Valor |
|----------|--------------|---------|-------|
| `DATABASE_URL` | Prod+Prev+Dev | ✅ SÍ | postgres://...pooler.supabase.com:6543/... |
| `REPORT_SESSION_SECRET` | Prod+Prev+Dev | ✅ SÍ | 64 chars hex (generar con crypto) |
| `NEXT_PUBLIC_SUPABASE_URL` | Prod+Prev+Dev | ⚠️ Imágenes | https://extrlcvcgypwazxipvqm.supabase.co |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Prod+Prev+Dev | ⚠️ Imágenes | sb_publishable_... |

**Sin las 2 críticas**: App NO funciona  
**Sin las 2 de Supabase**: App funciona pero sin imágenes

---

## ✅ Checklist Final

- [ ] 4 variables agregadas en Vercel Settings
- [ ] Redeploy completado (status = Ready)
- [ ] Login funciona en navegador privado
- [ ] /rimec carga datos (no "Sin base")
- [ ] /retail sin error certificado
- [ ] /ventas-fotos con marcas y datos
- [ ] Imágenes de productos visibles

---

**Tiempo estimado**: 10 minutos  
**Último deploy**: Verificar en Vercel → Deployments → Latest
