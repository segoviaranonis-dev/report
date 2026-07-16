# Grada abierta 638 — Alejandro Magno · venta unitaria

**Ratificado Director 2026-07-16.** Opción **A**: cada fila CSV confección = **1 unidad de venta** en PPD, agrupada bajo **tarjeta** L×R×material×color.

## Peras y manzanas

| | Calzado 654 | Confecciones 638 |
|---|-------------|------------------|
| `am_modo_venta` | `CAJA_CERRADA` | `UNIDAD` |
| Grada | Curva `34(1-2-3-3-2-1)39` | Abierta `1(1)1`, `P(1)M` |
| Click venta | caja × pares/caja | **1 prenda** |
| Tarjeta | L+R+mat+color | **Igual** — hijos = tallas × LPN |

## Notación Carlos (`DESCRIPCION GRADA`)

| Texto | Talle | Venta |
|-------|-------|-------|
| `1(1)1` | 1 | de a 1 prenda |
| `2(1)2` | 2 | de a 1 |
| `P(1)M` | P | de a 1 |
| `4/6/8` | combo | de a 1 |

Stock real = columna cantidad de la fila CSV (ej. 8 + 5 + 2 + … = 27).

## Molécula PPD (638)

```
1 fila staging = 1 fila pedido_proveedor_detalle
```

Clave única operativa:

```
(linea, referencia, material_code, color_code, grada, precio_lpn, deposito)
```

Tarjeta UI (Report + Web):

```
(linea, referencia, material_code, color_code)
  └─ líneas: grada + LPN + saldo (prendas)
```

## Campos PPD (MIG-165)

| Columna | 638 |
|---------|-----|
| `am_modo_venta` | `UNIDAD` |
| `am_talle` | talle parseado |
| `am_unidad_venta` | 1 (paréntesis) |
| `grades_json` | `{ "1": 8 }` |
| `cantidad_pares` | **prendas** (legacy nombre) |
| `cantidad_cajas` | 0 |

## Código

- Parser: `report/src/lib/deposito-rimec/grada-abierta-638.ts`
- Agrupación tarjeta Report: `agrupar-pe-importadora.ts`
- Import PPD: `control_central/scripts/migrate_pe_staging_to_ppd.py`
- Web venta PE: `rimec-web/lib/prontaEntregaVenta.ts` (rama CONFECCIONES)

## Ejemplo pivot (13751 · K0452)

| LPN | Grada | Prendas |
|-----|-------|---------|
| 89900 | 1(1)1 | 8 |
| 89900 | 2(1)2 | 5 |
| 89900 | 3(1)3 | 2 |
| 108800 | 4(1)4 | 7 |
| … | … | … |
| **Total tarjeta** | | **27** |
