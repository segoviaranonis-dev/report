# Mapa Factura Carlos ↔ Nexus ↔ Logística OK

| Origen | Columna | Destino BD | UI Logística |
|--------|---------|------------|--------------|
| Excel Carlos **A** | COD.CLIENT | validación `id_cliente` | — |
| Excel Carlos **C** | FACTURA | `factura_interna.factura_carlos` | **Factura Real** |
| PP tab FI (manual) | input ámbar | PATCH `…/fi/[fiId]/factura-carlos` | **Factura Real** |
| Excel Carlos **D** | Nro IC | match `intencion_compra.numero_registro` | — |
| Export Nexus **T** | FI Nexus | match `factura_interna.nro_factura` | FI Nexus |
| Export Nexus **Q/R** | Evento / Listado | auditoría | — |
| Legacy | PV000147 | `factura_interna.pv_global` (int ≤ 2e9) | Factura Real fallback |

**BD MIG-184:** CHECK 6–15 dígitos · UNIQUE por PP · UNIQUE global · `factura_carlos_at`.

**Piloto PP-38:** merge Excel + export → `run-import-cierre-pp.mjs 38 tmp/cierre_pp38_carlos_merged.csv`
