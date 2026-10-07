// Development-only Linux supervisor. Runtime files and logs stay ignored.
import { spawn } from "node:child_process";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  openSync,
  closeSync,
  unlinkSync,
} from "node:fs";
import { resolve } from "node:path";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";
import { loadDatabaseEnvironment, projectDirectory } from "./database-config.mjs";

const script = fileURLToPath(import.meta.url);
const directory = resolve(projectDirectory, ".local/cloud");
const pidFile = resolve(directory, "supervisor.pid");
const logFile = resolve(directory, "services.log");
const readyFile = resolve(directory, "ready");
process.chdir(projectDirectory);
const action = process.argv[2] || "start";
if (process.platform !== "linux") throw new Error("cloud-runtime exige Linux.");
if (!["start", "run", "status", "stop"].includes(action))
  throw new Error("Uso: cloud-runtime.mjs start|status|stop");
process.umask(0o077);
mkdirSync(directory, { recursive: true });

function supervisorPid() {
  try {
    const pid = Number(readFileSync(pidFile, "utf8"));
    const args = readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0");
    return args.includes(script) && args.includes("run") ? pid : null;
  } catch {
    return null;
  }
}
function remove(file) {
  try {
    unlinkSync(file);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
async function requireFreePort(port) {
  const probe = createServer();
  await new Promise((accept, reject) => {
    probe.once("error", () =>
      reject(
        new Error(
          "Porta ocupada ou indisponível. Encerre o serviço anterior antes de iniciar o supervisor.",
        ),
      ),
    );
    probe.listen(port, "127.0.0.1", () => probe.close(accept));
  });
}

async function sqlReady() {
  const { database, testDatabase } = loadDatabaseEnvironment();
  for (const target of [database, testDatabase]) {
    const client = new pg.Client({
      connectionString: target.value,
      connectionTimeoutMillis: 1000,
      query_timeout: 1000,
    });
    try {
      await client.connect();
      await client.query("SELECT 1");
    } finally {
      await client.end();
    }
  }
}
async function httpReady() {
  const response = await fetch("http://127.0.0.1:3000/login", {
    signal: AbortSignal.timeout(2000),
  });
  if (response.status !== 200) throw new Error("Next.js ainda não está pronto.");
  await response.body?.cancel();
}
async function waitUntil(check, seconds, alive = () => true) {
  for (let i = 0; i < seconds; i++) {
    if (!alive())
      throw new Error(
        "Serviço encerrou antes de ficar pronto. Consulte .local/cloud/services.log.",
      );
    try {
      await check();
      return;
    } catch {
      await delay(1000);
    }
  }
  throw new Error(
    "Timeout de prontidão. Consulte .local/cloud/services.log e as permissões de rede/loopback.",
  );
}

try {
  if (action === "stop") {
    const pid = supervisorPid();
    if (pid) {
      process.kill(pid, "SIGTERM");
      await waitUntil(async () => {
        if (supervisorPid()) throw new Error();
      }, 30);
    }
    console.log("Serviços Cloud encerrados; dados preservados.");
  } else if (action === "status") {
    if (!supervisorPid() || !existsSync(readyFile))
      throw new Error("Supervisor Cloud não está pronto.");
    await sqlReady();
    await httpReady();
    console.log("Supervisor ativo; SQL dos dois bancos e Next.js HTTP 200.");
  } else if (action === "start") {
    loadDatabaseEnvironment();
    if (!supervisorPid()) {
      remove(pidFile);
      remove(readyFile);
      const log = openSync(logFile, "a", 0o600);
      const child = spawn(process.execPath, [script, "run"], {
        cwd: projectDirectory,
        env: process.env,
        detached: true,
        stdio: ["ignore", log, log],
      });
      closeSync(log);
      child.on("error", () => {
        console.error("Não foi possível iniciar o supervisor.");
        process.exitCode = 1;
      });
      child.unref();
      await waitUntil(async () => {
        if (!supervisorPid()) throw new Error();
      }, 5);
    }
    await waitUntil(
      async () => {
        if (!existsSync(readyFile)) throw new Error();
        await sqlReady();
        await httpReady();
      },
      90,
      () => Boolean(supervisorPid()),
    );
    console.log(
      "Cloud pronto: PostgreSQL e Next.js supervisionados. Logs em .local/cloud/services.log.",
    );
  } else {
    const { database, testDatabase } = loadDatabaseEnvironment();
    const external = process.env.CADFLUX_SKIP_LOCAL_POSTGRES === "1";
    if (
      !external &&
      (process.getuid() === 0 ||
        database.hostname !== "127.0.0.1" ||
        testDatabase.hostname !== "127.0.0.1")
    ) {
      throw new Error(
        "PostgreSQL local exige usuário sem root e URLs locais. Para banco externo use CADFLUX_SKIP_LOCAL_POSTGRES=1.",
      );
    }
    const lock = openSync(pidFile, "wx", 0o600);
    writeFileSync(lock, String(process.pid));
    closeSync(lock);
    remove(readyFile);
    const children = new Set();
    let stopping = false;
    let shutdownPromise;
    function child(file, args = []) {
      const processChild = spawn(process.execPath, [resolve(projectDirectory, file), ...args], {
        cwd: projectDirectory,
        env: process.env,
        stdio: "inherit",
      });
      children.add(processChild);
      processChild.once("exit", () => children.delete(processChild));
      processChild.once("error", () => {
        children.delete(processChild);
      });
      return processChild;
    }
    async function shutdown(code) {
      if (shutdownPromise) return shutdownPromise;
      stopping = true;
      remove(readyFile);
      shutdownPromise = (async () => {
        const owned = [...children];
        for (const processChild of owned) processChild.kill("SIGTERM");
        for (let i = 0; i < 100 && children.size; i++) await delay(100);
        for (const processChild of children) processChild.kill("SIGKILL");
        remove(pidFile);
        process.exit(code);
      })();
      return shutdownPromise;
    }
    process.once("SIGTERM", () => void shutdown(0));
    process.once("SIGINT", () => void shutdown(0));
    function supervise(file, args, label) {
      let restarts = 0;
      function launch() {
        if (stopping) return;
        const processChild = child(file, args);
        console.log(`${new Date().toISOString()} ${label} iniciado.`);
        let handled = false;
        async function failed() {
          if (handled || stopping) return;
          handled = true;
          if (++restarts > 5) {
            console.error(`${label}: limite de reinícios atingido.`);
            await shutdown(1);
            return;
          }
          console.log(`${label}: reinício ${restarts}/5 em 2s.`);
          await delay(2000);
          launch();
        }
        processChild.once("exit", failed);
        processChild.once("error", failed);
      }
      launch();
    }
    try {
      // Refuse unrelated services instead of claiming their readiness or ownership.
      await requireFreePort(3000);
      if (!external) {
        await requireFreePort(database.port);
        supervise("scripts/local-postgres.mjs", [], "PostgreSQL");
      }
      await waitUntil(sqlReady, 30, () => !stopping);
      const setup = child("scripts/setup-database.mjs", ["--all"]);
      await new Promise((accept, reject) => {
        setup.once("error", reject);
        setup.once("exit", (code) =>
          code === 0 ? accept() : reject(new Error("Migrations/seed falharam.")),
        );
      });
      supervise(
        "node_modules/next/dist/bin/next",
        ["dev", "--hostname", "127.0.0.1", "--port", "3000"],
        "Next.js",
      );
      await waitUntil(httpReady, 60, () => !stopping);
      writeFileSync(readyFile, "ready\n", { mode: 0o600 });
      console.log("Prontidão confirmada: dois bancos e HTTP. Sem publicação de aplicativo.");
    } catch (error) {
      console.error(error.message);
      console.error("Inicialização Cloud falhou. Revise os logs e a configuração dos bancos.");
      await shutdown(1);
    }
  }
} catch (error) {
  console.error(
    ["start", "status", "stop"].includes(action)
      ? error.message
      : "Supervisor Cloud não pôde iniciar. Revise configuração e permissões.",
  );
  process.exitCode = 1;
}
