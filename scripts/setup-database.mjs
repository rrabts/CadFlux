import { spawn } from "node:child_process";
import { resolve } from "node:path";
import pg from "pg";
import { loadDatabaseEnvironment, projectDirectory } from "./database-config.mjs";

async function run(file, args, databaseUrl) {
  await new Promise((resolveProcess, reject) => {
    const child = spawn(process.execPath, [file, ...args], {
      cwd: projectDirectory,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolveProcess();
      else reject(new Error("Uma etapa de migration ou seed falhou. O banco não foi validado."));
    });
  });
}

try {
  const { database, testDatabase } = loadDatabaseEnvironment();
  const requested = process.argv.slice(2);
  if (requested.some((argument) => !["--test", "--all"].includes(argument))) {
    throw new Error(
      "Uso: pnpm db:setup [--test | --all]. Nenhum banco é apagado por este comando.",
    );
  }
  const targets = requested.includes("--all")
    ? [database, testDatabase]
    : [requested.includes("--test") ? testDatabase : database];

  for (const target of targets) {
    const client = new pg.Client({
      connectionString: target.value,
      connectionTimeoutMillis: 10_000,
    });
    try {
      await client.connect();
      await client.query("SELECT 1");
    } catch {
      throw new Error(
        "PostgreSQL indisponível. Inicie pnpm db:local ou revise o banco de desenvolvimento.",
      );
    } finally {
      await client.end();
    }
    console.log(`Conexão real validada: ${target.name}. Aplicando migrations e seed fictício.`);
    await run(
      resolve(projectDirectory, "node_modules/prisma/build/index.js"),
      ["migrate", "deploy"],
      target.value,
    );
    await run(
      resolve(projectDirectory, "node_modules/tsx/dist/cli.mjs"),
      ["prisma/seed.ts"],
      target.value,
    );
    console.log(`Migrations e seed concluídos em ${target.name}.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Falha na preparação do banco fictício.");
  process.exitCode = 1;
}
