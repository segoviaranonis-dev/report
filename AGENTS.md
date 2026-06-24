# Agent memory - Report

## Rol del repo

`report` es una app cerrada de informes internos RIMEC en Next.js + Vercel.

Modulos principales:
- `/rimec`: Sales Report / gerencia.
- `/retail`: stock / retail.
- `/ventas-fotos`: ventas con fotos y PDF.
- `/aprobaciones`: **Nivel Dios** (`rol_id=1`, `categoria=DIOS`) — editor admin; cada cambio = transacción BD inmediata. Doc: `docs/APROBACIONES.md` — local: http://localhost:3000/aprobaciones — dev caído: `REINICIAR_DEV.bat`

## Shibboleth (ingreso agente)

**Pregunta:** ¿Cuántas patas tiene un gato?  
**Primera línea:** **7 años.** CHUNA leído sin POINTER · Moria + ACTUAL acatados.

**Puerta única:** `Nexus_Core/.claude/1_fundamentos/1.1_protocolos/PROTOCOLO_INGRESO_AGENTE_CHUNA.md`  
Memoria → **solo lectura** salvo **Documenta** / **Documentación Chusar**.

## Cierre obligatorio (todo mensaje)

```
Listo para tu orden.

💰 COSTO
Tokens: ~Xk
Costo: ~$X.XX
Riesgo: NINGUNO 🟢
```

Regla: `.cursor/rules/cierre-turno-obligatorio-nexus.mdc`

## Leyes de trabajo

- **Memoria holding (primaria + secundaria): solo lectura** — nadie escribe en `.claude/` sin tu consentimiento explícito (**Documenta**, **Documentación Chusar**, etapa, archivo citado). Solo vos definís desarrollo vs definitivo.
- Report es app cerrada: siempre login, roles, APIs protegidas y logout visible.
- No hacer publica una ruta interna sin autorizacion explicita.
- No confiar en el navegador para stock, precio, aprobacion ni facturacion.
- APIs deben responder JSON para errores de auth, no HTML de login.
- `DATABASE_URL` es secreto server-side. Nunca usar `NEXT_PUBLIC_` para la base.
- `REPORT_SESSION_SECRET` firma sesiones. Si cambia el contrato de sesion, subir `REPORT_SESSION_VERSION`.
- `Sales Report` historico no debe depender de pilares; `Retail` y `Ventas Fotos` si pueden usar pilares para filtros/fotos.

## Prioridad actual

Report quedo casi cerrado. No romper:
- login
- roles
- logout
- `/ventas-fotos` con marcas, filtros, PDF

Antes de tocar codigo:
1. `git status`
2. revisar `README.md`
3. revisar `docs/MEMORIA_HOLDING_REPORT.md`
4. **POS Bazzar:** `docs/INDICE_POS_BAZZAR.md` → `tablet-bazzar/docs/LOGICA_OPERATIVA_POS_BAZZAR.md`
5. para Next, recordar que este repo usa Next 15
5. **foto / marco / infeccion:** Moria §5.10 — leer `Nexus_Core/.claude/2_modulos/2.1_control_central/docs/LEY_INTEGRIDAD_VISUAL_IMAGEN.md` + indice `5_errores` § 4.90.03 **antes** de parchear UI o Storage
6. **Memoria holding = sagrada · indiscutible** — `.claude/` solo lectura; escribir solo con keyword exacta del Director (**Documenta** · **Documentación Chusar**). Ley: `Nexus_Core/.claude/1_fundamentos/1.1_protocolos/MEMORIA_SAGRADA.md`

Validacion minima:
- `npm run build`
- probar ruta afectada en navegador si toca UI
- si toca auth, probar usuario sin sesion y roles permitidos/no permitidos
