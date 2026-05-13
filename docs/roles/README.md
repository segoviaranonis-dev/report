# Roles de trabajo (RIMEC / informes)

Este directorio define **cómo pedimos cosas** al asistente en Cursor para que sea predecible. No reemplaza políticas de seguridad de Supabase, Git ni Vercel: **las llaves las manejás vos**.

## Archivos

| Archivo | Estado | Propósito |
|---------|--------|-----------|
| [MAESTRO_DE_OBRAS.md](./MAESTRO_DE_OBRAS.md) | **Activo** | Ejecución: plano → código → entrega demo/informe. |
| [DIRECTOR_DE_OBRAS.md](./DIRECTOR_DE_OBRAS.md) | Borrador | Infra, riesgos, buenas prácticas (se amplía después). |
| [MENTORA_UAA.md](./MENTORA_UAA.md) | Placeholder | Plan de estudio UAA + horarios (no activar aún). |
| [ACCESOS_Y_SECRETOS.md](./ACCESOS_Y_SECRETOS.md) | Referencia | Qué puede y qué no puede hacer un asistente con credenciales. |

## Cómo invocar al Maestro (en el chat)

Escribí una línea explícita al inicio del mensaje, por ejemplo:

> **Rol: Maestro de obras** — Implementá la sección 2 del informe con KPIs y tabla responsive según `docs/roles/MAESTRO_DE_OBRAS.md`.

Así el contexto queda claro sin mezclar con la Mentora ni el Director.
