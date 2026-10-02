import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const projectDirectory = fileURLToPath(new URL("../", import.meta.url));

export function loadDatabaseEnvironment() {
  process.chdir(projectDirectory);
  if (existsSync(".env")) process.loadEnvFile(".env");
  if (process.env.NODE_ENV === "production") {
    throw new Error("Os scripts de banco fictício não podem ser usados em produção.");
  }

  const database = parseDatabaseUrl("DATABASE_URL");
  const testDatabase = parseDatabaseUrl("DATABASE_URL_TEST");
  if (
    database.hostname === testDatabase.hostname &&
    database.port === testDatabase.port &&
    database.name === testDatabase.name
  ) {
    throw new Error("Desenvolvimento e testes precisam de bancos separados.");
  }
  return { database, testDatabase };
}

function parseDatabaseUrl(variable) {
  const value = process.env[variable];
  if (!value) throw new Error(`Configure ${variable} no arquivo .env.`);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${variable} não é um endereço PostgreSQL válido.`);
  }
  const name = decodeURIComponent(url.pathname.slice(1));
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !/^[a-z][a-z0-9_]{0,62}$/u.test(name) ||
    !url.username ||
    !url.password
  ) {
    throw new Error(`${variable} precisa indicar um banco PostgreSQL e credenciais.`);
  }
  return {
    value,
    hostname: url.hostname === "localhost" ? "127.0.0.1" : url.hostname,
    port: Number(url.port || 5432),
    name,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  };
}
