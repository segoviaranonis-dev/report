# Integración — trabajo colaborador → módulo SF Nexus (importadora)

**Fuente:** `D:\SF\` · `CONTEXTO.md` + scripts (trabajo **terminado** por el colaborador)  
**Intake:** `intake/colaborador-completo-20260809/`  
**Norte holding:** constitución **2.3.1.50** · tablas **2.3.1.50.4** · pipeline Nexus  
**Sales Report:** blindado

---

## 1 · Qué entregó el colaborador (cerrado)

Herramientas offline de **gestión financiera operativa** sobre ERP RIMEC:

| Script | Rol |
|--------|-----|
| `limpiador.py` | TXT ancho fijo → CSV |
| `cuadro_vencimientos_html.py` | Explosión cuotas + cuadro + `detalle_auditable` |
| `generar_informe_mensual.py` | Orquestador Excel 3 hojas (Detalle / Cuadro / Situación) |
| `situacion_dinamica.py` | Inyecta “verdes” en plantilla Sit Fin |
| `analisis_cobros.py` | Control cobros (previsto×cobrado, cascada, 3 niveles) |
| `cheques.py` | Cheques previsto / depositado / reconciliación |
| `preventas.py` / `pivot_com.py` / `exportar_cruce.py` | Auxiliares PV / pivotes / cruces |

Bitácora completa: `CONTEXTO.md` (lógica vigente; rutas/config pueden estar viejas).

---

## 2 · Estructura económica de importadora (cómo lo metemos en Nexus)

Ciclo de caja RIMEC = el esqueleto del módulo (no un “dashboard suelto”):

```
CxC (saldos/cuotas)     →  DSO / aging / difícil cobro
+ Cheques a vencer      →  cobro instrumentado (futuro)
+ PV / PROG             →  mercadería a entregar / cobro programado
+ Cobros del mes        →  efectivo+transf vs cheque (líquido)
− CxP / gastos / préstamo →  egresos (manuales / otros orígenes)
= Saldo disponible      →  Sit Fin mes a mes (tablero gerencial)
```

| Capa económica | Script colaborador | Tabla Nexus (T0x) | Ratio / salida |
|----------------|--------------------|-------------------|----------------|
| Maestro clientes / tipo cobro / cadena | Tablas + cuadro | T03/T04 + staging | Clasificación filas |
| CxC factura → cuotas | `cuadro_vencimientos_*` | T08 + T14 (fase 2) | Aging, DSO |
| Cheques | `cheques.py` + TXT | **T06** | Líquidez proyectada |
| PV / preventas | `preventas.py` / PV TXT | **T09** | Merc. a entregar |
| Cobros / pagos | `analisis_cobros.py` | **T13** (fase 2) | % cobro, líquido |
| Manuales (bancos, gastos, Bazzar…) | Sit Fin plantilla | **T11** | Egresos / bancos |
| Tablero Sit Fin | `generar_informe_mensual` / `situacion_dinamica` | **T12** | Previsión gerencial |
| Lote / variaciones TXT | `limpiador` + huellas | **T01–T05** | Gobernanza ERP |

Colores del colaborador (verde auto / naranja manual / lila pendiente) = misma semántica que Nexus AUTO vs manual en T12.

---

## 3 · Qué ya tenemos en Nexus vs qué falta portar

| Ya en Nexus | Falta portar (núcleo económico) |
|-------------|----------------------------------|
| Clasificador TXT + parsers cheques/saldos/PV | Explosión cuotas + `condiciones_pago` + tipo cobro |
| Persistencia T01–T12 local + MIG-203 | Clase `Verde` + mapa celdas Excel / HTML Report |
| Seed huellas AL 03-08 | Orquestador mensual 3 hojas → UI Report |
| Intake cortes | `analisis_cobros` motor (cruce vieja-primero) → T13 |
| Constitución NIC/ratios (norte) | Ratios DSO/CCC sobre staging cerrado |

---

## 4 · Orden de cableado (próximos golpes)

1. **Cuadro / detalle auditable** → alimentar T08 + proyección cuotas (T14).  
2. **Verdes Sit Fin** → escribir T12 `origen=auto` desde detalle (mismas reglas CONTEXTO § informe).  
3. **Cheques + PV** → T06/T09 ya parcial; cerrar lila del colaborador.  
4. **Cobros** → T13 cuando haya pagos limpios del mes.  
5. **UI Report** `/situacion-financiera` al 100 % presentación (Excel manda como plantilla visual).

---

## 5 · Reglas que no se negocian

- Una verdad por `sf_corte` (batch).  
- Variación de TXT → T05 antes de `cerrado`.  
- No JOIN a `registro_ventas_general_v2`.  
- Datos reales: `CLAVE_JOIN = codigo` maestro (no correlativo de fila).  
- Prod Supabase solo cierre etapa u orden Director.
