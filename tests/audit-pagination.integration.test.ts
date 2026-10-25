import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { authenticate } from "@/modules/auth/service";
import { safeUserSelect, type SafeUser } from "@/modules/users/types";
import { auditPage } from "@/modules/audit/pagination";
import { createAttendance } from "@/modules/attendances/service";
import { dateInTimezone } from "@/modules/attendances/contracts";
import { GET as AUDIT } from "@/app/api/audit/route";
import { GET as USER } from "@/app/api/users/[id]/route";
import { GET as REFERENCE } from "@/app/api/references/[kind]/[id]/route";
import { GET as CATALOG } from "@/app/api/catalog/[kind]/[id]/route";
import { GET as ATTENDANCE } from "@/app/api/attendances/[id]/route";

const suffix = randomUUID();
const sameTime = new Date(Date.now() + 60_000);
let directionToken: string, ownerToken: string, otherToken: string;
let owner: SafeUser, other: SafeUser;
type Page = {
  entries?: { id: string }[];
  history?: { id: string }[];
  nextHistoryCursor: string | null;
};
function request(path: string, token?: string, cursor?: string) {
  return new Request(
    `http://127.0.0.1:3000${path}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    {
      headers: token ? { cookie: `cadflux_session=${token}` } : {},
    },
  );
}
async function fixtureHistory(entityType: string, entityId: string, count: number) {
  const ids = Array.from(
    { length: count },
    (_, index) => `audit-${suffix}-${entityType}-${String(index).padStart(4, "0")}`,
  );
  await prisma.auditLog.createMany({
    data: ids.map((id) => ({
      id,
      action: "REVIEW_PAGINATION_FIXTURE",
      entityType,
      entityId,
      createdAt: sameTime,
    })),
  });
  return ids;
}
async function collect(load: (cursor?: string) => Promise<Response>) {
  const ids: string[] = [];
  let cursor: string | undefined;
  let pages = 0;
  do {
    const response = await load(cursor);
    expect(response.status).toBe(200);
    const body = (await response.json()) as Page;
    ids.push(...(body.history ?? body.entries ?? []).map((entry) => entry.id));
    cursor = body.nextHistoryCursor ?? undefined;
    expect(++pages).toBeLessThan(50);
  } while (cursor);
  expect(new Set(ids).size).toBe(ids.length);
  return { ids, pages };
}
beforeAll(async () => {
  const seed = await prisma.user.findUniqueOrThrow({
    where: { email: "entrevistador@cadflux.local" },
  });
  for (const label of ["owner", "other"]) {
    const user = await prisma.user.create({
      data: {
        name: `Operador Fictício Auditoria ${label}`,
        email: `audit-${label}-${suffix}@exemplo.invalid`,
        registrationNumber: `A-${label}-${suffix.slice(0, 20)}`,
        passwordHash: seed.passwordHash,
        accessProfile: "INTERVIEWER",
        professionalCategoryId: seed.professionalCategoryId,
        primaryUnitId: seed.primaryUnitId,
        mustChangePassword: false,
      },
      select: safeUserSelect,
    });
    const login = await authenticate({ email: user.email, password: "CadFlux!Demo2026" });
    if (label === "owner") {
      owner = user;
      ownerToken = login.token;
    } else {
      other = user;
      otherToken = login.token;
    }
  }
  directionToken = (
    await authenticate({ email: "direcao@cadflux.local", password: "CadFlux!Demo2026" })
  ).token;
});
afterAll(() => prisma.$disconnect());

describe("Regressão D04: histórico completo com cursores estáveis", () => {
  it("alcança mais de 200 eventos globais, preservando empates de data", async () => {
    const ids = await fixtureHistory("ReviewGlobal", suffix, 215);
    const first = await AUDIT(request("/api/audit", directionToken));
    const body = (await first.json()) as Page;
    expect(body.entries).toHaveLength(200);
    expect(body.nextHistoryCursor).toEqual(expect.any(String));
    const all = await collect((cursor) => AUDIT(request("/api/audit", directionToken, cursor)));
    expect(ids.every((id) => all.ids.includes(id))).toBe(true);
    expect(all.pages).toBeGreaterThan(1);
    expect((await AUDIT(request("/api/audit", ownerToken, body.nextHistoryCursor!))).status).toBe(
      403,
    );
    expect((await AUDIT(request("/api/audit", undefined, body.nextHistoryCursor!))).status).toBe(
      401,
    );
    expect((await AUDIT(request("/api/audit", directionToken, "malformado"))).status).toBe(400);
  });

  it("paginação por chave não repete ou perde eventos ao inserir novos no topo", async () => {
    const ids = await fixtureHistory("ReviewStable", suffix, 105);
    const where = { entityType: "ReviewStable", entityId: suffix };
    const first = await auditPage(prisma, where);
    await prisma.auditLog.create({
      data: {
        action: "REVIEW_NEWER",
        entityType: "ReviewStable",
        entityId: suffix,
        createdAt: new Date(sameTime.getTime() + 1),
      },
    });
    const second = await auditPage(prisma, where, first.nextHistoryCursor!);
    expect(second.nextHistoryCursor).toBeNull();
    expect([...first.entries, ...second.entries].map((entry) => entry.id)).toEqual(
      [...ids].sort().reverse(),
    );
  });

  it("permite continuar históricos de usuário, unidade, categoria, benefício e tipo", async () => {
    const unit = await prisma.unit.create({
      data: { name: `Unidade Fictícia História ${suffix}`, code: `HIST-${suffix.slice(0, 20)}` },
    });
    const category = await prisma.professionalCategory.create({
      data: { name: `Categoria Fictícia História ${suffix}` },
    });
    const benefit = await prisma.benefit.create({
      data: { name: `Benefício Fictício História ${suffix}` },
    });
    const cases = [
      {
        type: "User",
        id: owner.id,
        load: (cursor?: string) =>
          USER(request(`/api/users/${owner.id}`, directionToken, cursor), {
            params: Promise.resolve({ id: owner.id }),
          }),
      },
      {
        type: "Unit",
        id: unit.id,
        load: (cursor?: string) =>
          REFERENCE(request(`/api/references/units/${unit.id}`, directionToken, cursor), {
            params: Promise.resolve({ kind: "units", id: unit.id }),
          }),
      },
      {
        type: "ProfessionalCategory",
        id: category.id,
        load: (cursor?: string) =>
          REFERENCE(request(`/api/references/categories/${category.id}`, directionToken, cursor), {
            params: Promise.resolve({ kind: "categories", id: category.id }),
          }),
      },
      {
        type: "Benefit",
        id: benefit.id,
        load: (cursor?: string) =>
          CATALOG(request(`/api/catalog/benefits/${benefit.id}`, directionToken, cursor), {
            params: Promise.resolve({ kind: "benefits", id: benefit.id }),
          }),
      },
      {
        type: "AttendanceType",
        id: "GUIDANCE",
        load: (cursor?: string) =>
          CATALOG(request("/api/catalog/types/GUIDANCE", directionToken, cursor), {
            params: Promise.resolve({ kind: "types", id: "GUIDANCE" }),
          }),
      },
    ];
    for (const item of cases) {
      const expected = await fixtureHistory(item.type, item.id, 105);
      const first = (await (await item.load()).json()) as Page;
      expect(first.history).toHaveLength(100);
      const all = await collect(item.load);
      expect(all.pages).toBeGreaterThan(1);
      expect(expected.every((id) => all.ids.includes(id))).toBe(true);
    }
  });

  it("revalida propriedade e sessão ao continuar histórico próprio de atendimento", async () => {
    const item = await createAttendance(owner, {
      serviceDate: dateInTimezone(new Date(), "America/Sao_Paulo"),
      name: "Pessoa Fictícia Histórico",
      cpf: "00000000191",
      responsibleRole: "RF",
      phone: null,
      familyCode: null,
      kind: "GUIDANCE",
      opinion: "WITHOUT",
      crowded: false,
    });
    const ids = await fixtureHistory("Attendance", item.id, 105);
    const context = { params: Promise.resolve({ id: item.id }) };
    const load = (cursor?: string) =>
      ATTENDANCE(request(`/api/attendances/${item.id}`, ownerToken, cursor), context);
    const first = (await (await load()).json()) as Page;
    const all = await collect(load);
    expect(ids.every((id) => all.ids.includes(id))).toBe(true);
    expect(
      (
        await ATTENDANCE(
          request(`/api/attendances/${item.id}`, otherToken, first.nextHistoryCursor!),
          context,
        )
      ).status,
    ).toBe(404);
    const foreignCursor = (await auditPage(prisma, { entityType: "User", entityId: owner.id }))
      .nextHistoryCursor!;
    const scoped = (await (await load(foreignCursor)).json()) as Page;
    expect(scoped.history).toHaveLength(100);
    expect(
      (scoped.history ?? []).every((entry) => ids.includes(entry.id) || all.ids.includes(entry.id)),
    ).toBe(true);
    await prisma.user.update({ where: { id: owner.id }, data: { status: "INACTIVE" } });
    try {
      expect((await load(first.nextHistoryCursor!)).status).toBe(401);
    } finally {
      await prisma.user.update({ where: { id: owner.id }, data: { status: "ACTIVE" } });
    }
    expect(other.id).not.toBe(owner.id);
  });
});
