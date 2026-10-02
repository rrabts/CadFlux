import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { isSameDatabase } from "./src/lib/database-identity";

if (existsSync(".env")) loadEnvFile(".env");
if (
  !process.env.DATABASE_URL_TEST ||
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL_TEST === process.env.DATABASE_URL
) {
  throw new Error(
    "Configure DATABASE_URL_TEST separado do banco de desenvolvimento antes dos testes.",
  );
}
if (isSameDatabase(process.env.DATABASE_URL, process.env.DATABASE_URL_TEST))
  throw new Error("Os testes exigem outro banco.");
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
