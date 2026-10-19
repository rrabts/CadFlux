import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { authenticate, logout, userFromToken } from "@/modules/auth/service";
import { safeUserSelect, type SafeUser } from "@/modules/users/types";
import { createUser, updateUser } from "@/modules/users/service";
import { getReference, listReferencePage, saveReference } from "@/modules/references/service";
import { unitInputSchema, categoryInputSchema } from "@/modules/references/schema";
import { GET, POST } from "@/app/api/references/[kind]/route";
import { PATCH } from "@/app/api/references/[kind]/[id]/route";

const suffix = randomUUID().slice(0, 8);
let direction: SafeUser;
let count = 0;
const unitData = (name: string) => ({
  name: `Unidade Fictícia ${name} ${suffix}`,
  code: `F2-${suffix}-${++count}`,
  timezone: "America/Sao_Paulo",
  active: true,
});
const userData = (name: string) => ({
  name: `Pessoa Fictícia ${name}`,
  email: `f2-${suffix}-${++count}@exemplo.invalid`,
  registrationNumber: `F2-${suffix}-${count}`,
  functionalIdentifier: `FUNC-F2-${suffix}-${count}`,
  accessProfile: "INTERVIEWER" as const,
  professionalCategoryId: direction.professionalCategoryId,
  primaryUnitId: direction.primaryUnitId,
  status: "ACTIVE" as const,
});
const req = (path: string, method = "GET", body?: unknown, token?: string) =>
  new Request(`http://127.0.0.1:3000${path}`, {
    method,
    headers: {
      origin: "http://127.0.0.1:3000",
      ...(token ? { cookie: `cadflux_session=${token}` } : {}),
      "content-type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
beforeAll(async () => {
  direction = await prisma.user.findUniqueOrThrow({
    where: { email: "direcao@cadflux.local" },
    select: safeUserSelect,
  });
});
afterAll(() => prisma.$disconnect());

describe("Fase 2: cadastros, vínculos e auditoria no PostgreSQL", () => {
  it("exige sessão e impede os dois operadores de consultar ou manter cadastros", async () => {
    expect(
      (await GET(req("/api/references/units"), { params: Promise.resolve({ kind: "units" }) }))
        .status,
    ).toBe(401);
    for (const email of ["entrevistador@cadflux.local", "encaminhador@cadflux.local"]) {
      const auth = await authenticate({ email, password: "CadFlux!Demo2026" });
      for (const kind of ["units", "categories"]) {
        expect(
          (
            await GET(req(`/api/references/${kind}`, "GET", undefined, auth.token), {
              params: Promise.resolve({ kind }),
            })
          ).status,
        ).toBe(403);
        expect(
          (
            await POST(req(`/api/references/${kind}`, "POST", {}, auth.token), {
              params: Promise.resolve({ kind }),
            })
          ).status,
        ).toBe(403);
        expect(
          (
            await PATCH(req(`/api/references/${kind}/missing`, "PATCH", {}, auth.token), {
              params: Promise.resolve({ kind, id: "missing" }),
            })
          ).status,
        ).toBe(403);
      }
      await logout(auth.token);
    }
  });
  it("cria, edita, inativa/reativa e registra histórico com autor", async () => {
    for (const kind of ["units", "categories"] as const) {
      const data =
        kind === "units"
          ? unitData("Histórico")
          : { name: `Categoria Fictícia ${suffix}`, active: true };
      const item = await saveReference(direction, kind, data);
      await saveReference(direction, kind, { ...data, name: data.name + " Editada" }, item.id);
      await saveReference(direction, kind, { ...data, active: false }, item.id);
      await saveReference(direction, kind, { ...data, active: true }, item.id);
      const detail = await getReference(direction, kind, item.id);
      expect(detail.item.active).toBe(true);
      expect(detail.history).toHaveLength(4);
      expect(detail.history.every((entry) => entry.actorUser?.name === direction.name)).toBe(true);
      expect(detail.history.map((entry) => entry.action)).toEqual(
        expect.arrayContaining([
          kind === "units" ? "UNIT_CREATED" : "CATEGORY_CREATED",
          kind === "units" ? "UNIT_INACTIVATED" : "CATEGORY_INACTIVATED",
        ]),
      );
    }
  });
  it("valida nome, código, fuso e rejeita duplicidade inclusive no banco", async () => {
    expect(
      unitInputSchema.safeParse({ ...unitData("Inválida"), timezone: "Mars/Invalid" }).success,
    ).toBe(false);
    expect(categoryInputSchema.safeParse({ name: " ", active: true }).success).toBe(false);
    const data = unitData("Duplicada");
    await saveReference(direction, "units", data);
    await expect(
      saveReference(direction, "units", { ...data, code: data.code.toLowerCase() }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      prisma.unit.create({ data: { ...data, code: data.code.toLowerCase() } }),
    ).rejects.toMatchObject({ code: "P2002" });
    const category = { name: `Unicidade Fictícia ${suffix}`, active: true };
    await saveReference(direction, "categories", category);
    await expect(
      saveReference(direction, "categories", { ...category, name: category.name.toUpperCase() }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      prisma.professionalCategory.create({
        data: { ...category, name: category.name.toUpperCase() },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });
  it("bloqueia inativação de unidade principal e categoria de usuário ativo", async () => {
    const unit = await prisma.unit.findUniqueOrThrow({ where: { id: direction.primaryUnitId } });
    const category = await prisma.professionalCategory.findUniqueOrThrow({
      where: { id: direction.professionalCategoryId },
    });
    await expect(
      saveReference(
        direction,
        "units",
        { name: unit.name, code: unit.code, timezone: unit.timezone, active: false },
        unit.id,
      ),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      saveReference(direction, "categories", { name: category.name, active: false }, category.id),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("salva e remove unidades adicionais com auditoria e revogação de sessão", async () => {
    const data = unitData("Adicional");
    const unit = await saveReference(direction, "units", data);
    const input = userData("Vínculos");
    const created = await createUser(direction, input);
    await prisma.user.update({
      where: { id: created.user.id },
      data: { mustChangePassword: false },
    });
    const auth = await authenticate({ email: input.email, password: created.temporaryPassword });
    const user = await updateUser(direction, created.user.id, {
      ...input,
      additionalUnitIds: [unit.id],
    });
    expect(user.additionalUnitIds).toEqual([unit.id]);
    expect(await userFromToken(auth.token)).toBeNull();
    await expect(
      saveReference(direction, "units", { ...data, active: false }, unit.id),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      await prisma.auditLog.count({
        where: { entityId: user.id, action: "USER_ADDITIONAL_UNITS_CHANGED" },
      }),
    ).toBe(1);
    // Older clients omitting the field preserve existing links.
    await updateUser(direction, user.id, { ...input, name: "Pessoa Fictícia Renomeada" });
    expect(await prisma.userUnitAccess.count({ where: { userId: user.id } })).toBe(1);
    await updateUser(direction, user.id, { ...input, additionalUnitIds: [] });
    await saveReference(direction, "units", { ...data, active: false }, unit.id);
    expect(await prisma.userUnitAccess.count({ where: { userId: user.id } })).toBe(0);
  });
  it("rejeita vínculos novos inativos, inexistentes, repetidos ou iguais à unidade principal", async () => {
    const data = unitData("Inativa");
    const unit = await saveReference(direction, "units", { ...data, active: false });
    for (const ids of [[unit.id], ["missing"], [direction.primaryUnitId], [unit.id, unit.id]])
      await expect(
        createUser(direction, { ...userData("Inválida"), additionalUnitIds: ids }),
      ).rejects.toBeDefined();
  });
  it("preserva histórico inativo, mas exige referência ativa antes de reativar usuário", async () => {
    const data = unitData("Histórica");
    const unit = await saveReference(direction, "units", data);
    const category = await saveReference(direction, "categories", {
      name: `Histórica Fictícia ${suffix}`,
      active: true,
    });
    const input = {
      ...userData("Histórica"),
      primaryUnitId: unit.id,
      professionalCategoryId: category.id,
      status: "INACTIVE" as const,
    };
    const created = await createUser(direction, input);
    await saveReference(direction, "units", { ...data, active: false }, unit.id);
    await saveReference(
      direction,
      "categories",
      { name: category.name, active: false },
      category.id,
    );
    await updateUser(direction, created.user.id, { ...input, name: "Histórico preservado" });
    await expect(
      updateUser(direction, created.user.id, { ...input, status: "ACTIVE" }),
    ).rejects.toMatchObject({ status: 400 });
    await saveReference(direction, "units", data, unit.id);
    await saveReference(
      direction,
      "categories",
      { name: category.name, active: true },
      category.id,
    );
    expect(
      (await updateUser(direction, created.user.id, { ...input, status: "ACTIVE" })).status,
    ).toBe("ACTIVE");
  });
  it("revalida o ator no banco e recusa origem externa", async () => {
    const operator = await prisma.user.findUniqueOrThrow({
      where: { email: "entrevistador@cadflux.local" },
      select: safeUserSelect,
    });
    await expect(
      saveReference({ ...operator, accessProfile: "DIRECTION" }, "units", unitData("Negada")),
    ).rejects.toMatchObject({ status: 403 });
    const response = await POST(
      new Request("http://127.0.0.1:3000/api/references/units", {
        method: "POST",
        headers: { origin: "https://outside.invalid" },
        body: "{}",
      }),
      { params: Promise.resolve({ kind: "units" }) },
    );
    expect(response.status).toBe(403);
  });
  it("filtra, pagina e mantém integridade sob vínculo e inativação concorrentes", async () => {
    const prefix = `Paginação Fictícia ${suffix}`;
    await prisma.unit.createMany({
      data: Array.from({ length: 51 }, (_, i) => ({
        name: `${prefix} ${String(i).padStart(2, "0")}`,
        code: `PG-F2-${suffix}-${i}`,
      })),
    });
    const page = await listReferencePage(direction, "units", {
      q: prefix,
      page: 2,
      status: "active",
    });
    expect(page.total).toBe(51);
    expect(page.items).toHaveLength(1);
    const data = unitData("Concorrente");
    const unit = await saveReference(direction, "units", data);
    const input = userData("Concorrente");
    const created = await createUser(direction, input);
    const attempts = await Promise.allSettled([
      updateUser(direction, created.user.id, { ...input, additionalUnitIds: [unit.id] }),
      saveReference(direction, "units", { ...data, active: false }, unit.id),
    ]);
    expect(attempts.some((attempt) => attempt.status === "fulfilled")).toBe(true);
    const current = await prisma.unit.findUniqueOrThrow({ where: { id: unit.id } });
    if (!current.active)
      expect(
        await prisma.userUnitAccess.count({
          where: { unitId: unit.id, user: { status: "ACTIVE" } },
        }),
      ).toBe(0);
  });
});
