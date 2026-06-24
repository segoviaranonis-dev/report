# Report — Instrucciones para Agentes

---

# ⚠️ ADVERTENCIA CRÍTICA PARA TODOS LOS AGENTES

**SI NO SIGUES ESTOS PROTOCOLOS AL PIE DE LA LETRA, ESTÁS CAUSANDO DAÑO AL PROYECTO.**

Este documento NO es sugerencia — es **OBLIGATORIO**. Cada protocolo aquí existe porque su violación causó problemas reales, frustración y pérdida de tiempo.

**ANTES de hacer CUALQUIER acción:**
1. ✅ Verificá que conocés el protocolo aplicable
2. ✅ Seguilo EXACTAMENTE como está escrito
3. ✅ Si no está claro → PREGUNTÁ, NO ASUMAS

**Si te despegás de estos protocolos:**
- Causás quilombo en git
- Perdés tiempo del Director
- Generás trabajo redundante
- Rompés el workflow del equipo

**NO hay excepciones. NO hay atajos. NO hay "esta vez es diferente".**

**Leé TODO este documento ANTES de escribir una sola línea de código.**

---

## 🐱 INGRESO AGENTE — UNA SOLA PUERTA

**Leer obligatorio:** `Nexus_Core/.claude/1_fundamentos/1.1_protocolos/PROTOCOLO_INGRESO_AGENTE_CHUNA.md`  
Memoria = solo lectura. Escribir `.claude/` **solo** con **Documenta** o **Documentación Chusar** del Director.  
Shibboleth gato → **7 años**

---

## 👑 AUTORIDAD Y ROLES

**Claude Code (VS Code) = JEFE DE GIT/DEPLOY**
- ✅ Claude gestiona: commits, merge, push, deploy, verificación
- ❌ Otros agentes NO tocan git salvo aprobación explícita del Director
- ❌ Cursor NO hace push ni force push
- ❌ Gemini/Antigravity NO hacen operaciones git

**Cursor (Composer):**
- Refactoring masivo, código
- NO gestiona git/docs/arquitectura

**Director (Héctor):**
- Aprueba cambios críticos
- Da luz verde para merge/deploy

---

## 📋 PROTOCOLO DE CIERRE DE ETAPA

Cuando el Director dice **"cierra esta etapa"**, seguir estos 5 pasos:

### 1. **Rama** 
Verificar rama actual, crear si es necesario

### 2. **Aprobación**
**ESPERAR aprobación visual explícita del Director** antes de continuar

### 3. **Git**
- Commit consolidado con mensaje descriptivo
- Merge a `main`

### 4. **Deploy**
- Push a `origin main`
- Verificar deployment en Vercel/producción

### 5. **PC Sync**
- Pull en local
- Reiniciar servicios si es necesario
- Confirmar funcionamiento

**CRÍTICO:** NUNCA merge a main o deploy sin aprobación explícita del Director.

---

## 💰 PROTOCOLO 5 PATAS (cada turno)

Al INICIO de cada sesión:
```
INICIO → 💰 COSTO
```

Al FINAL de cada turno:
```
💰 COSTO
Tokens: ~Xk
Costo: ~$X.XX
Riesgo: BAJO/MEDIO/ALTO 🟢🟡🔴
```

Límite mensual: **$250/mes**

---

## 🏗️ ARQUITECTURA REPORT

**Stack:** Next.js + TypeScript + Supabase  
**Deploy:** Vercel  
**Repo:** https://github.com/segoviaranonis-dev/report.git

**Propósito:** Reportes institucionales (Stock/Retail) para roles DIOS/ADMIN

### Módulos:
- **Retail:** Ventas por tienda con filtros robustos (6 pilares)
- **Stock:** Inventario consolidado
- **Hub:** Sistema de navegación filtrado por rol

### Sistema de permisos:
- **DIOS (04):** Acceso total sin restricciones
- **ADMIN (03):** Acceso a reportes + /aprobaciones
- **VENDEDOR:** Solo catálogo (rimec-web)

---

## 🚫 PROHIBIDO

- ❌ Hacer commits sin coordinación con Claude Code
- ❌ Push directo a main
- ❌ Force push sin aprobación explícita
- ❌ Merge sin aprobación visual del Director
- ❌ Deploy sin verificar build
- ❌ Olvidar el reporte de tokens (Pata 5)
- ❌ **ASUMIR el problema sin PREGUNTAR primero**

## 🎯 PROTOCOLO DE PALABRAS CLAVE

Cuando el Director escriba palabras clave vagas como:
- "bug urgente"
- "hotfix urgente"
- "arregla esto"
- "problema"

**SIEMPRE preguntar PRIMERO:**
1. ¿En qué módulo/archivo específico?
2. ¿Cuál es el comportamiento actual (incorrecto)?
3. ¿Cuál es el comportamiento esperado?
4. ¿Hay error específico o logs?

**NO asumir** que es en el módulo/archivo actualmente abierto.  
**NO empezar a explorar** sin tener el problema claramente definido.

---

## ✅ WORKFLOW CORRECTO

1. Cursor hace refactoring/código
2. Claude Code revisa cambios
3. Director aprueba
4. Claude Code gestiona git/deploy
5. Todos reportan tokens al final

**Claude Code = Portero, albañil y maestro de obras del proyecto.**