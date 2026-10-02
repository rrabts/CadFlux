import { defineConfig } from "@playwright/test";
if (
  !process.env.DATABASE_URL_TEST ||
  !new URL(process.env.DATABASE_URL_TEST).pathname.endsWith("_test")
)
  throw new Error("DATABASE_URL_TEST deve apontar para banco exclusivo _test");
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure" },
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 120000,
  },
  timeout: 60000,
});
