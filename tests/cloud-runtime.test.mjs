import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { groupAlive, stopGroup } from "../scripts/process-groups.mjs";

async function eventually(check) {
  for (let i = 0; i < 200; i++) {
    try {
      return await check();
    } catch {
      await delay(100);
    }
  }
  throw new Error("Timed out waiting for fixture");
}

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "cadflux-runtime-"));
  async function put(path, content) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  }
  for (const file of [
    "cloud-runtime.mjs",
    "database-config.mjs",
    "setup-database.mjs",
    "process-groups.mjs",
  ]) {
    await mkdir(join(root, "scripts"), { recursive: true });
    await copyFile(new URL(`../scripts/${file}`, import.meta.url), join(root, "scripts", file));
  }
  // Only SQL and application work are simulated. Process creation, flock,
  // signals, descendants and HTTP readiness exercise the production scripts.
  await put("node_modules/pg/package.json", '{"type":"module","exports":"./index.js"}');
  await put(
    "node_modules/pg/index.js",
    "export default {Client:class {async connect(){} async query(){} async end(){}}};",
  );
  await put(
    "node_modules/prisma/build/index.js",
    `
    const fs = require('node:fs');
    if (process.env.HOLD_MIGRATION) {
      if (process.env.IGNORE_TERM) process.on('SIGTERM', () => {});
      fs.writeFileSync('migration.pid', String(process.pid));
      setInterval(() => {}, 1000);
    }
  `,
  );
  await put("node_modules/tsx/dist/cli.mjs", "");
  await put(
    "node_modules/next/dist/bin/next",
    `
    require('node:http').createServer((req,res) => {
      res.writeHead(200); res.end('fixture');
    }).listen(3000, '127.0.0.1');
  `,
  );
  await put(
    "pause.cjs",
    `
    const fs = require('node:fs'); const original = fs.readFileSync; let first = true;
    fs.readFileSync = function(path, ...args) {
      try { return original.call(this, path, ...args); }
      catch (error) {
        if (first && String(path).endsWith('supervisor.pid')) {
          first = false; fs.writeFileSync('paused', 'yes');
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000);
        }
        throw error;
      }
    };
    require('node:module').syncBuiltinESMExports();
  `,
  );
  const env = {
    ...process.env,
    NODE_ENV: "development",
    CADFLUX_SKIP_LOCAL_POSTGRES: "1",
    DATABASE_URL: "postgresql://demo:demo@127.0.0.1:54329/dev",
    DATABASE_URL_TEST: "postgresql://demo:demo@127.0.0.1:54329/test",
  };
  const groups = new Set();
  const commands = [];
  function command(action, extra = {}, pause = false) {
    const child = spawn(
      process.execPath,
      [
        ...(pause ? ["--require", join(root, "pause.cjs")] : []),
        join(root, "scripts/cloud-runtime.mjs"),
        action,
      ],
      { cwd: root, env: { ...env, ...extra }, stdio: ["ignore", "pipe", "pipe"] },
    );
    commands.push(child);
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    return new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code) => resolve({ code, output }));
    });
  }
  async function pid(path = ".local/cloud/supervisor.pid") {
    return eventually(async () => {
      const value = Number(await readFile(join(root, path), "utf8"));
      assert.ok(value > 0);
      return value;
    });
  }
  async function ok(result) {
    const value = await result;
    assert.equal(value.code, 0, value.output);
  }
  t.after(async () => {
    await command("stop");
    for (const group of groups) await stopGroup(group);
    for (const child of commands) if (child.exitCode === null) child.kill("SIGKILL");
    await rm(root, { recursive: true, force: true });
  });
  return { root, command, pid, ok, groups, put };
}

test(
  "concurrent starters keep one controllable supervisor, including stale PID recovery",
  { skip: process.platform !== "linux", timeout: 40000 },
  async (t) => {
    const f = await fixture(t);
    const delayed = f.command("start", {}, true);
    await eventually(() => readFile(join(f.root, "paused")));
    await f.ok(f.command("start"));
    const owner = await f.pid();
    f.groups.add(owner);
    await f.ok(delayed);
    await Promise.all(Array.from({ length: 4 }, () => f.ok(f.command("start"))));
    assert.equal(await f.pid(), owner);
    await f.ok(f.command("status"));
    await f.ok(f.command("stop"));
    assert.equal(groupAlive(owner), false);
    await f.put(".local/cloud/supervisor.pid", "999999999");
    await Promise.all(Array.from({ length: 4 }, () => f.ok(f.command("start"))));
    f.groups.add(await f.pid());
    await f.ok(f.command("status"));
  },
);

for (const ignore of [false, true]) {
  test(
    `stop waits for migration descendants (ignores SIGTERM: ${ignore})`,
    { skip: process.platform !== "linux", timeout: 40000 },
    async (t) => {
      const f = await fixture(t);
      const start = f.command("start", {
        HOLD_MIGRATION: "1",
        ...(ignore ? { IGNORE_TERM: "1" } : {}),
      });
      f.groups.add(await f.pid());
      const migration = await f.pid("migration.pid");
      const stat = await readFile(`/proc/${migration}/stat`, "utf8");
      const group = Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[2]);
      f.groups.add(group);
      assert.equal(groupAlive(group), true);
      await f.ok(f.command("stop"));
      assert.equal(groupAlive(group), false, "migration group must be stopped before success");
      assert.notEqual((await start).code, 0);
      await f.ok(f.command("start"));
      f.groups.add(await f.pid());
      await f.ok(f.command("status"));
    },
  );
}
