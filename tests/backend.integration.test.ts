import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import {
  authenticate,
  logout,
  userFromToken,
  requireApiUser,
  changePassword,
} from "@/modules/auth/service";
import {
  createUser,
  updateUser,
  listUsers,
  listUsersPage,
  safeUserSelect,
} from "@/modules/users/service";
import { hashToken, verifyPassword } from "@/modules/auth/password";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { GET as usersRoute, POST as createRoute } from "@/app/api/users/route";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";
import type { SafeUser } from "@/modules/users/types";
import { isValidCpf, type UserInput } from "@/modules/users/schema";
let direction: SafeUser;
let unit: string, category: string;
const suffix = randomUUID().slice(0, 8);
function input(name: string): UserInput {
  return {
    name: "Fictício " + name,
    email: name + "-" + suffix + "@cadflux.local",
    registrationNumber: name + "-" + suffix,
    functionalIdentifier: "FUNC-" + name + "-" + suffix,
    accessProfile: "INTERVIEWER",
    professionalCategoryId: category,
    primaryUnitId: unit,
    status: "ACTIVE",
  };
}
const req = (path: string, body?: unknown, token?: string) =>
  new Request("http://127.0.0.1:3000" + path, {
    method: body ? "POST" : "GET",
    headers: {
      origin: "http://127.0.0.1:3000",
      ...(token ? { cookie: "cadflux_session=" + token } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
beforeAll(async () => {
  direction = await prisma.user.findUniqueOrThrow({
    where: { email: "direcao@cadflux.local" },
    select: safeUserSelect,
  });
  unit = direction.primaryUnitId;
  category = direction.professionalCategoryId;
});
afterAll(() => prisma.$disconnect());
describe("PostgreSQL real: autenticação, gestão e auditoria", () => {
  it("login válido, sessão por hash, cookie httpOnly e logout", async () => {
    const response = await loginRoute(
      req("/api/auth/login", { email: "direcao@cadflux.local", password: "CadFlux!Demo2026" }),
    );
    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie")!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=lax");
    const token = cookie.match(/cadflux_session=([^;]+)/)![1];
    const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) } });
    expect(session).not.toBeNull();
    expect(session?.tokenHash).not.toBe(token);
    expect(await userFromToken(token)).toMatchObject({ id: direction.id });
    const out = await logoutRoute(req("/api/auth/logout", {}, token));
    expect(out.status).toBe(200);
    expect(await userFromToken(token)).toBeNull();
    expect(
      await prisma.auditLog.count({ where: { actorUserId: direction.id, action: "LOGIN" } }),
    ).toBeGreaterThan(0);
  });
  it("login inválido, usuário inativo e origem externa", async () => {
    await expect(
      authenticate({ email: "direcao@cadflux.local", password: "incorreta" }),
    ).rejects.toMatchObject({ status: 401 });
    const created = await createUser(direction, { ...input("inativo"), status: "INACTIVE" });
    await expect(
      authenticate({ email: created.user.email, password: created.temporaryPassword }),
    ).rejects.toMatchObject({ status: 401 });
    const response = await loginRoute(
      new Request("http://127.0.0.1:3000/api/auth/login", {
        method: "POST",
        headers: { origin: "https://externo.invalid" },
        body: "{}",
      }),
    );
    expect(response.status).toBe(403);
  });
  it("API protegida e perfis distintos", async () => {
    expect((await usersRoute(req("/api/users"))).status).toBe(401);
    for (const email of ["entrevistador@cadflux.local", "encaminhador@cadflux.local"]) {
      const auth = await authenticate({ email, password: "CadFlux!Demo2026" });
      expect((await usersRoute(req("/api/users", undefined, auth.token))).status).toBe(403);
      expect((await createRoute(req("/api/users", input("negado"), auth.token))).status).toBe(403);
      await logout(auth.token);
    }
    const auth = await authenticate({ email: direction.email, password: "CadFlux!Demo2026" });
    expect((await usersRoute(req("/api/users", undefined, auth.token))).status).toBe(200);
    expect(
      await requireApiUser(req("/api/users", undefined, auth.token), "users:read"),
    ).toMatchObject({ id: direction.id });
    await logout(auth.token);
  });
  it("gestão cria, edita, altera perfil/categoria/unidade, inativa e mantém histórico", async () => {
    const created = await createUser(direction, input("gestao"));
    expect(created.user.mustChangePassword).toBe(true);
    const record = await prisma.user.findUniqueOrThrow({ where: { id: created.user.id } });
    expect(record.passwordHash).not.toContain(created.temporaryPassword);
    expect(await verifyPassword(created.temporaryPassword, record.passwordHash)).toBe(true);
    expect(created.user).not.toHaveProperty("passwordHash");
    const targetUnit = await prisma.unit.findFirstOrThrow({
      where: { id: { not: unit }, active: true },
    });
    const targetCategory = await prisma.professionalCategory.findFirstOrThrow({
      where: { id: { not: category }, active: true },
    });
    const changed = {
      ...input("gestao"),
      name: "Fictício Editado",
      primaryUnitId: targetUnit.id,
      professionalCategoryId: targetCategory.id,
      accessProfile: "REFERRAL_OPERATOR" as const,
    };
    await updateUser(direction, created.user.id, changed);
    const auth = await authenticate({
      email: created.user.email,
      password: created.temporaryPassword,
    });
    await expect(
      requireApiUser(req("/api/users", undefined, auth.token), "dashboard:read"),
    ).rejects.toMatchObject({ status: 428 });
    await changePassword(auth.user, {
      currentPassword: created.temporaryPassword,
      newPassword: "Senha!FicticiaNova2026",
    });
    expect(await userFromToken(auth.token)).toBeNull();
    const normal = await authenticate({
      email: created.user.email,
      password: "Senha!FicticiaNova2026",
    });
    await updateUser(direction, created.user.id, { ...changed, status: "INACTIVE" });
    expect(await userFromToken(normal.token)).toBeNull();
    await expect(
      authenticate({ email: created.user.email, password: "Senha!FicticiaNova2026" }),
    ).rejects.toMatchObject({ status: 401 });
    const rows = await prisma.auditLog.findMany({
      where: { entityType: "User", entityId: created.user.id },
    });
    const actions = rows.map((r) => r.action);
    for (const action of [
      "USER_CREATED",
      "USER_UPDATED",
      "USER_PROFILE_CHANGED",
      "USER_CATEGORY_CHANGED",
      "USER_UNIT_CHANGED",
      "USER_INACTIVATED",
      "PASSWORD_CHANGED",
    ])
      expect(actions).toContain(action);
    const audit = JSON.stringify(rows);
    expect(audit).not.toContain(created.temporaryPassword);
    expect(audit).not.toContain(record.passwordHash);
    expect(
      await listUsers(direction, {
        q: "Editado",
        profile: "REFERRAL_OPERATOR",
        unitId: targetUnit.id,
        categoryId: targetCategory.id,
        status: "INACTIVE",
      }),
    ).toEqual(expect.arrayContaining([expect.objectContaining({ id: created.user.id })]));
    await updateUser(direction, created.user.id, { ...changed, status: "ACTIVE" });
    expect(
      await prisma.auditLog.count({
        where: { entityId: created.user.id, action: "USER_ACTIVATED" },
      }),
    ).toBe(1);
  });
  it("duplicidade, referência inválida, autoalteração e sem delete físico", async () => {
    const x = await createUser(direction, input("unicidade"));
    await expect(createUser(direction, input("unicidade"))).rejects.toMatchObject({
      code: "P2002",
    });
    await expect(
      createUser(direction, { ...input("ref-invalida"), primaryUnitId: "ausente" }),
    ).rejects.toMatchObject({ status: 400 });
    const own = {
      name: direction.name,
      email: direction.email,
      registrationNumber: direction.registrationNumber,
      functionalIdentifier: direction.functionalIdentifier,
      accessProfile: "INTERVIEWER",
      professionalCategoryId: category,
      primaryUnitId: unit,
      status: "ACTIVE",
    };
    await expect(updateUser(direction, direction.id, own)).rejects.toMatchObject({ status: 403 });
    await expect(prisma.user.delete({ where: { id: x.user.id } })).rejects.toThrow();
  });
  it("auditoria rejeita UPDATE DELETE e TRUNCATE no banco", async () => {
    const log = await prisma.auditLog.findFirstOrThrow();
    await expect(
      prisma.auditLog.update({ where: { id: log.id }, data: { action: "TAMPERED" } }),
    ).rejects.toThrow();
    await expect(prisma.auditLog.delete({ where: { id: log.id } })).rejects.toThrow();
    await expect(prisma.$executeRawUnsafe('TRUNCATE TABLE "AuditLog"')).rejects.toThrow();
    expect((await prisma.auditLog.findUniqueOrThrow({ where: { id: log.id } })).action).toBe(
      log.action,
    );
  });
  it("sessão expirada e rate limit", async () => {
    const auth = await authenticate({ email: direction.email, password: "CadFlux!Demo2026" });
    await prisma.session.update({
      where: { tokenHash: hashToken(auth.token) },
      data: { expiresAt: new Date(0) },
    });
    expect(await userFromToken(auth.token)).toBeNull();
    const email = "rate-" + suffix + "@cadflux.local";
    for (let i = 0; i < 10; i++)
      await expect(authenticate({ email, password: "errada" })).rejects.toMatchObject({
        status: 401,
      });
    await expect(authenticate({ email, password: "errada" })).rejects.toMatchObject({
      status: 429,
    });
  });
  it("busca CPF sintético com e sem máscara e preserva a pesquisa por nome", async () => {
    let cpf = "";
    for (let attempt = 0; attempt < 10; attempt++) {
      let candidate =
        "000" + String(((parseInt(suffix, 16) + attempt) % 999999) + 1).padStart(6, "0");
      for (const size of [9, 10]) {
        let sum = 0;
        for (let index = 0; index < size; index++)
          sum += Number(candidate[index]) * (size + 1 - index);
        candidate += String(((sum * 10) % 11) % 10);
      }
      if (!(await prisma.user.findUnique({ where: { functionalIdentifier: candidate } }))) {
        cpf = candidate;
        break;
      }
    }
    expect(isValidCpf(cpf)).toBe(true);
    const mask = cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
    const name = "Pessoa Fictícia CPF " + suffix;
    const created = await createUser(direction, {
      ...input("cpf-mascarado"),
      name,
      functionalIdentifier: mask,
    });
    expect(created.user.functionalIdentifier).toBe(cpf);
    for (const q of [cpf, mask, name]) {
      const found = await listUsersPage(direction, { q });
      expect(found.total).toBe(1);
      expect(found.users.map((user) => user.id)).toEqual([created.user.id]);
    }
  });
  it("paginação permite acessar todos os usuários sem truncar resultados", async () => {
    const passwordHash = (await prisma.user.findUniqueOrThrow({ where: { id: direction.id } }))
      .passwordHash;
    await prisma.user.createMany({
      data: Array.from({ length: 51 }, (_, index) => ({
        ...input("pagina-" + index),
        name: "Paginação Fictícia " + suffix + " " + String(index).padStart(2, "0"),
        passwordHash,
        mustChangePassword: true,
      })),
    });
    const q = "Paginação Fictícia " + suffix;
    const first = await listUsersPage(direction, { q, page: "1" });
    const second = await listUsersPage(direction, { q, page: "2" });
    expect(first).toMatchObject({ total: 51, page: 1, pageSize: 50 });
    expect(first.users).toHaveLength(50);
    expect(second.users).toHaveLength(1);
    expect(new Set([...first.users, ...second.users].map((u) => u.id)).size).toBe(51);
    await expect(listUsersPage(direction, { page: "0" })).rejects.toThrow();
    const auth = await authenticate({ email: direction.email, password: "CadFlux!Demo2026" });
    const response = await usersRoute(
      req("/api/users?q=" + encodeURIComponent(q) + "&page=2", undefined, auth.token),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      total: 51,
      page: 2,
      users: [expect.objectContaining({ id: second.users[0].id })],
    });
    await logout(auth.token);
  });
});
