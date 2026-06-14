# ETAPA COMPRA-WEB-003 — Filtro cliente 5000

**Problema reportado:** Compra Web mostraba demasiadas facturas/traspasos (todos los de ALM_WEB_01).  
**Regla de negocio:** Solo debe ingresar mercadería del **cliente 5000** (canal e-commerce / Carga Manual Facturación).

---

## Causa raíz

| Capa | Filtro antes | Efecto |
|------|--------------|--------|
| `get_traspasos` (Streamlit + Report) | Solo `traspaso.almacen_destino_id = 1` | Cualquier traspaso hacia ALM_WEB_01 aparecía, aunque la FAC-INT fuera de otro cliente (sucursales, mayoristas, etc.) |
| OT-2026-029 | Añadió filtro almacén web | **No** añadió filtro por cliente |

La cadena correcta del canal web:

```
Facturación — Carga Manual / FI con cliente_id = 5000
        ↓  ENVIAR A WEB BAZAR
Traspaso → ALM_WEB_01
        ↓
Compra Web — confirmar recepción
```

---

## Corrección aplicada

Condición SQL en lista, detalle y confirmación:

```sql
AND (
  EXISTS (
    SELECT 1 FROM factura_interna fi
    WHERE fi.nro_factura = t.documento_ref
      AND fi.cliente_id = 5000
  )
  OR EXISTS (
    SELECT 1 FROM venta_transito vt
    WHERE vt.numero_factura_interna = t.documento_ref
      AND TRIM(vt.codigo_cliente) = '5000'
  )
)
```

**Nuevo flujo:** `factura_interna.cliente_id = 5000`  
**Legacy:** `venta_transito.codigo_cliente = '5000'`

---

## Archivos modificados

| Repo | Archivo |
|------|---------|
| Report | `src/lib/bazzar-web/compra-web/constants.ts` |
| Report | `src/lib/bazzar-web/compra-web/queries.ts` |
| Report | `src/lib/bazzar-web/compra-web/mutations.ts` |
| Nexus | `control_central/modules/compra_legal/logic.py` |

---

## Upstream (no corregido en esta OT)

`enviar_compra_a_web(id_cl)` puede marcar ENVIADO traspasos de **toda** una Compra Legal (varios clientes). Esos traspasos **ya no aparecen** en Compra Web si la FI no es cliente 5000.  
Recomendación futura: en Facturación, botón ENVIAR A WEB solo para FI con `cliente_id = 5000`.

---

## Verificación

1. Compra Web lista solo traspasos cuya FAC apunta a cliente 5000.
2. Confirmar recepción rechaza traspaso de otro cliente con mensaje explícito.
3. Traspasos huérfanos (sin FI/VT) no listan.
