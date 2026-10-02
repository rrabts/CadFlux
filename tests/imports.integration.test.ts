import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { authenticate, logout } from "@/modules/auth/service";
import { POST as previewRoute } from "@/app/api/imports/preview/route";
import { POST as confirmRoute } from "@/app/api/imports/confirm/route";
import { GET as templateRoute } from "@/app/api/imports/template/route";
import { hashPassword } from "@/modules/auth/password";
import { safeUserSelect, type SafeUser } from "@/modules/users/types";
import { createImportPreview, confirmImport } from "@/modules/imports/service";
import { IMPORT_COLUMNS, type ImportRawData } from "@/modules/imports/types";

const runId = randomUUID().replaceAll("-", "");
let actor: SafeUser;
let secondActor: SafeUser;
let interviewer: SafeUser;
let categoryId: string;
let unitId: string;
let fixturePasswordHash: string;
const unitCode = `IMPORT-${runId}`;
const categoryName = `Categoria Fictícia ${runId}`;
const values = (suffix: string, changes: Partial<ImportRawData> = {}): ImportRawData => ({
  nome: `Pessoa Fictícia ${suffix}`,
  cpf_ou_identificador: `FUNC-${runId}-${suffix}`,
  email: `import-${runId}-${suffix}@exemplo.invalid`,
  matricula: `M-${runId.slice(0, 20)}-${suffix}`,
  perfil: "INTERVIEWER",
  categoria: categoryName,
  unidade: unitCode,
  status: "ACTIVE",
  ...changes,
});
const csv = (...rows: ImportRawData[]) =>
  Buffer.from(
    `${IMPORT_COLUMNS.join(",")}\n${rows.map((row) => IMPORT_COLUMNS.map((column) => row[column]).join(",")).join("\n")}`,
    "utf8",
  );

async function fixtureUser(suffix: string, profile: "DIRECTION" | "INTERVIEWER" = "DIRECTION") {
  return prisma.user.create({
    data: {
      name: `Administrador Fictício ${suffix}`,
      email: `${runId}-${suffix}@exemplo.invalid`,
      registrationNumber: `A-${runId.slice(0, 20)}-${suffix}`,
      passwordHash: fixturePasswordHash,
      accessProfile: profile,
      professionalCategoryId: categoryId,
      primaryUnitId: unitId,
      status: "ACTIVE",
      mustChangePassword: false,
    },
    select: safeUserSelect,
  });
}

