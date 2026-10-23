import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { safeUserSelect, type SafeUser } from "@/modules/users/types";
import {
  createAttendance,
  updateAttendance,
  cancelAttendance,
  getAttendance,
} from "@/modules/attendances/service";
import { dateInTimezone, type AttendanceInput } from "@/modules/attendances/contracts";
import { attendanceConfiguration, setOperationalUnit } from "@/modules/operations/service";
import { indicators, indicatorPeriods } from "@/modules/indicators/service";
import { saveCatalog, listCatalog, catalogHistory } from "@/modules/catalog/service";
import { authenticate, logout } from "@/modules/auth/service";
import { GET as METRICS } from "@/app/api/indicators/route";
import { GET as OPTIONS, PATCH as UNIT } from "@/app/api/operations/route";
import { GET as CATALOG, POST as CREATE } from "@/app/api/catalog/[kind]/route";
let direction: SafeUser, referral: SafeUser;
const suffix = randomUUID().slice(0, 8);
let sequence = 50000;
function cpf() {
  let s = String(++sequence).padStart(9, "0");
  for (const size of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < size; i++) sum += Number(s[i]) * (size + 1 - i);
    s += String(((sum * 10) % 11) % 10);
  }
  return s;
}
function input(): AttendanceInput {
  return {
    serviceDate: dateInTimezone(new Date(), "America/Sao_Paulo"),
    name: "Pessoa Fictícia F4",
    cpf: cpf(),
    responsibleRole: "RF",
    familyCode: "123456",
    phone: null,
    kind: "UPDATE_FAMILY",
    opinion: "PENDING",
    crowded: false,
  };
}
async function owner() {
  const seed = await prisma.user.findUniqueOrThrow({
    where: { email: "entrevistador@cadflux.local" },
  });
  const id = randomUUID();
  return prisma.user.create({
    data: {
      name: "Operador Fictício " + id,
      email: `${id}@exemplo.invalid`,
      registrationNumber: id,
      passwordHash: seed.passwordHash,
      accessProfile: "INTERVIEWER",
      professionalCategoryId: seed.professionalCategoryId,
      primaryUnitId: seed.primaryUnitId,
      mustChangePassword: false,
    },
    select: safeUserSelect,
  });
}
beforeAll(async () => {
  direction = await prisma.user.findUniqueOrThrow({
    where: { email: "direcao@cadflux.local" },
    select: safeUserSelect,
  });
  referral = await prisma.user.findUniqueOrThrow({
    where: { email: "encaminhador@cadflux.local" },
    select: safeUserSelect,
  });
});
afterAll(() => prisma.$disconnect());

