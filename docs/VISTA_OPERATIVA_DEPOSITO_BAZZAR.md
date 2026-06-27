# Vista Operativa — Depósito Bazzar (Report)

**Código:** **2.3.2.1.1.1**  
**Ruta:** `/depositos-bazzar/[cliente_id]?tab=operativa`  
**CHUSAR:** [CHUSAR_VISTA_OPERATIVA_DEPOSITO.md](../../.claude/2_modulos/2.3_report/depositos/CHUSAR_VISTA_OPERATIVA_DEPOSITO.md)  
**Etapa padre:** [ETAPA_ADMIN_STOCK_BAZZAR_DINAMICO.md](../../.claude/4_etapas/ETAPA_ADMIN_STOCK_BAZZAR_DINAMICO.md)  
**Estado:** 📋 Documentado · UI pendiente

---

## Resumen

Pestaña del panel admin que muestra el **stock operativo del depósito** como lo ve la tablet en `/deposito`, con el **header triángulo** (género → marca → estilo) arriba y la **grilla de productos con foto** abajo.

Report manda · tablet refleja. Esta vista es consulta administrativa — no vende.

---

## Dos bloques UI

### 1. Triángulo (header filtros)

Cuatro filas de chips, paridad tablet cadena:

- Género · Marca · Estilo · Tipo (CALZADO / CONFECCIONES)
- Datos desde pilares en lectura (`linea`, `linea_referencia`)
- Doc marco: `.claude/3_arquitectura/3.2_venta_tienda/TRIANGULO_HEADER_PILARES.md`

### 2. Grilla operativa

Cards como tablet depósito:

- Foto calzado · badge naranja con pares
- Marca · código `L.R` · material/color · estilo · grada
- Barra búsqueda entre triángulo y grilla

Referencia implementación tablet: `tablet-bazzar/app/deposito/page.tsx`

---

## URLs

| Entorno | Ejemplo |
|---------|---------|
| Local | http://localhost:3001/depositos-bazzar/2100?tab=operativa |
| Prod | https://rimec-report.vercel.app/depositos-bazzar/2100?tab=operativa |

Query heredados del detalle: `categoria=tienda|guardado|averiado` (default `tienda`).

---

## API

| Endpoint | Uso |
|----------|-----|
| `GET /api/depositos/[cliente_id]/filtros` | Poblar chips triángulo |
| `GET /api/depositos/[cliente_id]` | Productos + imágenes |

Filtros por FK (`genero_id`, `marca_id`, `grupo_estilo_id`, `tipo_v2`) — ver CHUSAR para contrato completo.

---

## Componentes (pendientes)

```
depositos-bazzar/[cliente_id]/components/
  TabOperativa.tsx
  TrianguloHeaderDeposito.tsx
  GrillaOperativaDeposito.tsx
```

---

## Próximo paso

Implementar tab + componentes según CHUSAR · smoke Fernando Adultos (2100).

**Shibboleth:** Chayanne el mejor
