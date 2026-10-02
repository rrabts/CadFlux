import { existsSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import { createServer } from "node:net";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { loadDatabaseEnvironment, projectDirectory } from "./database-config.mjs";

process.chdir(projectDirectory);
if (!existsSync(".env")) {
  await copyFile(".env.example", ".env", constants.COPYFILE_EXCL);
  console.log("Arquivo .env criado com configurações fictícias de desenvolvimento.");
}

let cluster;
try {
  const { database, testDatabase } = loadDatabaseEnvironment();
  if (
    database.hostname !== "127.0.0.1" ||
    testDatabase.hostname !== "127.0.0.1" ||
    database.port !== testDatabase.port ||
    database.user !== testDatabase.user ||
    database.password !== testDatabase.password
  ) {
    throw new Error(
      "db:local exige bancos locais com a mesma porta e credenciais. Para banco externo, use db:setup.",
    );
  }

  const portProbe = createServer();
  await new Promise((resolvePort, reject) => {
    portProbe.once("error", () => {
      reject(new Error("A porta PostgreSQL local está ocupada ou indisponível."));
    });
    portProbe.listen(database.port, "127.0.0.1", () => {
      portProbe.close(resolvePort);
    });
  });

  const dataDirectory = resolve(projectDirectory, ".local", "postgres");
  await mkdir(resolve(projectDirectory, ".local"), { recursive: true });
  cluster = new EmbeddedPostgres({
    databaseDir: dataDirectory,
    user: database.user,
    password: database.password,
    port: database.port,
    persistent: true,
    authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "listen_addresses=127.0.0.1"],
    onLog: () => undefined,
    onError: () => console.error("Falha no processo PostgreSQL local."),
  });

  if (!existsSync(resolve(dataDirectory, "PG_VERSION"))) await cluster.initialise();
  await cluster.start();

  const client = new pg.Client({
    host: "127.0.0.1",
    port: database.port,
    user: database.user,
    password: database.password,
    database: "postgres",
    connectionTimeoutMillis: 10_000,
  });
  try {
    await client.connect();
    for (const target of [database, testDatabase]) {
      const result = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [
        target.name,
      ]);
      if (result.rowCount === 0) {
        await client.query(`CREATE DATABASE ${pg.escapeIdentifier(target.name)}`);
      }
    }
    const result = await client.query("SELECT version() AS version");
    console.log(result.rows[0].version);
    console.log(
      `PostgreSQL local pronto em 127.0.0.1:${database.port}; bancos ${database.name} e ${testDatabase.name}.`,
    );
    console.log("Mantenha este terminal aberto. Em outro terminal, execute pnpm db:setup.");
  } finally {
    await client.end();
  }

  let shuttingDown = false;
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, async () => {
      if (shuttingDown) return;
      shuttingDown = true;
      await cluster.stop();
      console.log("PostgreSQL local encerrado; dados preservados em .local/postgres.");
      process.exit(0);
    });
  }
} catch (error) {
  if (cluster) await cluster.stop();
  console.error(
    error instanceof Error && !error.message.includes("ERROR OUTPUT")
      ? error.message
      : "Não foi possível iniciar PostgreSQL. Confira a porta, permissões e dependências locais.",
  );
  process.exitCode = 1;
}
