const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..", "tablet-bazzar", "supabase", "migrations");
const dbUrl = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

const steps = [
  "001_ticket_venta_pos.sql",
  "002_clients_bazaar.sql",
];

(async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const f of steps) {
      const sql = fs.readFileSync(path.join(root, f), "utf8");
      console.log("Applying", f);
      await client.query(sql);
    }
    // Staging tables only (vendedor_bazzar ya existe)
    console.log("Applying staging tables...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.ticket_pos_staging (
        id                  bigserial PRIMARY KEY,
        codigo_staging      text NOT NULL UNIQUE,
        cliente_id          bigint NOT NULL,
        marca               text NOT NULL,
        vendedor_bazzar_id  bigint NOT NULL REFERENCES public.vendedor_bazzar(id_vendedor),
        vendedor_nombre     text NOT NULL,
        cedula_cliente      text,
        clients_bazaar_id   bigint,
        estado              text NOT NULL DEFAULT 'ABIERTO'
          CHECK (estado IN ('ABIERTO', 'CERRADO', 'CANCELADO', 'ORO')),
        snapshot_cliente    jsonb,
        created_at          timestamptz NOT NULL DEFAULT now(),
        cerrado_at          timestamptz,
        cancelado_at        timestamptz,
        promovido_at        timestamptz
      );
      CREATE INDEX IF NOT EXISTS idx_ticket_staging_cliente_estado
        ON public.ticket_pos_staging (cliente_id, estado, created_at DESC);
      CREATE TABLE IF NOT EXISTS public.ticket_pos_staging_linea (
        id              bigserial PRIMARY KEY,
        staging_id      bigint NOT NULL REFERENCES public.ticket_pos_staging(id) ON DELETE CASCADE,
        linea_id        bigint NOT NULL,
        referencia_id   bigint NOT NULL,
        material_id     bigint NOT NULL,
        color_id        bigint NOT NULL,
        grada           text NOT NULL,
        cantidad        int NOT NULL DEFAULT 1 CHECK (cantidad >= 0),
        activo          boolean NOT NULL DEFAULT true,
        snapshot_json   jsonb,
        created_at      timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_ticket_staging_linea_staging
        ON public.ticket_pos_staging_linea (staging_id) WHERE activo = true;
      ALTER TABLE public.ticket_venta_pos
        ADD COLUMN IF NOT EXISTS vendedor_bazzar_id bigint REFERENCES public.vendedor_bazzar(id_vendedor),
        ADD COLUMN IF NOT EXISTS staging_id bigint REFERENCES public.ticket_pos_staging(id);
    `);
    await client.query("COMMIT");
    console.log("OK");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
