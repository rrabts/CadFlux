import { zipSync } from "fflate";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import ExcelJS from "exceljs";
import { hashPassword } from "../src/modules/auth/password";
const url = process.env.DATABASE_URL_TEST;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Defina DATABASE_URL_TEST apontando para banco exclusivo com sufixo _test.");
process.env.DATABASE_URL = url;
const db = new PrismaClient({ datasourceUrl: url });
const suffix = randomUUID().slice(0, 8);
let auth: typeof import("../src/modules/auth/service");
let users: typeof import("../src/modules/users/service");
let imports: typeof import("../src/modules/imports/service");
let can: typeof import("../src/modules/permissions/service").can;
let direction: Awaited<ReturnType<typeof import("../src/modules/auth/service").authenticate>>;
let interviewer: typeof direction;
let referral: typeof direction;
let unit: string, category: string;
const password = "Integration!2026Strong";
const input = (name: string) => ({
  name: `Fictício ${name}`,
  email: `${name}-${suffix}@cadflux.local`,
  registrationNumber: `${name}-${suffix}`,
  functionalIdentifier: null,
  accessProfile: "INTERVIEWER" as const,
  professionalCategoryId: category,
  primaryUnitId: unit,
  status: "ACTIVE" as const,
});
beforeAll(async () => {
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url! },
    stdio: "pipe",
  });
  auth = await import("../src/modules/auth/service");
  users = await import("../src/modules/users/service");
  imports = await import("../src/modules/imports/service");
  ({ can } = await import("../src/modules/permissions/service"));
  unit = (await db.unit.create({ data: { name: "Unidade Teste", code: `TEST-${suffix}` } })).id;
  category = (await db.professionalCategory.create({ data: { name: `Categoria ${suffix}` } })).id;
  const passwordHash = await hashPassword(password);
  const { safeUserSelect } = await import("../src/modules/users/types");
  direction = await db.user.create({
    data: {
      ...input("direcao"),
      accessProfile: "DIRECTION",
      mustChangePassword: false,
      passwordHash,
    },
    select: safeUserSelect,
  });
  interviewer = await db.user.create({
    data: { ...input("entrevistador"), mustChangePassword: false, passwordHash },
    select: safeUserSelect,
  });
  referral = await db.user.create({
    data: {
      ...input("encaminhador"),
      accessProfile: "REFERRAL_OPERATOR",
      mustChangePassword: false,
      passwordHash,
    },
    select: safeUserSelect,
  });
});
afterAll(async () => {
  await db.$disconnect();
  const { prisma } = await import("../src/lib/db");
  await prisma.$disconnect();
});
describe("autenticação real", () => {
  it("login válido, sessão sem token em texto puro e logout", async () => {
    const result = await auth.login({ login: direction.email, password });
    expect((await auth.authenticate(result.token)).id).toBe(direction.id);
    expect(await db.session.findFirst({ where: { tokenHash: result.token } })).toBeNull();
    await auth.logout(result.token);
    await expect(auth.authenticate(result.token)).rejects.toMatchObject({ status: 401 });
  });
  it("rejeita senha inválida e conta inexistente", async () => {
    await expect(auth.login({ login: direction.email, password: "errada" })).rejects.toMatchObject({
      status: 401,
    });
    await expect(auth.login({ login: `naoexiste-${suffix}`, password })).rejects.toMatchObject({
      status: 401,
    });
  });
  it("rejeita usuário inativo, sessão expirada e acesso anônimo", async () => {
    const result = await auth.login({ login: interviewer.email, password });
    await db.session.updateMany({
      where: { userId: interviewer.id },
      data: { expiresAt: new Date(0) },
    });
    await expect(auth.authenticate(result.token)).rejects.toMatchObject({ status: 401 });
    await expect(auth.authenticate()).rejects.toMatchObject({ status: 401 });
    await db.user.update({ where: { id: interviewer.id }, data: { status: "INACTIVE" } });
    await expect(auth.login({ login: interviewer.email, password })).rejects.toMatchObject({
      status: 401,
    });
    await db.user.update({ where: { id: interviewer.id }, data: { status: "ACTIVE" } });
  });
  it("limita tentativas de login", async () => {
    for (let i = 0; i < 10; i++)
      await auth.login({ login: `limit-${suffix}`, password: "errada" }).catch(() => {});
    await expect(
      auth.login({ login: `limit-${suffix}`, password: "errada" }),
    ).rejects.toMatchObject({ status: 429 });
  });
});
describe("permissões e gestão", () => {
  it("somente Direção pode gerenciar usuários", async () => {
    expect(can(direction, "users:manage")).toBe(true);
    for (const actor of [interviewer, referral]) {
      expect(can(actor, "users:manage")).toBe(false);
      await expect(users.createUser(actor, input("denied"))).rejects.toMatchObject({ status: 403 });
      await expect(users.listUsers(actor, {})).rejects.toMatchObject({ status: 403 });
    }
    expect(can({ ...direction, status: "INACTIVE" }, "users:manage")).toBe(false);
  });
  it("cria, edita, muda unidade/categoria/perfil, inativa e ativa com auditoria", async () => {
    const created = await users.createUser(direction, input("created"));
    expect(created.user.mustChangePassword).toBe(true);
    expect(created).not.toHaveProperty("passwordHash");
    const login = await auth.login({
      login: created.user.email,
      password: created.temporaryPassword,
    });
    expect(can(login.user, "dashboard:read")).toBe(false);
    await auth.changePassword(created.user.id, {
      currentPassword: created.temporaryPassword,
      newPassword: password,
    });
    await expect(auth.authenticate(login.token)).rejects.toMatchObject({ status: 401 });
    const session = await auth.login({ login: created.user.email, password });
    const unit2 = await db.unit.create({
        data: { name: "Outra unidade", code: `OTHER-${suffix}` },
      }),
      category2 = await db.professionalCategory.create({ data: { name: `Outra ${suffix}` } });
    const changed = {
      ...input("created"),
      name: "Nome fictício editado",
      accessProfile: "REFERRAL_OPERATOR",
      primaryUnitId: unit2.id,
      professionalCategoryId: category2.id,
      status: "INACTIVE",
    };
    const updated = await users.updateUser(direction, created.user.id, changed);
    expect(updated.name).toBe(changed.name);
    expect(updated.primaryUnitId).toBe(unit2.id);
    await expect(auth.authenticate(session.token)).rejects.toMatchObject({ status: 401 });
    await users.updateUser(direction, created.user.id, { ...changed, status: "ACTIVE" });
    expect((await auth.login({ login: created.user.email, password })).user.status).toBe("ACTIVE");
    const actions = (await db.auditLog.findMany({ where: { entityId: created.user.id } })).map(
      (l) => l.action,
    );
    expect(actions).toEqual(
      expect.arrayContaining([
        "USER_CREATED",
        "USER_UPDATED",
        "PROFILE_CHANGED",
        "CATEGORY_CHANGED",
        "UNIT_CHANGED",
        "USER_INACTIVATED",
        "USER_ACTIVATED",
        "LOGIN",
        "PASSWORD_CHANGED",
      ]),
    );
  });
  it("bloqueia autoalteração e audita tentativa", async () => {
    await expect(
      users.updateUser(direction, direction.id, {
        ...input("direcao"),
        accessProfile: "INTERVIEWER",
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      await db.auditLog.count({
        where: { actorUserId: direction.id, action: "SELF_ACCESS_CHANGE_DENIED" },
      }),
    ).toBeGreaterThan(0);
  });
  it("recusa mass assignment e referências inexistentes", async () => {
    await expect(
      users.createUser(direction, { ...input("bad"), passwordHash: "hack" }),
    ).rejects.toThrow();
    await expect(
      users.createUser(direction, { ...input("bad"), primaryUnitId: "missing" }),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("revalida administrador inativo antes de gravar", async () => {
    await db.user.update({ where: { id: direction.id }, data: { status: "INACTIVE" } });
    await expect(users.createUser(direction, input("blocked"))).rejects.toMatchObject({
      status: 403,
    });
    await db.user.update({ where: { id: direction.id }, data: { status: "ACTIVE" } });
  });
});
const raw = (name: string) => ({
  nome: `Importado ${name}`,
  cpf_ou_identificador: "",
  email: `${name}-${suffix}@cadflux.local`,
  matricula: `${name}-${suffix}`,
  perfil: "INTERVIEWER",
  categoria: `Categoria ${suffix}`,
  unidade: `TEST-${suffix}`,
  status: "ACTIVE",
});
const csv = (rows: ReturnType<typeof raw>[]) =>
  Buffer.from(
    imports.columns.join(",") +
      "\n" +
      rows.map((r) => imports.columns.map((k) => r[k as keyof typeof r]).join(",")).join("\n"),
  );
describe("importação", () => {
  it("CSV válido não grava antes de confirmar; confirmação única e auditada", async () => {
    const row = raw("csv");
    const preview = await imports.previewImport(direction, "users.csv", csv([row]));
    expect(preview.valid).toBe(1);
    expect(await db.user.findUnique({ where: { email: row.email } })).toBeNull();
    const credentials = await imports.confirmImport(direction, preview.id);
    expect(credentials).toHaveLength(1);
    expect(
      (await auth.login({ login: row.email, password: credentials[0].temporaryPassword })).user
        .mustChangePassword,
    ).toBe(true);
    await expect(imports.confirmImport(direction, preview.id)).rejects.toMatchObject({
      status: 409,
    });
    expect(
      await db.auditLog.count({ where: { entityId: preview.id, action: "USERS_IMPORTED" } }),
    ).toBe(1);
  });
  it("XLSX válido", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Usuários");
    sheet.addRow(imports.columns);
    const row = raw("xlsx");
    sheet.addRow(imports.columns.map((k) => row[k as keyof typeof row]));
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const preview = await imports.previewImport(direction, "users.xlsx", buffer);
    expect(preview.valid).toBe(1);
    await imports.confirmImport(direction, preview.id);
  });
  it("detecta perfil, unidade e categoria inválidos", async () => {
    const rows = [
      { ...raw("bad-profile"), perfil: "ADMIN" },
      { ...raw("bad-category"), categoria: "Inexistente" },
      { ...raw("bad-unit"), unidade: "Inexistente" },
    ];
    const preview = await imports.previewImport(direction, "users.csv", csv(rows));
    expect(preview.invalid).toBe(3);
    expect(preview.rows.every((r) => r.errors.length)).toBe(true);
    await expect(imports.confirmImport(direction, preview.id)).rejects.toMatchObject({
      status: 409,
    });
  });
  it("detecta duplicidade no banco e no arquivo", async () => {
    const preview = await imports.previewImport(
      direction,
      "users.csv",
      csv([raw("csv"), raw("duplicate"), raw("duplicate")]),
    );
    expect(preview.duplicates).toBe(2);
  });
  it("revalida duplicidade introduzida após a prévia e preserva atomicidade", async () => {
    const preview = await imports.previewImport(
      direction,
      "users.csv",
      csv([raw("atomic-first"), raw("race")]),
    );
    await users.createUser(direction, input("race"));
    await expect(imports.confirmImport(direction, preview.id)).rejects.toMatchObject({
      status: 409,
    });
    expect(await db.user.findUnique({ where: { email: raw("atomic-first").email } })).toBeNull();
  });
  it("bloqueia IDOR na confirmação", async () => {
    const preview = await imports.previewImport(direction, "users.csv", csv([raw("idor")]));
    await expect(
      imports.confirmImport({ ...direction, id: referral.id }, preview.id),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("rejeita SQL, formato falso, arquivo grande, colunas de senha e fórmulas", async () => {
    await expect(imports.parseFile("users.sql", Buffer.from("SELECT 1"))).rejects.toThrow();
    await expect(imports.parseFile("users.xlsx", Buffer.from("not zip"))).rejects.toThrow();
    await expect(
      imports.parseFile("users.csv", Buffer.alloc(imports.MAX_BYTES + 1)),
    ).rejects.toThrow();
    await expect(
      imports.parseFile("users.csv", Buffer.from("nome,senha\nTeste,123")),
    ).rejects.toThrow();
    const preview = await imports.previewImport(
      direction,
      "users.csv",
      csv([{ ...raw("formula"), nome: "=HYPERLINK()" }]),
    );
    expect(preview.invalid).toBe(1);
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet("Users");
    sheet.addRow(imports.columns);
    sheet.addRow([{ formula: "1+1" }, "", "a@b.c", "x", "INTERVIEWER", "x", "x", "ACTIVE"]);
    await expect(
      imports.parseFile("users.xlsx", Buffer.from(await book.xlsx.writeBuffer())),
    ).rejects.toThrow(/Fórmulas/);
  });
  it("valida CPF estrutural sem consulta oficial", () => {
    expect(imports.validIdentifier("11111111111")).toBe(false);
    expect(imports.validIdentifier("123")).toBe(false);
    expect(imports.validIdentifier("DEMO-123")).toBe(true);
  });
});
describe("auditoria imutável", () => {
  it("nega update, delete, truncate e exclusão física de usuário", async () => {
    const log = await db.auditLog.findFirstOrThrow();
    await expect(
      db.auditLog.update({ where: { id: log.id }, data: { action: "tampered" } }),
    ).rejects.toThrow();
    await expect(db.auditLog.delete({ where: { id: log.id } })).rejects.toThrow();
    await expect(db.$executeRawUnsafe('TRUNCATE "AuditLog"')).rejects.toThrow();
    await expect(db.user.delete({ where: { id: interviewer.id } })).rejects.toThrow();
  });
  it("não inclui senha, token ou identificador nos logs", async () => {
    const logs = JSON.stringify(
      await db.auditLog.findMany({ where: { actorUserId: direction.id } }),
    );
    expect(logs).not.toContain(password);
    expect(logs).not.toContain("passwordHash");
    expect(logs).not.toContain("tokenHash");
    expect(logs).not.toContain("functionalIdentifier");
  });
});

it("bloqueia XLSX com expansão excessiva mesmo com tamanho declarado falso", async () => {
  const zip = Buffer.from(zipSync({ "[Content_Types].xml": Buffer.alloc(13 * 1024 * 1024, 65) }));
  zip.writeUInt32LE(1, 22);
  const central = zip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  zip.writeUInt32LE(1, central + 24);
  await expect(imports.parseFile("bomb.xlsx", zip)).rejects.toMatchObject({ status: 400 });
});
it("recusa linhas excessivas e prévia expirada", async () => {
  await expect(
    imports.parseFile("too-many.csv", csv(Array.from({ length: 501 }, (_, i) => raw(`limit${i}`)))),
  ).rejects.toMatchObject({ status: 400 });
  const preview = await imports.previewImport(direction, "expired.csv", csv([raw("expired")]));
  await db.userImportBatch.update({ where: { id: preview.id }, data: { expiresAt: new Date(0) } });
  await expect(imports.confirmImport(direction, preview.id)).rejects.toMatchObject({ status: 409 });
});
