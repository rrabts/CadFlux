import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
const db = new EmbeddedPostgres({
  databaseDir: ".local/postgres",
  user: "cadflux",
  password: "cadflux_dev_only",
  port: 54329,
  persistent: true,
  authMethod: "scram-sha-256",
  postgresFlags: ["-h", "127.0.0.1"],
});
if (!existsSync(".local/postgres/PG_VERSION")) await db.initialise();
await db.start();
const client = db.getPgClient();
await client.connect();
for (const name of ["cadflux", "cadflux_test"]) {
  const result = await client.query("SELECT 1 FROM pg_database WHERE datname=$1", [name]);
  if (!result.rowCount) await client.query(`CREATE DATABASE ${name}`);
}
await client.end();
console.log("PostgreSQL local disponível em 127.0.0.1:54329. Ctrl+C para parar.");
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await db.stop();
    process.exit(0);
  });
setInterval(() => {}, 60000);
