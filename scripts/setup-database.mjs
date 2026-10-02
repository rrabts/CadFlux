import { spawnSync } from "node:child_process";
for (const args of [
  ["prisma", "migrate", "deploy"],
  ["tsx", "prisma/seed.ts"],
]) {
  const result = spawnSync("pnpm", ["exec", ...args], { stdio: "inherit", env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
