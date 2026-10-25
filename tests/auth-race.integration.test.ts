import { afterAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { authenticate, changePassword, userFromToken } from "@/modules/auth/service";
import * as passwords from "@/modules/auth/password";
import { createUser } from "@/modules/users/service";
import { safeUserSelect } from "@/modules/users/types";

function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function fixture() {
  const direction = await prisma.user.findUniqueOrThrow({
    where: { email: "direcao@cadflux.local" },
    select: safeUserSelect,
  });
  const key = randomUUID();
  const created = await createUser(direction, {
    name: "Pessoa Fictícia Corrida",
    email: `race-${key}@cadflux.local`,
    registrationNumber: key,
    accessProfile: "INTERVIEWER",
    professionalCategoryId: direction.professionalCategoryId,
    primaryUnitId: direction.primaryUnitId,
    status: "ACTIVE",
  });
  return { actor: created.user, oldPassword: created.temporaryPassword };
}
async function expectCredentialLockWait() {
  await expect
    .poll(
      async () => {
        const [row] = await prisma.$queryRaw<{ waiting: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM pg_stat_activity
        WHERE datname = current_database() AND pid <> pg_backend_pid()
          AND wait_event_type = 'Lock'
          AND query LIKE 'SELECT id FROM "User" WHERE%'
      ) AS waiting`;
        return row.waiting;
      },
      { timeout: 3000 },
    )
    .toBe(true);
}
afterAll(() => prisma.$disconnect());
describe("D01: login e revogação de senha são serializados no PostgreSQL", () => {
  it("troca de senha aguarda login já validado e revoga a sessão que ele emite", async () => {
    const { actor, oldPassword } = await fixture();
    const reached = gate(),
      resume = gate();
    const originalVerify = passwords.verifyPassword;
    const spy = vi.spyOn(passwords, "verifyPassword").mockImplementationOnce(async (...args) => {
      const valid = await originalVerify(...args);
      reached.resolve();
      await resume.promise;
      return valid;
    });
    const login = authenticate({ email: actor.email, password: oldPassword });
    let changing: Promise<void> | undefined;
    try {
      await reached.promise;
      changing = changePassword(actor, {
        currentPassword: oldPassword,
        newPassword: "Nova!FicticiaCorrida2026",
      });
      await expectCredentialLockWait();
      resume.resolve();
      const issued = await login;
      await changing;
      expect(await userFromToken(issued.token)).toBeNull();
      await expect(
        authenticate({ email: actor.email, password: oldPassword }),
      ).rejects.toMatchObject({ status: 401 });
      expect(
        await authenticate({ email: actor.email, password: "Nova!FicticiaCorrida2026" }),
      ).toHaveProperty("token");
    } finally {
      resume.resolve();
      await Promise.allSettled([login, ...(changing ? [changing] : [])]);
      spy.mockRestore();
    }
  });
  it("login iniciado durante troca aguarda e recusa a senha anterior", async () => {
    const { actor, oldPassword } = await fixture();
    const reached = gate(),
      resume = gate();
    const originalVerify = passwords.verifyPassword;
    const spy = vi.spyOn(passwords, "verifyPassword").mockImplementationOnce(async (...args) => {
      const valid = await originalVerify(...args);
      reached.resolve();
      await resume.promise;
      return valid;
    });
    const changing = changePassword(actor, {
      currentPassword: oldPassword,
      newPassword: "Outra!FicticiaCorrida2026",
    });
    let attempted: Promise<unknown> | undefined;
    try {
      await reached.promise;
      attempted = authenticate({ email: actor.email, password: oldPassword }).catch(
        (error) => error,
      );
      await expectCredentialLockWait();
      resume.resolve();
      await changing;
      expect(await attempted).toMatchObject({ status: 401 });
      expect(await prisma.session.count({ where: { userId: actor.id } })).toBe(0);
    } finally {
      resume.resolve();
      await Promise.allSettled([changing, ...(attempted ? [attempted] : [])]);
      spy.mockRestore();
    }
  });
});
