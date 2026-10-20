import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { safeUserSelect, type SafeUser } from "@/modules/users/types";
import { authenticate, logout } from "@/modules/auth/service";
import {
  createAttendance,
  updateAttendance,
  cancelAttendance,
  getAttendance,
  listAttendances,
  reuseAttendance,
  attendanceFilterOptions,
} from "@/modules/attendances/service";
import { dateInTimezone, type AttendanceInput } from "@/modules/attendances/contracts";
import { GET, POST } from "@/app/api/attendances/route";
import { GET as DETAIL, PATCH } from "@/app/api/attendances/[id]/route";
import { POST as CANCEL } from "@/app/api/attendances/[id]/cancel/route";
import { POST as REUSE } from "@/app/api/attendances/reuse/route";
import { GET as OPTIONS } from "@/app/api/attendances/options/route";
const suffix = randomUUID().slice(0, 8);
let direction: SafeUser, owner: SafeUser, other: SafeUser, referral: SafeUser;
let seq = 1000;
function cpf() {
  let digits = String(++seq).padStart(9, "0");
  for (const size of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < size; i++) sum += Number(digits[i]) * (size + 1 - i);
    digits += String(((sum * 10) % 11) % 10);
  }
  return digits;
}
const input = (): AttendanceInput => ({
  serviceDate: dateInTimezone(new Date(), "America/Sao_Paulo"),
  name: `Pessoa Fictícia F3 ${suffix}`,
  cpf: cpf(),
  responsibleRole: "RF",
  familyCode: "12345678901",
  phone: null,
  kind: "UPDATE_FAMILY",
  opinion: "PENDING",
  crowded: false,
});
const req = (path: string, method = "GET", body?: unknown, token?: string) =>
  new Request(`http://127.0.0.1:3000${path}`, {
    method,
    headers: {
      origin: "http://127.0.0.1:3000",
      "content-type": "application/json",
      ...(token ? { cookie: `cadflux_session=${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
beforeAll(async () => {
  direction = await prisma.user.findUniqueOrThrow({
    where: { email: "direcao@cadflux.local" },
    select: safeUserSelect,
  });
  referral = await prisma.user.findUniqueOrThrow({
    where: { email: "encaminhador@cadflux.local" },
    select: safeUserSelect,
  });
  const seed = await prisma.user.findUniqueOrThrow({
    where: { email: "entrevistador@cadflux.local" },
  });
  for (const n of ["owner", "other"]) {
    const user = await prisma.user.create({
      data: {
        name: `Entrevistador Fictício ${n} ${suffix}`,
        email: `f3-${n}-${suffix}@exemplo.invalid`,
        registrationNumber: `F3-${n}-${suffix}`,
        passwordHash: seed.passwordHash,
        accessProfile: "INTERVIEWER",
        professionalCategoryId: seed.professionalCategoryId,
        primaryUnitId: seed.primaryUnitId,
        mustChangePassword: false,
      },
      select: safeUserSelect,
    });
    if (n === "owner") owner = user;
    else other = user;
  }
});
afterAll(() => prisma.$disconnect());
describe("Atendimentos com PostgreSQL real", () => {
  it("nega sessão ausente, Encaminhador e criação pela Direção em todas as APIs", async () => {
    expect((await GET(req("/api/attendances"))).status).toBe(401);
    const auth = await authenticate({ email: referral.email, password: "CadFlux!Demo2026" });
    const context = { params: Promise.resolve({ id: "missing" }) };
    const responses = await Promise.all([
      GET(req("/api/attendances", "GET", undefined, auth.token)),
      POST(req("/api/attendances", "POST", input(), auth.token)),
      DETAIL(req("/api/attendances/missing", "GET", undefined, auth.token), context),
      PATCH(req("/api/attendances/missing", "PATCH", {}, auth.token), context),
      CANCEL(req("/api/attendances/missing/cancel", "POST", {}, auth.token), context),
      REUSE(req("/api/attendances/reuse", "POST", { cpf: cpf() }, auth.token)),
      OPTIONS(req("/api/attendances/options", "GET", undefined, auth.token)),
    ]);
    expect(responses.map((r) => r.status)).toEqual(Array(7).fill(403));
    await expect(createAttendance(direction, input())).rejects.toMatchObject({ status: 403 });
    await logout(auth.token);
  });
  it("atribui operador/unidade no servidor e grava identificação e auditoria", async () => {
    const data = input();
    const item = await createAttendance(owner, data);
    expect(item).toMatchObject({
      ownerUserId: owner.id,
      unitId: owner.primaryUnitId,
      operatorName: owner.name,
      operatorRegistration: owner.registrationNumber,
      operatorCategory: owner.professionalCategory.name,
      version: 1,
    });
    expect((await getAttendance(owner, item.id)).history[0]).toMatchObject({
      action: "ATTENDANCE_CREATED",
      actorUser: { name: owner.name },
    });
    await expect(
      createAttendance(owner, { ...input(), ownerUserId: other.id }),
    ).rejects.toBeDefined();
    await expect(createAttendance(owner, { ...input(), unitId: "forged" })).rejects.toBeDefined();
  });
  it("isola lista, detalhe, alterações, cancelamento, CPF anterior e filtros administrativos", async () => {
    const data = input();
    const item = await createAttendance(owner, data);
    expect((await listAttendances(other, { q: data.cpf })).total).toBe(0);
    expect(await reuseAttendance(other, data.cpf)).toBeNull();
    await expect(getAttendance(other, item.id)).rejects.toMatchObject({ status: 404 });
    await expect(updateAttendance(other, item.id, { ...data, version: 1 })).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      cancelAttendance(other, item.id, { version: 1, reason: "Registro incorreto" }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(listAttendances(other, { ownerUserId: owner.id })).rejects.toMatchObject({
      status: 403,
    });
    await expect(listAttendances(other, { unitId: owner.primaryUnitId })).rejects.toMatchObject({
      status: 403,
    });
    await expect(attendanceFilterOptions(other)).rejects.toMatchObject({ status: 403 });
    expect(
      (
        await listAttendances(direction, {
          q: data.cpf,
          ownerUserId: owner.id,
          unitId: owner.primaryUnitId,
        })
      ).total,
    ).toBe(1);
    const auth = await authenticate({ email: other.email, password: "CadFlux!Demo2026" });
    expect(
      (
        await DETAIL(req(`/api/attendances/${item.id}`, "GET", undefined, auth.token), {
          params: Promise.resolve({ id: item.id }),
        })
      ).status,
    ).toBe(404);
    await logout(auth.token);
  });
  it("orientação sem código, inclusão sem parecer e validações atômicas", async () => {
    const guidance = await createAttendance(owner, {
      ...input(),
      kind: "GUIDANCE",
      familyCode: null,
      opinion: "WITHOUT",
    });
    expect(guidance.familyCode).toBeNull();
    for (const kind of ["INCLUDE_FAMILY", "INCLUDE_SINGLE_BF", "INCLUDE_SINGLE_BPC"] as const) {
      await expect(
        createAttendance(owner, { ...input(), kind, opinion: "WITH" }),
      ).rejects.toBeDefined();
      expect(
        (await createAttendance(owner, { ...input(), kind, opinion: "WITHOUT" })).opinion,
      ).toBe("WITHOUT");
    }
    const before = await prisma.attendance.count();
    for (const change of [
      { cpf: "11111111111" },
      { familyCode: null },
      { phone: "22" },
      { serviceDate: "2099-01-01" },
      { kind: "GUIDANCE", opinion: "WITHOUT" },
    ])
      await expect(createAttendance(owner, { ...input(), ...change })).rejects.toBeDefined();
    expect(await prisma.attendance.count()).toBe(before);
  });
  it("classificação pós-atendimento é definitiva; banco protege parecer e RF/RL", async () => {
    const data = input();
    const item = await createAttendance(owner, data);
    const classified = await updateAttendance(owner, item.id, {
      ...data,
      opinion: "WITH",
      version: 1,
    });
    expect(classified.version).toBe(2);
    await expect(
      updateAttendance(owner, item.id, { ...data, opinion: "WITHOUT", version: 2 }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      updateAttendance(direction, item.id, { ...data, opinion: "WITHOUT", version: 2 }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      updateAttendance(owner, item.id, { ...data, opinion: "WITH", cpf: cpf(), version: 2 }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      updateAttendance(owner, item.id, {
        ...data,
        opinion: "WITH",
        responsibleRole: "RL",
        version: 2,
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      prisma.$executeRaw`UPDATE "Attendance" SET "opinion"='WITHOUT', version=3 WHERE id=${item.id}`,
    ).rejects.toBeDefined();
    await expect(
      prisma.$executeRaw`UPDATE "Attendance" SET "responsibleRole"='RL', version=3 WHERE id=${item.id}`,
    ).rejects.toBeDefined();
    await expect(
      prisma.$executeRaw`UPDATE "Attendance" SET cpf=${cpf()}, version=3 WHERE id=${item.id}`,
    ).rejects.toBeDefined();
    const corrected = await updateAttendance(direction, item.id, {
      ...data,
      name: "Nome Fictício Corrigido",
      opinion: "WITH",
      version: 2,
    });
    expect(corrected.name).toBe("Nome Fictício Corrigido");
    const history = (await getAttendance(owner, item.id)).history;
    expect(history).toHaveLength(3);
    expect(history.some((h) => h.actorUser?.name === direction.name)).toBe(true);
  });
  it("duplicidade exige confirmação e não revela registros de colegas", async () => {
    const data = input();
    await createAttendance(owner, data);
    await expect(createAttendance(owner, data)).rejects.toMatchObject({ status: 409 });
    await createAttendance(owner, { ...data, duplicateAcknowledged: true });
    expect((await listAttendances(owner, { q: data.cpf })).total).toBe(2);
    expect(
      (await getAttendance(owner, (await listAttendances(owner, { q: data.cpf })).items[0].id))
        .history[0].metadata,
    ).toMatchObject({ duplicateAcknowledged: true });
    const separate = await createAttendance(other, data);
    expect(separate.ownerUserId).toBe(other.id);
    const first = (await listAttendances(owner, { q: data.cpf })).items[0];
    await expect(updateAttendance(owner, first.id, { ...data, version: 1 })).rejects.toMatchObject({
      status: 409,
    });
  });
  it("CPF anterior reutiliza somente dados do próprio operador sem gravar", async () => {
    const data = input();
    await createAttendance(owner, { ...data, phone: "22999990000" });
    const before = await prisma.attendance.count();
    expect(await reuseAttendance(owner, data.cpf)).toMatchObject({
      name: data.name,
      cpf: data.cpf,
      phone: "22999990000",
    });
    expect(await prisma.attendance.count()).toBe(before);
    await expect(reuseAttendance(referral, data.cpf)).rejects.toMatchObject({ status: 403 });
  });
  it("cancelamento definitivo exige motivo e mantém auditoria imutável", async () => {
    const data = input();
    const item = await createAttendance(owner, data);
    await expect(
      cancelAttendance(owner, item.id, { version: 1, reason: "" }),
    ).rejects.toBeDefined();
    const cancelled = await cancelAttendance(owner, item.id, {
      version: 1,
      reason: "Lançamento fictício incorreto",
    });
    expect(cancelled.cancelledAt).not.toBeNull();
    expect((await listAttendances(owner, { q: data.cpf })).total).toBe(0);
    expect((await listAttendances(owner, { q: data.cpf, status: "cancelled" })).total).toBe(1);
    expect(await reuseAttendance(owner, data.cpf)).toBeNull();
    await expect(
      updateAttendance(direction, item.id, { ...data, version: 2 }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      cancelAttendance(direction, item.id, { version: 2, reason: "Nova tentativa" }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      prisma.$executeRaw`DELETE FROM "Attendance" WHERE id=${item.id}`,
    ).rejects.toBeDefined();
    await expect(
      prisma.$executeRaw`UPDATE "Attendance" SET "cancelledAt"=NULL,"cancellationReason"=NULL,version=3 WHERE id=${item.id}`,
    ).rejects.toBeDefined();
    const history = (await getAttendance(owner, item.id)).history;
    expect(history).toHaveLength(2);
    await expect(
      prisma.auditLog.update({ where: { id: history[0].id }, data: { action: "FORGED" } }),
    ).rejects.toBeDefined();
  });
  it("semana antiga permite consulta; somente Direção corrige ou cancela", async () => {
    const data = input();
    const template = await createAttendance(owner, data);
    const oldDate = new Date(template.serviceDate);
    oldDate.setUTCDate(oldDate.getUTCDate() - 8);
    const fields = { ...template };
    for (const key of ["id", "createdAt", "updatedAt"]) Reflect.deleteProperty(fields, key);
    const historical = await prisma.attendance.create({
      data: { ...fields, serviceDate: oldDate },
    });
    const update = {
      ...data,
      serviceDate: oldDate.toISOString().slice(0, 10),
      phone: "22999991111",
      version: 1,
    };
    expect((await getAttendance(owner, historical.id)).editable).toBe(false);
    await expect(
      createAttendance(owner, { ...data, cpf: cpf(), serviceDate: update.serviceDate }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(updateAttendance(owner, historical.id, update)).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      cancelAttendance(owner, historical.id, { version: 1, reason: "Motivo fictício" }),
    ).rejects.toMatchObject({ status: 403 });
    const corrected = await updateAttendance(direction, historical.id, update);
    expect(corrected.phone).toBe("22999991111");
    expect(
      (
        await cancelAttendance(direction, historical.id, {
          version: 2,
          reason: "Correção administrativa",
        })
      ).cancelledAt,
    ).not.toBeNull();
  });
  it("controle de versão recusa perda de alterações e registra apenas a vencedora", async () => {
    const data = input();
    const item = await createAttendance(owner, data);
    const attempts = await Promise.allSettled([
      updateAttendance(owner, item.id, { ...data, name: "Versão Fictícia A", version: 1 }),
      updateAttendance(direction, item.id, { ...data, name: "Versão Fictícia B", version: 1 }),
    ]);
    expect(attempts.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await getAttendance(owner, item.id)).history).toHaveLength(2);
    await expect(updateAttendance(owner, item.id, { ...data, version: 1 })).rejects.toMatchObject({
      status: 409,
    });
  });
  it("duas inclusões concorrentes sem confirmação não geram duplicidade silenciosa", async () => {
    const data = input();
    const attempts = await Promise.allSettled([
      createAttendance(owner, data),
      createAttendance(owner, data),
    ]);
    expect(attempts.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await listAttendances(owner, { q: data.cpf })).total).toBe(1);
  });
  it("paginação, filtros e acesso global da Direção não perdem registros", async () => {
    const data = input();
    const template = await createAttendance(owner, { ...data, name: `Paginação F3 ${suffix}` });
    const fields = { ...template };
    for (const key of ["id", "createdAt", "updatedAt"]) Reflect.deleteProperty(fields, key);
    await prisma.attendance.createMany({
      data: Array.from({ length: 50 }, (_, i) => ({
        ...fields,
        name: `Paginação F3 ${suffix} ${i}`,
        cpf: cpf(),
      })),
    });
    const page = await listAttendances(owner, {
      q: `Paginação F3 ${suffix}`,
      page: 2,
      from: data.serviceDate,
      to: data.serviceDate,
      opinion: "PENDING",
      kind: "UPDATE_FAMILY",
    });
    expect(page.total).toBe(51);
    expect(page.items).toHaveLength(1);
    expect(
      (await attendanceFilterOptions(direction)).operators.some((o) => o.id === owner.id),
    ).toBe(true);
  });
  it("revalida ator atual, revogação de privilégios e unidade ativa", async () => {
    await expect(
      createAttendance({ ...referral, accessProfile: "INTERVIEWER" }, input()),
    ).rejects.toMatchObject({ status: 403 });
    await prisma.user.update({ where: { id: other.id }, data: { status: "INACTIVE" } });
    await expect(createAttendance(other, input())).rejects.toMatchObject({ status: 403 });
    await prisma.user.update({
      where: { id: other.id },
      data: { status: "ACTIVE", mustChangePassword: true },
    });
    await expect(createAttendance(other, input())).rejects.toMatchObject({ status: 428 });
    await prisma.user.update({ where: { id: other.id }, data: { mustChangePassword: false } });
    const inactive = await prisma.unit.create({
      data: { name: `Inativa Fictícia ${suffix}`, code: `F3-INACTIVE-${suffix}`, active: false },
    });
    await prisma.user.update({ where: { id: other.id }, data: { primaryUnitId: inactive.id } });
    await expect(createAttendance(other, input())).rejects.toMatchObject({ status: 409 });
    await prisma.user.update({
      where: { id: other.id },
      data: { primaryUnitId: owner.primaryUnitId },
    });
  });
  it("histórico mantém operador/unidade originais após transferência do usuário", async () => {
    const data = input();
    const item = await createAttendance(owner, data);
    const unit = await prisma.unit.create({
      data: { name: `Destino Fictício ${suffix}`, code: `F3-DEST-${suffix}` },
    });
    await prisma.user.update({
      where: { id: owner.id },
      data: { primaryUnitId: unit.id, name: "Nome Fictício Atualizado" },
    });
    try {
      const old = await getAttendance(owner, item.id);
      expect(old.item.operatorName).toBe(owner.name);
      expect(old.item.unitId).toBe(owner.primaryUnitId);
      expect((await listAttendances(owner, { q: data.cpf })).total).toBe(1);
    } finally {
      await prisma.user.update({
        where: { id: owner.id },
        data: { primaryUnitId: owner.primaryUnitId, name: owner.name },
      });
    }
  });
  it("recusa origem externa, JSON inválido e corpo excessivo sem gravar", async () => {
    const auth = await authenticate({ email: owner.email, password: "CadFlux!Demo2026" });
    const headers = {
      origin: "http://127.0.0.1:3000",
      cookie: `cadflux_session=${auth.token}`,
      "content-type": "application/json",
    };
    expect(
      (
        await POST(
          new Request("http://127.0.0.1:3000/api/attendances", {
            method: "POST",
            headers: { ...headers, origin: "https://outside.invalid" },
            body: JSON.stringify(input()),
          }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await POST(
          new Request("http://127.0.0.1:3000/api/attendances", {
            method: "POST",
            headers,
            body: "invalid",
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await POST(
          new Request("http://127.0.0.1:3000/api/attendances", {
            method: "POST",
            headers,
            body: JSON.stringify({ name: "x".repeat(17000) }),
          }),
        )
      ).status,
    ).toBe(413);
    await logout(auth.token);
  });
});
