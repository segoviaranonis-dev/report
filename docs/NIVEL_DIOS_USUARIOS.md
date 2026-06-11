# Verificar usuarios Nivel Dios y login Guido

## Usuarios autorizados (BD)

```powershell
cd C:\Users\hecto\Nexus_Core\report
node scripts/check-nivel-dios-users.mjs
```

Lista quién tiene **`rol_id = 1`** y **`categoria = 'DIOS'`**. Solo esos entran a `/aprobaciones` y ejecutan mutaciones.

### Alta / corrección Guido

```sql
UPDATE usuario_v2
SET rol_id = 1, categoria = 'DIOS'
WHERE UPPER(descp_usuario) LIKE '%GUIDO%';
```

Luego **logout + login** en Report.

## Probar login

1. http://localhost:3000/login — usuario Guido + contraseña.
2. http://localhost:3000/aprobaciones — debe cargar (no redirect a `/`).
3. DevTools → Application → cookie `report_session` → JWT decodificado debe tener `rol_id: 1`, `role: "DIOS"`.

Si redirige al home: la sesión aún trae `ADMIN` u otra categoría → cerrar sesión y volver a entrar tras el UPDATE SQL.

## Editores Nivel Dios (ley en BD)

| Campo | Acción | Sync |
|-------|--------|------|
| Cliente (código) | `cambiarClienteFi` | FI + PVR |
| Vendedor | `cambiarVendedorFi` | FI + PVR |
| Plazo | `actualizarEncabezadoFi` | FI + PVR (si 1 FI activa) |
| Desc. 1–4 | `actualizarEncabezadoFi` | Recalcula líneas desde PPD |
| Lista LPN/LPC | `actualizarListaPrecioFi` | FI + PVR |
| Cantidad ítem | `modificarCantidadItemFi` | PPD stock + totales |
| Eliminar ítem | `eliminarItemFi` | DELETE detalle + revierte PPD |

**No se agregan ítems** — solo eliminar (mínimo 1 línea por FI).

Tras `npm run build`: `REINICIAR_DEV.bat` antes de probar en navegador.