describe("Fase 4 — indicadores, configuração e isolamento", () => {
  it("reconcilia 8 ativos, 3 orientações, pareceres e 2 cancelados sem multiplicar benefícios", async () => {
    const actor = await owner();
    const b1 = await saveCatalog(direction, "benefits", {
      name: `Benefício A ${suffix}`,
      active: true,
    });
    const b2 = await saveCatalog(direction, "benefits", {
      name: `Benefício B ${suffix}`,
      active: true,
    });
    const benefits = ["id" in b1 ? b1.id : "", "id" in b2 ? b2.id : ""];
    const common = input();
    const first = await createAttendance(actor, {
      ...common,
      kind: "GUIDANCE",
      familyCode: null,
      opinion: "WITHOUT",
      benefitIds: benefits,
    });
    const second = await createAttendance(actor, {
      ...common,
      kind: "GUIDANCE",
      familyCode: null,
      opinion: "WITHOUT",
      duplicateAcknowledged: true,
    });
    await createAttendance(actor, {
      ...input(),
      kind: "GUIDANCE",
      familyCode: null,
      opinion: "WITHOUT",
    });
    for (let i = 0; i < 2; i++) await createAttendance(actor, { ...input(), opinion: "WITH" });
    for (let i = 0; i < 2; i++)
      await createAttendance(actor, { ...input(), kind: "INCLUDE_FAMILY", opinion: "WITHOUT" });
    await createAttendance(actor, input());
    for (let i = 0; i < 2; i++) {
      const a = await createAttendance(actor, input());
      await cancelAttendance(actor, a.id, { version: 1, reason: "Registro fictício duplicado" });
    }
    const report = await indicators(actor, {});
    expect(report.range).toEqual({
      total: 8,
      guidance: 3,
      withOpinion: 2,
      withoutOpinion: 5,
      pending: 1,
      cancelled: 2,
    });
    expect(report.duplicates).toEqual({ groups: 1, records: 2 });
    expect(report.duplicateItems.map((a) => a.id).sort()).toEqual([first.id, second.id].sort());
    expect(report.recent).toHaveLength(8);
    expect(report.breakdown).toEqual([]);
    expect(report.monthly[0].total).toBe(8);
    const global = await indicators(direction, { ownerUserId: actor.id });
    expect(global.range).toEqual(report.range);
    expect(global.breakdownTotal).toBe(1);
    await cancelAttendance(actor, second.id, {
      version: 1,
      reason: "Cancelamento de demonstração",
    });
    expect((await indicators(actor, {})).duplicates).toEqual({ groups: 0, records: 0 });
  });
  it("nega filtros e dados alheios; permite apenas total agregado da unidade", async () => {
    const a = await owner(),
      b = await owner();
    const x = await createAttendance(b, input());
    await createAttendance(a, input());
    const report = await indicators(a, {});
    expect(report.range.total).toBe(1);
    expect(report.recent.some((i) => i.id === x.id)).toBe(false);
    expect(report.unitTotal!.total).toBeGreaterThanOrEqual(2);
    for (const filter of [{ ownerUserId: b.id }, { unitId: b.primaryUnitId }])
      await expect(indicators(a, filter)).rejects.toMatchObject({ status: 403 });
    await expect(indicators(referral, {})).rejects.toMatchObject({ status: 403 });
    await expect(indicators({ ...referral, accessProfile: "DIRECTION" }, {})).rejects.toMatchObject(
      { status: 403 },
    );
    await expect(listCatalog(a, "benefits", {})).rejects.toMatchObject({ status: 403 });
    await expect(
      saveCatalog(a, "benefits", { name: "Não autorizado", active: true }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(getAttendance(a, x.id)).rejects.toMatchObject({ status: 404 });
  });
  it("agrupa pela data civil através do mês/ano e respeita os dois limites do intervalo", async () => {
    const actor = await owner();
    const template = await createAttendance(actor, input());
    const { id, createdAt, updatedAt, ...fields } = template;
    void id;
    void createdAt;
    void updatedAt;
    for (const day of [
      "2025-12-28",
      "2025-12-29",
      "2025-12-31",
      "2026-01-01",
      "2026-01-04",
      "2026-01-05",
    ])
      await prisma.attendance.create({
        data: { ...fields, cpf: cpf(), serviceDate: new Date(day + "T00:00:00Z") },
      });
    const result = await indicators(
      actor,
      { from: "2025-12-29", to: "2026-01-04" },
      new Date("2026-01-01T03:00:00Z"),
    );
    expect(result.range.total).toBe(4);
    expect(result.week.total).toBe(4);
    expect(result.today.total).toBe(1);
    expect(result.month.total).toBe(3);
    expect(result.monthly.map((m) => [m.month, m.total])).toEqual([
      ["2025-12", 2],
      ["2026-01", 2],
    ]);
    expect(result.recent.map((a) => a.serviceDate.toISOString().slice(0, 10))).toEqual([
      "2026-01-04",
      "2026-01-01",
      "2025-12-31",
      "2025-12-29",
    ]);
    await expect(indicators(actor, { from: "2026-01-02", to: "2026-01-01" })).rejects.toMatchObject(
      { status: 400 },
    );
  });
  it("duplicidade é por dono e recalculada no filtro de unidade; não soma grupos entre unidades", async () => {
    const actor = await owner(),
      other = await owner();
    const unit = await prisma.unit.create({
      data: { name: "Duplicidade F4 " + randomUUID(), code: randomUUID() },
    });
    await prisma.userUnitAccess.create({ data: { userId: actor.id, unitId: unit.id } });
    const data = input();
    await createAttendance(actor, data);
    await createAttendance(actor, { ...data, unitId: unit.id, duplicateAcknowledged: true });
    await createAttendance(other, data);
    expect((await indicators(direction, { ownerUserId: actor.id })).duplicates).toEqual({
      groups: 1,
      records: 2,
    });
    expect(
      (await indicators(direction, { ownerUserId: actor.id, unitId: unit.id })).duplicates,
    ).toEqual({ groups: 0, records: 0 });
    expect((await indicators(other, {})).duplicates).toEqual({ groups: 0, records: 0 });
  });
  it("benefício preserva nome histórico, mantém inativo antigo e recusa atribuição nova", async () => {
    const actor = await owner();
    const b = await saveCatalog(direction, "benefits", {
      name: `Histórico ${suffix}`,
      active: true,
    });
    if (!("id" in b)) throw Error("Benefit esperado");
    const data = input();
    const item = await createAttendance(actor, { ...data, benefitIds: [b.id] });
    await saveCatalog(
      direction,
      "benefits",
      { name: `Renomeado ${suffix}`, active: false, version: b.version },
      b.id,
    );
    expect((await getAttendance(actor, item.id)).item.benefits[0].name).toBe(b.name);
    await updateAttendance(actor, item.id, {
      ...data,
      phone: "22999990000",
      benefitIds: [b.id],
      version: 1,
    });
    expect((await getAttendance(actor, item.id)).item.benefits[0].name).toBe(b.name);
    await expect(createAttendance(actor, { ...input(), benefitIds: [b.id] })).rejects.toMatchObject(
      { status: 409 },
    );
    await updateAttendance(actor, item.id, { ...data, benefitIds: [], version: 2 });
    expect((await getAttendance(actor, item.id)).item.benefits).toEqual([]);
    await expect(
      updateAttendance(actor, item.id, { ...data, benefitIds: [b.id], version: 3 }),
    ).rejects.toMatchObject({ status: 409 });
    expect((await catalogHistory(direction, "benefits", b.id)).history).toHaveLength(2);
    await expect(prisma.benefit.delete({ where: { id: b.id } })).rejects.toBeDefined();
  });
  it("benefícios duplicados, IDs desconhecidos e alterações concorrentes são recusados", async () => {
    const actor = await owner();
    const b = await saveCatalog(direction, "benefits", {
      name: `Concorrente ${suffix}`,
      active: true,
    });
    if (!("id" in b)) throw Error("Benefit esperado");
    await expect(
      createAttendance(actor, { ...input(), benefitIds: [b.id, b.id] }),
    ).rejects.toBeDefined();
    await expect(
      createAttendance(actor, { ...input(), benefitIds: ["missing"] }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      saveCatalog(direction, "benefits", { name: b.name.toUpperCase(), active: true }),
    ).rejects.toMatchObject({ status: 409 });
    const results = await Promise.allSettled([
      saveCatalog(direction, "benefits", { name: b.name + " A", active: true, version: 1 }, b.id),
      saveCatalog(direction, "benefits", { name: b.name + " B", active: true, version: 1 }, b.id),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await catalogHistory(direction, "benefits", b.id)).history).toHaveLength(2);
  });
  it("renomear/inativar tipo preserva código, regras, histórico e pelo menos um ativo", async () => {
    const actor = await owner();
    const before = await prisma.attendanceType.findMany();
    try {
      const data = {
        ...input(),
        kind: "GUIDANCE" as const,
        opinion: "WITHOUT" as const,
        familyCode: null,
      };
      const old = await createAttendance(actor, data);
      const original = before.find((t) => t.code === "GUIDANCE")!;
      await saveCatalog(
        direction,
        "types",
        { name: "Orientação Fictícia Renomeada", active: true, version: original.version },
        "GUIDANCE",
      );
      const fresh = await createAttendance(actor, { ...data, cpf: cpf() });
      expect(old.kindName).toBe(original.name);
      expect(fresh.kindName).toBe("Orientação Fictícia Renomeada");
      await expect(
        createAttendance(actor, { ...data, cpf: cpf(), familyCode: "123" }),
      ).rejects.toBeDefined();
      await saveCatalog(
        direction,
        "types",
        { name: "Orientação Fictícia Renomeada", active: false, version: original.version + 1 },
        "GUIDANCE",
      );
      await updateAttendance(actor, old.id, { ...data, phone: "22999991111", version: 1 });
      expect((await getAttendance(actor, old.id)).item.kindName).toBe(original.name);
      await expect(createAttendance(actor, { ...data, cpf: cpf() })).rejects.toMatchObject({
        status: 409,
      });
      for (const t of before.filter((t) => t.code !== "GUIDANCE" && t.code !== "UPDATE_FAMILY"))
        await saveCatalog(
          direction,
          "types",
          { name: t.name, active: false, version: t.version },
          t.code,
        );
      const last = before.find((t) => t.code === "UPDATE_FAMILY")!;
      await expect(
        saveCatalog(
          direction,
          "types",
          { name: last.name, active: false, version: last.version },
          last.code,
        ),
      ).rejects.toMatchObject({ status: 409 });
      await expect(
        saveCatalog(direction, "types", { name: "Novo código", active: true }),
      ).rejects.toMatchObject({ status: 400 });
    } finally {
      for (const old of before) {
        const current = await prisma.attendanceType.findUniqueOrThrow({
          where: { code: old.code },
        });
        if (current.name !== old.name || current.active !== old.active)
          await saveCatalog(
            direction,
            "types",
            { name: old.name, active: old.active, version: current.version },
            old.code,
          );
      }
    }
  });
  it("unidade selecionada persiste; outra aba não muda unidade enviada e revogação impede gravar", async () => {
    const actor = await owner();
    const unit = await prisma.unit.create({
      data: { name: "Adicional F4 " + randomUUID(), code: randomUUID() },
    });
    await expect(setOperationalUnit(actor, { unitId: unit.id })).rejects.toMatchObject({
      status: 409,
    });
    await prisma.userUnitAccess.create({ data: { userId: actor.id, unitId: unit.id } });
    await setOperationalUnit(actor, { unitId: unit.id });
    expect((await attendanceConfiguration(actor)).selected?.id).toBe(unit.id);
    const login = await authenticate({ email: actor.email, password: "CadFlux!Demo2026" });
    await logout(login.token);
    expect((await attendanceConfiguration(actor)).selected?.id).toBe(unit.id);
    await expect(createAttendance(actor, input())).rejects.toMatchObject({ status: 409 });
    await setOperationalUnit(actor, { unitId: actor.primaryUnitId });
    const a = await createAttendance(actor, { ...input(), unitId: unit.id });
    expect(a.unitId).toBe(unit.id);
    await setOperationalUnit(actor, { unitId: unit.id });
    await prisma.userUnitAccess.delete({
      where: { userId_unitId: { userId: actor.id, unitId: unit.id } },
    });
    expect((await attendanceConfiguration(actor)).selected?.id).toBe(actor.primaryUnitId);
    expect((await attendanceConfiguration(actor)).notice).not.toBe("");
    await expect(createAttendance(actor, { ...input(), unitId: unit.id })).rejects.toMatchObject({
      status: 409,
    });
    expect((await getAttendance(actor, a.id)).item.unitId).toBe(unit.id);
    expect((await indicators(actor, {})).range.total).toBe(1);
    await prisma.user.update({ where: { id: actor.id }, data: { primaryUnitId: unit.id } });
    expect((await attendanceConfiguration(actor)).selected?.id).toBe(unit.id);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: actor.id } })).operationalUnitId,
    ).toBeNull();
    await prisma.unit.update({ where: { id: unit.id }, data: { active: false } });
    expect((await attendanceConfiguration(actor)).selected).toBeNull();
    await expect(createAttendance(actor, input())).rejects.toMatchObject({ status: 409 });
  });
  it("paginação do consolidado não corta o total, incluindo unidades inativas históricas", async () => {
    const actor = await owner();
    const a = await createAttendance(actor, input());
    const { id: _id, createdAt: _created, updatedAt: _updated, ...fields } = a;
    void _id;
    void _created;
    void _updated;
    for (let i = 0; i < 50; i++) {
      const unit = await prisma.unit.create({
        data: { name: `Histórica F4 ${suffix} ${i}`, code: randomUUID(), active: false },
      });
      await prisma.attendance.create({
        data: { ...fields, cpf: cpf(), unitId: unit.id, unitName: unit.name, unitCode: unit.code },
      });
    }
    const report = await indicators(direction, { ownerUserId: actor.id, page: 2 });
    expect(report.range.total).toBe(51);
    expect(report.breakdownTotal).toBe(51);
    expect(report.breakdown).toHaveLength(1);
  });
  it("rotas novas negam anônimo e Encaminhador e recusam origem externa", async () => {
    const request = (
      path: string,
      token?: string,
      method = "GET",
      body?: unknown,
      origin = "http://127.0.0.1:3000",
    ) =>
      new Request("http://127.0.0.1:3000" + path, {
        method,
        headers: {
          origin,
          "content-type": "application/json",
          ...(token ? { cookie: `cadflux_session=${token}` } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    expect((await METRICS(request("/api/indicators"))).status).toBe(401);
    const login = await authenticate({ email: referral.email, password: "CadFlux!Demo2026" });
    expect((await METRICS(request("/api/indicators", login.token))).status).toBe(403);
    expect((await OPTIONS(request("/api/operations", login.token))).status).toBe(403);
    expect(
      (
        await UNIT(
          request("/api/operations", login.token, "PATCH", { unitId: referral.primaryUnitId }),
        )
      ).status,
    ).toBe(403);
    const ctx = { params: Promise.resolve({ kind: "benefits" }) };
    expect((await CATALOG(request("/api/catalog/benefits", login.token), ctx)).status).toBe(403);
    expect(
      (
        await CREATE(
          request("/api/catalog/benefits", login.token, "POST", { name: "Teste", active: true }),
          ctx,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await UNIT(
          request(
            "/api/operations",
            login.token,
            "PATCH",
            { unitId: referral.primaryUnitId },
            "https://outside.invalid",
          ),
        )
      ).status,
    ).toBe(403);
    await logout(login.token);
  });
});
describe("Calendário institucional dos indicadores", () => {
  it("meia-noite UTC não antecipa dia, semana ou ano em São Paulo", () => {
    expect(indicatorPeriods(new Date("2026-10-19T02:59:59Z"))).toMatchObject({
      today: "2026-10-18",
      week: { from: "2026-10-12", to: "2026-10-18" },
    });
    expect(indicatorPeriods(new Date("2026-10-19T03:00:00Z"))).toMatchObject({
      today: "2026-10-19",
      week: { from: "2026-10-19", to: "2026-10-25" },
    });
    expect(indicatorPeriods(new Date("2027-01-01T02:59:59Z"))).toMatchObject({
      today: "2026-12-31",
      month: { from: "2026-12-01", to: "2026-12-31" },
    });
    expect(indicatorPeriods(new Date("2028-02-29T12:00:00Z"))).toMatchObject({
      month: { from: "2028-02-01", to: "2028-02-29" },
    });
  });
});
