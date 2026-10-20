import { Prisma } from "@prisma/client";
import type { Attendance as AttendanceRecord } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { writeAudit } from "@/modules/audit/service";
import { safeUserSelect, type SafeUser } from "@/modules/users/types";
import { assertPermission, type Action } from "@/modules/permissions/service";
import { dateInTimezone, weekStart } from "./contracts";
import {
  attendanceFiltersSchema,
  cancelAttendanceSchema,
  cpfSchema,
  createAttendanceSchema,
  updateAttendanceSchema,
} from "./schema";

async function currentActor(
  tx: Prisma.TransactionClient,
  actor: SafeUser,
  action: Action,
  lock = false,
) {
  // Same lock as user/reference administration, preventing assignment/role changes mid-write.
  if (lock) await tx.$executeRaw`SELECT pg_advisory_xact_lock(194118, 1)`;
  const current = await tx.user.findUnique({ where: { id: actor.id }, select: safeUserSelect });
  if (!current) throw new AppError(401, "Entre para continuar.");
  assertPermission(current, action);
  return current;
}
function scope(actor: SafeUser): Prisma.AttendanceWhereInput {
  return actor.accessProfile === "DIRECTION" ? {} : { ownerUserId: actor.id };
}
async function findVisible(tx: Prisma.TransactionClient, actor: SafeUser, id: string) {
  const item = await tx.attendance.findFirst({ where: { id, ...scope(actor) } });
  if (!item) throw new AppError(404, "Atendimento não encontrado.");
  return item;
}
export function assertAttendanceDate(
  serviceDate: string,
  timezone: string,
  actor: Pick<SafeUser, "accessProfile">,
  now = new Date(),
) {
  const today = dateInTimezone(now, timezone);
  if (serviceDate > today) throw new AppError(400, "A data do atendimento não pode ser futura.");
  if (actor.accessProfile !== "DIRECTION" && weekStart(serviceDate) !== weekStart(today))
    throw new AppError(403, "A semana deste atendimento encerrou. Solicite a correção à Direção.");
}
function assertEditable(item: AttendanceRecord, actor: SafeUser, version: number) {
  if (item.cancelledAt)
    throw new AppError(409, "Este atendimento está cancelado e não pode ser alterado.");
  if (item.version !== version)
    throw new AppError(409, "Este atendimento foi alterado. Recarregue a página antes de salvar.");
  assertAttendanceDate(item.serviceDate.toISOString().slice(0, 10), item.timezone, actor);
}
async function checkDuplicate(
  tx: Prisma.TransactionClient,
  ownerUserId: string,
  cpf: string,
  date: Date,
  acknowledged: boolean,
  id?: string,
) {
  const other = await tx.attendance.findFirst({
    where: {
      ownerUserId,
      cpf,
      serviceDate: date,
      cancelledAt: null,
      ...(id ? { id: { not: id } } : {}),
    },
    select: { id: true },
  });
  if (other && !acknowledged)
    throw new AppError(
      409,
      "Possível duplicidade: já existe atendimento ativo deste CPF nesta data entre os registros do responsável. Confirme para continuar.",
    );
  return Boolean(other);
}
export async function listAttendances(actor: SafeUser, raw: unknown) {
  const filters = attendanceFiltersSchema.parse(raw);
  return prisma.$transaction(async (tx) => {
    const current = await currentActor(tx, actor, "attendances:read");
    if (current.accessProfile !== "DIRECTION" && (filters.ownerUserId || filters.unitId))
      throw new AppError(403, "Filtros de operador e unidade são exclusivos da Direção.");
    const digits =
      filters.q && /^[\d.\-\s]+$/.test(filters.q) ? filters.q.replace(/\D/g, "") : undefined;
    const where: Prisma.AttendanceWhereInput = {
      ...scope(current),
      ...(filters.ownerUserId ? { ownerUserId: filters.ownerUserId } : {}),
      ...(filters.unitId ? { unitId: filters.unitId } : {}),
      ...(filters.status === "all"
        ? {}
        : { cancelledAt: filters.status === "cancelled" ? { not: null } : null }),
      ...(filters.kind ? { kind: filters.kind } : {}),
      ...(filters.opinion ? { opinion: filters.opinion } : {}),
      ...(filters.from || filters.to
        ? {
            serviceDate: {
              ...(filters.from ? { gte: new Date(filters.from + "T00:00:00Z") } : {}),
              ...(filters.to ? { lte: new Date(filters.to + "T00:00:00Z") } : {}),
            },
          }
        : {}),
      ...(filters.q
        ? {
            OR: [
              { name: { contains: filters.q, mode: "insensitive" } },
              ...(digits ? [{ cpf: { contains: digits } }] : []),
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      tx.attendance.findMany({
        where,
        take: 50,
        skip: (filters.page - 1) * 50,
        orderBy: [{ serviceDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      }),
      tx.attendance.count({ where }),
    ]);
    return { items, total, page: filters.page, pageSize: 50 };
  });
}
export async function getAttendance(actor: SafeUser, id: string) {
  return prisma.$transaction(async (tx) => {
    const current = await currentActor(tx, actor, "attendances:read");
    const item = await findVisible(tx, current, id);
    // Only read history after checking ownership; never expose foreign audit values.
    const history = await tx.auditLog.findMany({
      where: { entityType: "Attendance", entityId: id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
      include: { actor: { select: { name: true } } },
    });
    const editable =
      !item.cancelledAt &&
      (current.accessProfile === "DIRECTION" ||
        weekStart(item.serviceDate.toISOString().slice(0, 10)) ===
          weekStart(dateInTimezone(new Date(), item.timezone)));
    return {
      item,
      editable,
      history: history.map(({ actor, ...entry }) => ({ ...entry, actorUser: actor })),
    };
  });
}
export async function reuseAttendance(actor: SafeUser, cpf: unknown) {
  const value = cpfSchema.parse(cpf);
  return prisma.$transaction(async (tx) => {
    const current = await currentActor(tx, actor, "attendances:create");
    return tx.attendance.findFirst({
      where: { ownerUserId: current.id, cpf: value, cancelledAt: null },
      orderBy: [{ serviceDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      select: { name: true, cpf: true, responsibleRole: true, familyCode: true, phone: true },
    });
  });
}
export async function createAttendance(actor: SafeUser, raw: unknown) {
  const input = createAttendanceSchema.parse(raw);
  const { duplicateAcknowledged, ...data } = input;
  return prisma.$transaction(
    async (tx) => {
      const current = await currentActor(tx, actor, "attendances:create", true);
      const unit = await tx.unit.findUniqueOrThrow({ where: { id: current.primaryUnitId } });
      if (!unit.active)
        throw new AppError(
          409,
          "A unidade principal está inativa. Solicite regularização à Direção.",
        );
      assertAttendanceDate(input.serviceDate, unit.timezone, current);
      const serviceDate = new Date(input.serviceDate + "T00:00:00Z");
      const duplicate = await checkDuplicate(
        tx,
        current.id,
        input.cpf,
        serviceDate,
        duplicateAcknowledged,
      );
      const item = await tx.attendance.create({
        data: {
          ...data,
          serviceDate,
          ownerUserId: current.id,
          unitId: unit.id,
          operatorName: current.name,
          operatorRegistration: current.registrationNumber,
          operatorCategory: current.professionalCategory.name,
          unitName: unit.name,
          unitCode: unit.code,
          timezone: unit.timezone,
        },
      });
      await writeAudit(tx, {
        actorUserId: current.id,
        action: "ATTENDANCE_CREATED",
        entityType: "Attendance",
        entityId: item.id,
        newValue: item,
        metadata: { duplicateAcknowledged: duplicate },
      });
      return item;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 },
  );
}
export async function updateAttendance(actor: SafeUser, id: string, raw: unknown) {
  const input = updateAttendanceSchema.parse(raw);
  const { duplicateAcknowledged, version, ...data } = input;
  return prisma.$transaction(
    async (tx) => {
      const current = await currentActor(tx, actor, "attendances:update", true);
      const previous = await findVisible(tx, current, id);
      assertEditable(previous, current, version);
      assertAttendanceDate(input.serviceDate, previous.timezone, current);
      if (input.cpf !== previous.cpf || input.responsibleRole !== previous.responsibleRole)
        throw new AppError(
          409,
          "Não é permitido trocar CPF ou RF/RL. Cancele o registro e crie outro atendimento.",
        );
      if (previous.opinion !== "PENDING" && input.opinion !== previous.opinion)
        throw new AppError(409, "O parecer já foi definido e não pode ser alterado.");
      const serviceDate = new Date(input.serviceDate + "T00:00:00Z");
      const duplicate = await checkDuplicate(
        tx,
        previous.ownerUserId,
        input.cpf,
        serviceDate,
        duplicateAcknowledged,
        id,
      );
      const item = await tx.attendance.update({
        where: { id, version: version },
        data: { ...data, serviceDate, version: { increment: 1 } },
      });
      await writeAudit(tx, {
        actorUserId: current.id,
        action: "ATTENDANCE_UPDATED",
        entityType: "Attendance",
        entityId: id,
        previousValue: previous,
        newValue: item,
        metadata: { duplicateAcknowledged: duplicate },
      });
      return item;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 },
  );
}
export async function cancelAttendance(actor: SafeUser, id: string, raw: unknown) {
  const input = cancelAttendanceSchema.parse(raw);
  return prisma.$transaction(
    async (tx) => {
      const current = await currentActor(tx, actor, "attendances:update", true);
      const previous = await findVisible(tx, current, id);
      assertEditable(previous, current, input.version);
      const item = await tx.attendance.update({
        where: { id, version: input.version },
        data: {
          cancelledAt: new Date(),
          cancellationReason: input.reason,
          version: { increment: 1 },
        },
      });
      await writeAudit(tx, {
        actorUserId: current.id,
        action: "ATTENDANCE_CANCELLED",
        entityType: "Attendance",
        entityId: id,
        previousValue: previous,
        newValue: item,
      });
      return item;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 },
  );
}
export async function attendanceFilterOptions(actor: SafeUser) {
  return prisma.$transaction(async (tx) => {
    const current = await currentActor(tx, actor, "attendances:read");
    if (current.accessProfile !== "DIRECTION")
      throw new AppError(403, "Filtros administrativos não permitidos.");
    const [operators, units] = await Promise.all([
      tx.user.findMany({
        where: { attendances: { some: {} } },
        select: { id: true, name: true, registrationNumber: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: 1000,
      }),
      tx.unit.findMany({
        where: { attendances: { some: {} } },
        select: { id: true, name: true, code: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: 1000,
      }),
    ]);
    return { operators, units };
  });
}
