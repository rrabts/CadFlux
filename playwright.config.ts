import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { isSameDatabase } from "./src/lib/database-identity";
if (existsSync(".env")) loadEnvFile(".env");
const testUrl = process.env.DATABASE_URL_TEST;
if (!testUrl || !process.env.DATABASE_URL)
  throw new Error("Configure bancos separados para os testes de interface.");
if (isSameDatabase(process.env.DATABASE_URL, testUrl))
  throw new Error("Os testes de interface exigem um banco separado.");
const baseURL = "http://127.0.0.1:3100";
export default defineConfig({
  testDir: "./tests",
  testMatch: "ui.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL,
  },
  webServer: {
    command: "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100",
    url: baseURL,
    timeout: 120000,
    reuseExistingServer: false,
    env: { DATABASE_URL: testUrl, APP_URL: baseURL, NODE_ENV: "production" },
  },
});
