# Pipeline Situación financiera — TXT → Nexus

```bat
python seed_huellas.py
python run_corte.py --persist-local
python run_corte.py --persist-local
rem 2ª corrida: variaciones = 0

python run_corte.py --persist-local --supabase
rem requiere DATABASE_URL o SUPABASE_DB_URL + MIG-203 aplicada en LAB
```

| Módulo | Rol |
|--------|-----|
| `clasificador.py` | Huellas ERP (`if*`) + nombre → tipo canónico |
| `parsers.py` | Cheques / saldos / PV·PROG → filas + totales |
| `generar_sit_fin.py` | Excel `SIT FIN` + hoja LINAJE |
| `persistencia.py` | T01–T12 local + check variaciones (+ Postgres opcional) |
| `seed_huellas.py` | Aprueba huellas corte AL 03-08 (T03/T04 local) |
| `run_corte.py` | Orquestador + HTML + `--persist-local` |

Migración LAB: `report/migrations/203_sf_tablas_staging.sql`  
Doc: `CHUSAR_SF_TABLAS_STAGING_VARIACIONES_20260809.md` (**2.3.1.50.4**)
