# Administrador de Usuarios — SOLO LOCAL

> **⚠️ ESTE MÓDULO NO SE SUBE AL PROYECTO EN PRODUCCIÓN.**  
> Herramienta de taller en dev para gestionar `usuario_v2`.  
> La **acreditación por ente** (header/middleware) sí aplica a Report en general tras login.

**Ruta:** http://localhost:3001/pilares/usuarios (`NODE_ENV=development`, `rol_id=1`)  
**Etapa cerrada:** `.claude/4_etapas/ETAPA_USUARIOS_ADMIN_ACREDITACION_CERRADA.md`  
**CHUSAR:** `.claude/2_modulos/2.3_report/pilares/CHUSAR_USUARIOS_ADMIN.md`

---

## Esquema

| Pieza | Tabla / campo |
|-------|---------------|
| Usuarios | `usuario_v2` — login Report + Streamlit |
| Roles | `maestro_rol_acceso` ← `usuario_v2.rol_id` |
| Categoría | `usuario_categoria` ← `usuario_v2.categoria_id` |
| Ente | `usuario_v2.ente_id` → `entes.codigo` |
| Password | `password_hash` (bcrypt) + legacy `password` placeholder |

**Usuario ≠ funcionario:** no usar `funcionario_id` como requisito de alta. RRHH vive en `funcionarios` (import separado).

---

## Entes principales (`usuario_v2.ente_id`)

| cod | Ente | Hub Report (rol ≠ 1) |
|-----|------|----------------------|
| 1 | RIMEC | Módulos RIMEC |
| 2 | Fernando | Solo Bazzar tienda |
| 3 | San Martín | Solo Bazzar tienda |
| 4 | Palma | Solo Bazzar tienda |
| 5 | Bazzar Web | Módulos e-commerce |

Puntos tablet (cod 6–12, con `cliente_id`) — para RRHH/piso, no asignar como `ente_id` de usuario salvo excepción documentada.

---

## Migraciones

```powershell
cd C:\Users\hecto\Nexus_Core\report
python scripts/aplicar_migracion_127.py
python scripts/aplicar_migracion_129.py
python scripts/aplicar_migracion_130.py
python scripts/fix_fn_validar_usuario_triada.py
```

Doc triada: `docs/LEY_TRIADA_ACCESO_HOLDING.md`

---

## Funcionalidades

| Feature | Descripción |
|---------|-------------|
| Alta manual | Crea fila en `usuario_v2` con bcrypt |
| Import Excel | FUNCIONARIOS.xlsx → cuentas (ROL/CATEGORIA del Excel) |
| Editor | Acordeón Ente → Rol → Categoría |
| Ley triada | App + trigger `fn_validar_usuario_triada` |

---

## Sesión Report

Tras cambios de acreditación: **`REPORT_SESSION_VERSION=4`** — logout + login obligatorio.

JWT incluye: `ente_id`, `ente_codigo`.

---

## Dev — `.next` corrupto

Si aparece `Cannot find module './1331.js'`: no correr `npm run build` con dev activo.

```powershell
npm run dev:clean:3001
```

Error holding: **4.02.02.002**

---

## Reglas

1. No deploy `/pilares/usuarios` a Vercel sin OT.  
2. Sales Report (`registro_ventas_general_v2`) blindado — sin JOIN pilares.  
3. Import RRHH → `scripts/importar_rrhh_tiendas.py` (tabla `funcionarios`, no usuarios).