beforeAll(async () => {
  if (
    !process.env.DATABASE_URL_TEST ||
    process.env.DATABASE_URL !== process.env.DATABASE_URL_TEST
  ) {
    throw new Error(
      "Integração requer DATABASE_URL_TEST e configuração Vitest apontando exclusivamente para banco de teste separado.",
    );
  }
  fixturePasswordHash = await hashPassword(`SenhaFicticia!${runId}`);
  const category = await prisma.professionalCategory.create({ data: { name: categoryName } });
  const unit = await prisma.unit.create({
    data: { name: `Unidade Fictícia ${runId}`, code: unitCode },
  });
  categoryId = category.id;
  unitId = unit.id;
  actor = await fixtureUser("admin");
  secondActor = await fixtureUser("admin2");
  interviewer = await fixtureUser("entrevistador", "INTERVIEWER");
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("importação PostgreSQL: confirmação, permissão e auditoria", () => {
  it("prévia válida não cria usuário; confirmação cria hash e troca obrigatória, com auditoria", async () => {
    const input = values("valido");
    const before = await prisma.user.count();
    const preview = await createImportPreview(actor, csv(input), "../../usuarios.csv");
    expect(preview).toMatchObject({
      fileName: "usuarios.csv",
      total: 1,
      valid: 1,
      invalid: 0,
      duplicates: 0,
    });
    expect(await prisma.user.count()).toBe(before);
    const confirmed = await confirmImport(actor, preview.batchId);
    expect(confirmed.created).toBe(1);
    expect(confirmed.credentials[0].temporaryPassword.length).toBeGreaterThanOrEqual(16);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: input.email } });
    expect(user.mustChangePassword).toBe(true);
    expect(user.passwordHash).not.toBe(confirmed.credentials[0].temporaryPassword);
    expect(confirmed.users[0]).not.toHaveProperty("passwordHash");
    const batch = await prisma.userImportBatch.findUniqueOrThrow({
      where: { id: preview.batchId },
    });
    expect(batch.status).toBe("CONFIRMED");
    expect(batch.confirmedAt).not.toBeNull();
    const logs = await prisma.auditLog.findMany({
      where: { OR: [{ entityId: user.id }, { entityId: preview.batchId }] },
    });
    expect(logs.map((log) => log.action)).toContain("USER_IMPORT_CONFIRMED");
    expect(logs.map((log) => log.action)).toContain("USER_CREATED");
    expect(JSON.stringify(logs)).not.toContain(confirmed.credentials[0].temporaryPassword);
    expect(JSON.stringify(logs)).not.toContain(user.passwordHash);
    await expect(confirmImport(actor, preview.batchId)).rejects.toMatchObject({ status: 409 });
    expect(await prisma.user.count()).toBe(before + 1);
  });
  it("XLSX real também recebe prévia sem criar usuário e confirmação funcional", async () => {
    const input = values("xlsx");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Usuários");
    sheet.addRow([...IMPORT_COLUMNS]);
    sheet.addRow(IMPORT_COLUMNS.map((column) => input[column]));
    const before = await prisma.user.count();
    const preview = await createImportPreview(
      actor,
      new Uint8Array(await workbook.xlsx.writeBuffer()),
      "usuarios.xlsx",
    );
    expect(preview).toMatchObject({ total: 1, valid: 1, invalid: 0 });
    expect(await prisma.user.count()).toBe(before);
    expect((await confirmImport(actor, preview.batchId)).created).toBe(1);
    expect(await prisma.user.findUnique({ where: { email: input.email } })).toMatchObject({
      mustChangePassword: true,
    });
  });
  it("identificador existente é validado usando sua forma normalizada", async () => {
    const first = values("dedup");
    const preview = await createImportPreview(actor, csv(first), "usuarios.csv");
    await confirmImport(actor, preview.batchId);
    const second = values("dedup2", {
      cpf_ou_identificador: first.cpf_ou_identificador.toLowerCase(),
    });
    const duplicate = await createImportPreview(actor, csv(second), "usuarios.csv");
    expect(duplicate).toMatchObject({ valid: 0, invalid: 1, duplicates: 1 });
    await expect(confirmImport(actor, duplicate.batchId)).rejects.toMatchObject({ status: 409 });
    expect(await prisma.user.findUnique({ where: { email: second.email } })).toBeNull();
  });
  it("lote com linha inválida não importa nem mesmo a linha válida", async () => {
    const first = values("atomico1");
    const second = values("atomico2", { perfil: "ADMIN", unidade: "UNIDADE-INEXISTENTE" });
    const before = await prisma.user.count();
    const preview = await createImportPreview(actor, csv(first, second), "usuarios.csv");
    expect(preview).toMatchObject({ total: 2, valid: 1, invalid: 1 });
    expect(preview.rows[1].errors.join(" ")).toMatch(/perfil|Unidade/);
    await expect(confirmImport(actor, preview.batchId)).rejects.toMatchObject({ status: 409 });
    expect(await prisma.user.count()).toBe(before);
    expect(
      (await prisma.userImportBatch.findUniqueOrThrow({ where: { id: preview.batchId } })).status,
    ).toBe("PREVIEW");
  });
  it("revalida unicidade após a prévia e impede criação parcial", async () => {
    const first = values("conflito1");
    const second = values("conflito2");
    const preview = await createImportPreview(actor, csv(first, second), "usuarios.csv");
    await prisma.user.create({
      data: {
        name: second.nome,
        email: second.email,
        registrationNumber: second.matricula,
        functionalIdentifier: second.cpf_ou_identificador,
        passwordHash: fixturePasswordHash,
        accessProfile: "INTERVIEWER",
        professionalCategoryId: categoryId,
        primaryUnitId: unitId,
      },
    });
    const before = await prisma.user.count();
    await expect(confirmImport(actor, preview.batchId)).rejects.toMatchObject({ status: 409 });
    expect(await prisma.user.count()).toBe(before);
    expect(await prisma.user.findUnique({ where: { email: first.email } })).toBeNull();
  });
  it("revalida categoria/unidade ativa no servidor após a prévia", async () => {
    const preview = await createImportPreview(actor, csv(values("inativa")), "usuarios.csv");
    await prisma.unit.update({ where: { id: unitId }, data: { active: false } });
    try {
      await expect(confirmImport(actor, preview.batchId)).rejects.toMatchObject({ status: 409 });
    } finally {
      await prisma.unit.update({ where: { id: unitId }, data: { active: true } });
    }
  });
  it("somente o dono do lote pode confirmar, mesmo entre duas Direções", async () => {
    const preview = await createImportPreview(actor, csv(values("dono")), "usuarios.csv");
    await expect(confirmImport(secondActor, preview.batchId)).rejects.toMatchObject({
      status: 404,
    });
  });
  it("recusa prévia expirada", async () => {
    const preview = await createImportPreview(actor, csv(values("expirada")), "usuarios.csv");
    await prisma.userImportBatch.update({
      where: { id: preview.batchId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(confirmImport(actor, preview.batchId)).rejects.toMatchObject({ status: 410 });
  });
  it("Entrevistador não cria prévia nem confirma", async () => {
    await expect(
      createImportPreview(interviewer, csv(values("proibido")), "usuarios.csv"),
    ).rejects.toMatchObject({ status: 403 });
    await expect(confirmImport(interviewer, "qualquer-lote")).rejects.toMatchObject({
      status: 403,
    });
  });
  it("revalida usuário inativo no banco, mesmo com ator anteriormente ativo", async () => {
    const preview = await createImportPreview(
      secondActor,
      csv(values("ator-inativo")),
      "usuarios.csv",
    );
    await prisma.user.update({ where: { id: secondActor.id }, data: { status: "INACTIVE" } });
    try {
      await expect(confirmImport(secondActor, preview.batchId)).rejects.toMatchObject({
        status: 403,
      });
    } finally {
      await prisma.user.update({ where: { id: secondActor.id }, data: { status: "ACTIVE" } });
    }
  });
  it("duas confirmações concorrentes criam exatamente um usuário e um evento de importação", async () => {
    const input = values("concorrente");
    const preview = await createImportPreview(actor, csv(input), "usuarios.csv");
    const results = await Promise.allSettled([
      confirmImport(actor, preview.batchId),
      confirmImport(actor, preview.batchId),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await prisma.user.count({ where: { email: input.email } })).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: { entityId: preview.batchId, action: "USER_IMPORT_CONFIRMED" },
      }),
    ).toBe(1);
  });
});

