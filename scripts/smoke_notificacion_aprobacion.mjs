import fs from "fs";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const reportEnv = fs.readFileSync("report/.env.local", "utf8");
const dbUrl = reportEnv.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const rimecEnv = fs.readFileSync("rimec-web/.env.local", "utf8");
const supaUrl = rimecEnv.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim();
const serviceKey = rimecEnv.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1]?.trim();

const DEST = ["HECTOR", "Guido", "Veronica"];
const sb = createClient(supaUrl, serviceKey);

const { data: users } = await sb.from("usuario_v2").select("id_usuario, descp_usuario");
const ids = DEST.map((n) =>
  Number(users?.find((u) => String(u.descp_usuario).toLowerCase() === n.toLowerCase())?.id_usuario),
).filter(Boolean);
console.log("destinatarios:", ids);

const rows = ids.map((usuario_id) => ({
  usuario_id,
  tipo: "APROBACION_PENDIENTE",
  titulo: "Pedido Web pendiente de aprobación",
  mensaje: "SMOKE TEST confirmó pedido #999999",
  entidad_tipo: "pedido_web",
  entidad_id: 999999,
  deep_link: "/aprobaciones",
  leida: false,
}));

const { error } = await sb.from("notificaciones").insert(rows);
if (error) throw error;

const pgClient = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await pgClient.connect();
const check = await pgClient.query(
  `SELECT COUNT(*)::int AS n FROM notificaciones WHERE entidad_id = 999999`,
);
console.log("filas:", check.rows[0].n);
await pgClient.query(`DELETE FROM notificaciones WHERE entidad_id = 999999`);
await pgClient.end();
console.log(ids.length === 3 && check.rows[0].n === 3 ? "smoke_ok" : "smoke_fail");
