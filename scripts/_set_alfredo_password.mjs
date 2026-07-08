import fs from "fs";
import pg from "pg";
import bcrypt from "bcryptjs";

const password = "ADMIN123";
const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) {
  console.error("DATABASE_URL no encontrada");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const hash = await bcrypt.hash(password, 10);
  const r = await client.query(
    `UPDATE usuario_v2 SET password = $1, password_hash = $2, bloqueado = false
     WHERE descp_usuario ILIKE 'ALFREDO'
     RETURNING id_usuario, descp_usuario, rol_id, categoria, bloqueado`,
    [password, hash],
  );
  if (!r.rowCount) {
    console.error("ALFREDO no encontrado");
    process.exit(1);
  }
  const ok = await bcrypt.compare(password, hash);
  console.log(JSON.stringify({ user: r.rows[0], login_test: ok }, null, 2));
  console.log("alfredo_password_ok");
} finally {
  await client.end();
}
