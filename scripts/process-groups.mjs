import { readFileSync, readdirSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

// Each managed child starts a new session. Its descendants inherit its group.
// Ignore zombies: they cannot execute or retain sockets, and only their parent
// (or the container's PID 1) can reap them.
export function groupAlive(group) {
  return readdirSync("/proc").some((entry) => {
    if (!/^\d+$/u.test(entry)) return false;
    try {
      const stat = readFileSync(`/proc/${entry}/stat`, "utf8");
      const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
      return Number(fields[2]) === group && !["Z", "X"].includes(fields[0]);
    } catch (error) {
      if (["ENOENT", "ESRCH"].includes(error.code)) return false;
      throw error;
    }
  });
}

function signalGroup(group, signal) {
  if (!groupAlive(group)) return;
  try {
    process.kill(-group, signal);
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

export async function stopGroup(group) {
  signalGroup(group, "SIGTERM");
  for (let i = 0; i < 100 && groupAlive(group); i++) await delay(100);
  signalGroup(group, "SIGKILL");
  for (let i = 0; i < 50 && groupAlive(group); i++) await delay(100);
  if (groupAlive(group)) throw new Error("Não foi possível encerrar o grupo de processos.");
}