describe("importação API: contrato e fronteiras de autorização", () => {
  const origin = "http://127.0.0.1:3000";
  const request = (
    path: string,
    body?: string | FormData,
    token?: string,
    extraHeaders?: Record<string, string>,
  ) =>
    new Request(`${origin}${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        origin,
        ...(token ? { cookie: `cadflux_session=${token}` } : {}),
        ...(typeof body === "string" ? { "content-type": "application/json" } : {}),
        ...extraHeaders,
      },
      ...(body ? { body } : {}),
    });
  it("templates exigem sessão e Direção; ambos formatos são baixáveis", async () => {
    expect((await templateRoute(request("/api/imports/template"))).status).toBe(401);
    const blocked = await authenticate({
      email: interviewer.email,
      password: `SenhaFicticia!${runId}`,
    });
    expect(
      (await templateRoute(request("/api/imports/template?format=csv", undefined, blocked.token)))
        .status,
    ).toBe(403);
    await logout(blocked.token);
    const allowed = await authenticate({ email: actor.email, password: `SenhaFicticia!${runId}` });
    for (const format of ["csv", "xlsx"]) {
      const response = await templateRoute(
        request(`/api/imports/template?format=${format}`, undefined, allowed.token),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("content-disposition")).toContain(
        `cadflux-modelo-usuarios.${format}`,
      );
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
    }
    await logout(allowed.token);
  });
  it("prévia multipart e confirmação usam somente o lote armazenado no servidor", async () => {
    const auth = await authenticate({ email: actor.email, password: `SenhaFicticia!${runId}` });
    const before = await prisma.user.count();
    const input = values("api");
    const upload = new FormData();
    upload.set(
      "file",
      new File([new Uint8Array(csv(input))], "usuarios.csv", { type: "text/csv" }),
    );
    const response = await previewRoute(request("/api/imports/preview", upload, auth.token));
    expect(response.status).toBe(200);
    const preview = (await response.json()) as { batchId: string; valid: number };
    expect(preview.valid).toBe(1);
    expect(await prisma.user.count()).toBe(before);
    const tampered = await confirmRoute(
      request(
        "/api/imports/confirm",
        JSON.stringify({ batchId: preview.batchId, rows: [{ accessProfile: "DIRECTION" }] }),
        auth.token,
      ),
    );
    expect(tampered.status).toBe(400);
    expect(await prisma.user.count()).toBe(before);
    const confirmed = await confirmRoute(
      request("/api/imports/confirm", JSON.stringify({ batchId: preview.batchId }), auth.token),
    );
    expect(confirmed.status).toBe(201);
    expect(confirmed.headers.get("cache-control")).toBe("no-store");
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { email: input.email } })).accessProfile,
    ).toBe("INTERVIEWER");
    await logout(auth.token);
  });
  it("recusa origem externa, upload sem sessão e upload maior que o limite real", async () => {
    expect(
      (
        await previewRoute(
          request("/api/imports/preview", "{}", undefined, { origin: "https://externo.invalid" }),
        )
      ).status,
    ).toBe(403);
    expect((await previewRoute(request("/api/imports/preview", "{}"))).status).toBe(401);
    const auth = await authenticate({ email: actor.email, password: `SenhaFicticia!${runId}` });
    const upload = new FormData();
    upload.set(
      "file",
      new File([new Uint8Array(2 * 1024 * 1024 + 128 * 1024)], "usuarios.csv", {
        type: "text/csv",
      }),
    );
    expect((await previewRoute(request("/api/imports/preview", upload, auth.token))).status).toBe(
      413,
    );
    await logout(auth.token);
  });
});
